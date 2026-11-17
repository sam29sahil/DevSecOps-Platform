import os
import json
import pytest
from app import create_app, get_cors_origins
from app.routes.pipelines import evaluate_quality_gate, QualityGateError
from app.models import get_db, init_db, create_project, get_project


@pytest.fixture
def app_client(monkeypatch, tmp_path):
    monkeypatch.setenv("TESTING", "true")
    monkeypatch.setenv("FLASK_ENV", "testing")
    monkeypatch.setenv("REQUIRE_AUTH", "false")
    db_path = str(tmp_path / "test_cors_qg.db")
    monkeypatch.setenv("DATABASE_PATH", db_path)
    init_db()
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


# ============================================================
# ISSUE 1: CORS & PREFLIGHT TESTS
# ============================================================

def test_cors_origins_defaults_and_env(monkeypatch):
    """Ensure get_cors_origins parses environment variables and includes dev origins."""
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    monkeypatch.delenv("FRONTEND_URL", raising=False)

    origins = get_cors_origins()
    assert "http://localhost:5173" in origins
    assert "http://127.0.0.1:5173" in origins
    assert "http://localhost:3000" in origins
    assert "http://127.0.0.1:3000" in origins
    assert "*" not in origins  # Wildcard must never be used

    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://platform.prod.corp, https://staging.devsecops.io/")
    monkeypatch.setenv("FRONTEND_URL", "https://app.devsecops.io")

    origins_with_env = get_cors_origins()
    assert "https://platform.prod.corp" in origins_with_env
    assert "https://staging.devsecops.io" in origins_with_env
    assert "https://app.devsecops.io" in origins_with_env


def test_cors_preflight_aws_overview(app_client):
    """Verify OPTIONS preflight on /api/aws/overview returns 200 with proper CORS headers."""
    resp = app_client.options(
        "/api/aws/overview",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Content-Type, Authorization, X-API-Key",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    assert "GET" in resp.headers.get("Access-Control-Allow-Methods", "")
    assert "OPTIONS" in resp.headers.get("Access-Control-Allow-Methods", "")


def test_cors_preflight_deploy_project(app_client):
    """Verify OPTIONS preflight on /api/projects/271/deploy returns 200 with proper CORS headers."""
    resp = app_client.options(
        "/api/projects/271/deploy",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type, Authorization, X-API-Key",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    assert "POST" in resp.headers.get("Access-Control-Allow-Methods", "")


def test_cors_preflight_deployment_config(app_client):
    """Verify OPTIONS preflight on /api/deployments/config returns 200 with proper CORS headers."""
    resp = app_client.options(
        "/api/deployments/config",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Content-Type, Authorization, X-API-Key",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    assert "GET" in resp.headers.get("Access-Control-Allow-Methods", "")


def test_cors_disallows_unauthorized_origins(app_client):
    """Verify arbitrary unauthorized origins do not receive Access-Control-Allow-Origin."""
    resp = app_client.options(
        "/api/aws/overview",
        headers={
            "Origin": "http://malicious-site.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.headers.get("Access-Control-Allow-Origin") is None


def test_cors_actual_get_request_has_headers(app_client):
    """Verify actual GET request from allowed origin receives CORS response header."""
    resp = app_client.get(
        "/api/deployments/config",
        headers={"Origin": "http://localhost:5173"},
    )
    assert resp.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"


# ============================================================
# ISSUE 3: QUALITY GATE EVALUATION & ERROR HANDLING
# ============================================================

def test_evaluate_quality_gate_genuine_findings():
    """
    Test Quality Gate logic matching Project 271 findings:
    - Score: 60 (below 70)
    - 1 Critical finding (SECRET-001)
    - 1 High finding (SEC002)
    """
    findings = [
        {
            "id": 1,
            "rule_id": "SECRET-001",
            "title": "Generic API Key",
            "severity": "CRITICAL",
            "file_path": "app.py",
            "line_number": 27,
            "evidence": 'app.secret_key = "local-development-only-change-me"',
        },
        {
            "id": 2,
            "rule_id": "SEC002",
            "title": "Hardcoded API Key",
            "severity": "HIGH",
            "file_path": "app.py",
            "line_number": 27,
            "evidence": 'app.secret_key = "local-development-only-change-me"',
        },
    ]

    qg = evaluate_quality_gate(
        security_score=60,
        findings=findings,
        minimum_score=70,
        fail_on_high=True,
    )

    assert qg["passed"] is False
    assert qg["security_score"] == 60
    assert qg["minimum_score"] == 70
    assert qg["critical"] == 1
    assert qg["high"] == 1
    assert len(qg["reasons"]) == 3
    assert any("below required score 70" in r for r in qg["reasons"])
    assert any("1 critical finding(s)" in r for r in qg["reasons"])
    assert any("1 high severity finding(s)" in r for r in qg["reasons"])


def test_quality_gate_passes_when_clean():
    """Verify clean project with high score and no critical/high findings passes."""
    findings = [
        {"rule_id": "INFO01", "severity": "LOW", "description": "Minor note"}
    ]
    qg = evaluate_quality_gate(
        security_score=95,
        findings=findings,
        minimum_score=70,
        fail_on_high=True,
    )
    assert qg["passed"] is True
    assert len(qg["reasons"]) == 0


def test_pipeline_run_quality_gate_failure_returns_422(app_client, monkeypatch, tmp_path):
    """
    Simulate running a pipeline that fails the quality gate.
    Ensure it returns HTTP 422 with structured QUALITY_GATE_FAILED schema.
    """
    from app.routes.pipelines import create_pipeline_record, run_pipeline

    # Create dummy project & pipeline
    project = create_project(
        name="Vulnerable Test Project",
        repository_url="https://github.com/sam29sahil/vuln_scanner.git",
        branch="main",
    )
    pipeline = create_pipeline_record(
        name="Vulnerable Pipeline",
        project_id=project["id"],
        repository_url="https://github.com/sam29sahil/vuln_scanner.git",
        branch="main",
        quality_gate_score=70,
        fail_on_high=True,
    )

    # Mock checkout and SAST scanner to produce Project 271's exact findings
    vulnerable_findings = [
        {
            "rule_id": "SECRET-001",
            "title": "Generic API Key",
            "severity": "CRITICAL",
            "file_path": "app.py",
            "line_number": 27,
            "evidence": 'app.secret_key = "local-development-only-change-me"',
        },
        {
            "rule_id": "SEC002",
            "title": "Hardcoded API Key",
            "severity": "HIGH",
            "file_path": "app.py",
            "line_number": 27,
            "evidence": 'app.secret_key = "local-development-only-change-me"',
        },
    ]

    workspace_dir = tmp_path / "workspace"
    workspace_dir.mkdir(exist_ok=True)
    monkeypatch.setattr(
        "app.routes.pipelines.checkout_repository",
        lambda repo, branch: (str(workspace_dir), {"status": "success"}),
    )
    monkeypatch.setattr(
        "app.routes.pipelines.CodeScanner.scan",
        lambda self: {
            "files_scanned": 4,
            "findings": vulnerable_findings,
            "total_findings": len(vulnerable_findings),
        },
    )

    # Trigger pipeline run endpoint directly
    response = app_client.post(f"/api/pipelines/{pipeline['id']}/run")

    assert response.status_code == 422
    data = response.get_json()

    assert data["success"] is False
    assert data["error"] == "QUALITY_GATE_FAILED"
    assert "Quality gate failed" in data["message"]
    assert data["security_score"] == 60
    assert data["required_score"] == 70
    assert data["critical_findings_count"] == 1
    assert data["high_findings_count"] == 1
    assert isinstance(data["reasons"], list)
    assert len(data["reasons"]) == 3
    assert data["quality_gate"]["passed"] is False
    assert len(data["findings"]) == 2
    assert data["pipeline"]["status"] == "failed"
    assert data["run"]["status"] == "failed"


def test_project_deploy_endpoint_quality_gate_failure(app_client, monkeypatch, tmp_path):
    """
    Test POST /api/projects/<id>/deploy returns HTTP 422 when quality gate fails.
    """
    project = create_project(
        name="Deploy Test Project",
        repository_url="https://github.com/sam29sahil/vuln_scanner.git",
        branch="main",
    )

    vulnerable_findings = [
        {
            "rule_id": "SECRET-001",
            "title": "Generic API Key",
            "severity": "CRITICAL",
            "file_path": "app.py",
            "line_number": 27,
            "evidence": 'app.secret_key = "local-development-only-change-me"',
        },
        {
            "rule_id": "SEC002",
            "title": "Hardcoded API Key",
            "severity": "HIGH",
            "file_path": "app.py",
            "line_number": 27,
            "evidence": 'app.secret_key = "local-development-only-change-me"',
        },
    ]

    workspace_dir = tmp_path / "workspace_deploy"
    workspace_dir.mkdir(exist_ok=True)
    monkeypatch.setattr(
        "app.routes.pipelines.checkout_repository",
        lambda repo, branch: (str(workspace_dir), {"status": "success"}),
    )
    monkeypatch.setattr(
        "app.routes.pipelines.CodeScanner.scan",
        lambda self: {
            "files_scanned": 4,
            "findings": vulnerable_findings,
            "total_findings": len(vulnerable_findings),
        },
    )

    response = app_client.post(
        f"/api/projects/{project['id']}/deploy",
        headers={"Origin": "http://localhost:5173"},
    )

    assert response.status_code == 422
    data = response.get_json()
    assert data["error"] == "QUALITY_GATE_FAILED"
    assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
