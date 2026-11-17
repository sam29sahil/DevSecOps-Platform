import os
import tempfile
import pytest
from unittest.mock import Mock, patch
from botocore.exceptions import ClientError

from app import create_app
from app.models import init_db, create_project, get_project, create_deployment, get_deployment
from app.scanners.code_scanner import CodeScanner, redact_secret_string
from app.services.aws_service import AwsService


@pytest.fixture
def app():
    os.environ["TESTING"] = "true"
    os.environ["FLASK_ENV"] = "testing"
    os.environ["GITHUB_CALLBACK_SECRET"] = "master-test-secret"
    app = create_app()
    with app.app_context():
        init_db()
        yield app


@pytest.fixture
def client(app):
    return app.test_client()


# ============================================================
# 1. CODE SCANNER: SECRETS DETECTION & EVIDENCE REDACTION
# ============================================================

def test_code_scanner_secret_detection_and_redaction():
    # Test redaction function directly
    raw_evidence = 'aws_secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"'
    redacted = redact_secret_string(raw_evidence)
    assert "EXAMPLEKEY" not in redacted
    assert "[REDACTED_SECRET]" in redacted

    aws_key_str = 'AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"'
    redacted_key = redact_secret_string(aws_key_str)
    assert "AKIAIOSFODNN7EXAMPLE" not in redacted_key
    assert "[REDACTED_AWS_KEY]" in redacted_key

    gh_token_str = "token = 'ghp_1234567890abcdef1234567890abcdef1234'"
    redacted_gh = redact_secret_string(gh_token_str)
    assert "ghp_1234567890abcdef" not in redacted_gh

    # Test CodeScanner scanning a directory with secrets
    with tempfile.TemporaryDirectory() as tmp_dir:
        test_file = os.path.join(tmp_dir, "config.py")
        with open(test_file, "w", encoding="utf-8") as f:
            f.write(
                'AWS_KEY = "AKIAIOSFODNN7EXAMPLE"\n'
                'gh_pat = "ghp_1234567890abcdef1234567890abcdef1234"\n'
                'private_key = "-----BEGIN RSA PRIVATE KEY-----"\n'
                'password = "supersecretpassword123"\n'
            )

        scanner = CodeScanner(tmp_dir)
        results = scanner.scan()

        assert results["files_scanned"] == 1
        rule_ids = {f["rule_id"] for f in results["findings"]}
        assert "SEC006" in rule_ids  # Hardcoded AWS Credentials
        assert "SEC007" in rule_ids  # Hardcoded Service Token
        assert "SEC008" in rule_ids  # Private Cryptographic Key Exposed
        assert "SEC001" in rule_ids  # Hardcoded Password

        # Verify all findings have secrets redacted in evidence
        for finding in results["findings"]:
            assert "AKIAIOSFODNN7EXAMPLE" not in finding["evidence"]
            assert "ghp_1234567890abcdef1234567890abcdef1234" not in finding["evidence"]


# ============================================================
# 2. AWS SERVICE: START, RESTART, & HEALTH CHECK
# ============================================================

def test_aws_service_start_restart_and_health():
    mock_ecs = Mock()
    mock_ecs.update_service.return_value = {
        "service": {
            "status": "ACTIVE",
            "desiredCount": 1,
            "deployments": [{"id": "dep-1"}],
        }
    }

    aws_svc = AwsService(ecs_client=mock_ecs)

    # Test start_ecs_service
    start_resp = aws_svc.start_ecs_service(cluster_name="test-cluster", service_name="test-app", desired_count=1)
    assert start_resp["success"] is True
    assert start_resp["desired_count"] == 1
    mock_ecs.update_service.assert_called_with(
        cluster="test-cluster",
        service="test-app",
        desiredCount=1,
    )

    # Test restart_ecs_service
    restart_resp = aws_svc.restart_ecs_service(cluster_name="test-cluster", service_name="test-app")
    assert restart_resp["success"] is True
    mock_ecs.update_service.assert_called_with(
        cluster="test-cluster",
        service="test-app",
        forceNewDeployment=True,
    )

    # Test verify_application_health with mock HTTP response
    mock_http_resp = Mock()
    mock_http_resp.getcode.return_value = 200
    mock_http_resp.__enter__ = Mock(return_value=mock_http_resp)
    mock_http_resp.__exit__ = Mock(return_value=None)

    with patch("urllib.request.urlopen", return_value=mock_http_resp):
        health = aws_svc.verify_application_health("http://15.206.100.50:5000", health_path="/")
        assert health["healthy"] is True
        assert health["status_code"] == 200


# ============================================================
# 3. DEPLOYMENT CONTROLS: START, RESTART, STOP-ALL, HEALTH API
# ============================================================

def test_deployment_endpoints_start_restart_stop_all(client):
    # Create test project & deployment
    project = create_project(
        name="DeployTestApp",
        repository_url="https://github.com/sam29sahil/password_web_checker",
        app_port=5000,
    )

    dep = create_deployment(
        project_id=project["id"],
        app_name="DeployTestApp",
        repository_url=project["repository_url"],
        ecs_cluster="devsecops-cluster",
        ecs_service="deploytestapp-service",
        status="stopped",
        app_url="http://13.235.45.67:5000",
    )
    dep_id = dep["deployment_id"]

    # 1. Start stopped deployment
    with patch("app.services.aws_service.AwsService.start_ecs_service", return_value={"success": True}):
        with patch("app.services.aws_service.AwsService.get_ecs_service_public_ip", return_value="13.235.45.67"):
            start_resp = client.post(f"/api/deployments/{dep_id}/start")
            assert start_resp.status_code == 200
            assert start_resp.get_json()["success"] is True
            assert start_resp.get_json()["deployment"]["status"] == "deployed"

    # 2. Restart deployment
    with patch("app.services.aws_service.AwsService.restart_ecs_service", return_value={"success": True}):
        restart_resp = client.post(f"/api/deployments/{dep_id}/restart")
        assert restart_resp.status_code == 200
        assert restart_resp.get_json()["success"] is True

    # 3. Check health endpoint
    with patch("app.services.aws_service.AwsService.verify_application_health", return_value={"healthy": True, "status_code": 200}):
        health_resp = client.get(f"/api/deployments/{dep_id}/health")
        assert health_resp.status_code == 200
        assert health_resp.get_json()["healthy"] is True
        assert health_resp.get_json()["health_status"] == "healthy"

    # 4. Stop all deployments
    with patch("app.services.aws_service.AwsService.stop_ecs_service", return_value={"success": True}):
        stop_all_resp = client.post("/api/deployments/stop-all")
        assert stop_all_resp.status_code == 200
        assert stop_all_resp.get_json()["success"] is True
        assert stop_all_resp.get_json()["stopped_count"] >= 1

        # Confirm deployment is now stopped
        check_dep = get_deployment(dep_id)
        assert check_dep["status"] == "stopped"


# ============================================================
# 4. PROJECTS: EXTENDED CONFIG & ONE-CLICK DEPLOY
# ============================================================

def test_project_extended_creation_and_deploy_trigger(client):
    # 1. Create project with dockerfile_path, build_context, and health_check_path
    create_resp = client.post(
        "/api/projects",
        json={
            "name": "OneClickProject",
            "repository_url": "https://github.com/sam29sahil/password_web_checker",
            "branch": "main",
            "app_port": 5000,
            "dockerfile_path": "Dockerfile",
            "build_context": ".",
            "health_check_path": "/",
            "start_pipeline": False,
        },
    )
    assert create_resp.status_code == 201
    proj_data = create_resp.get_json()["project"]
    pipeline_data = create_resp.get_json()["pipeline"]

    assert proj_data["name"] == "OneClickProject"
    assert proj_data["dockerfile_path"] == "Dockerfile"
    assert proj_data["health_check_path"] == "/"
    assert pipeline_data is not None
    assert pipeline_data["project_id"] == proj_data["id"]

    # 2. Trigger one-click deploy from project endpoint
    with patch("app.routes.pipelines.checkout_repository", return_value=("/tmp/fake-workspace", {"status": "success"})):
        with patch("app.routes.pipelines.run_command", return_value={"returncode": 0, "stdout": "", "stderr": ""}):
            with patch("app.routes.pipelines.CodeScanner.scan", return_value={"files_scanned": 1, "findings": [], "security_score": 100}):
                with patch("app.routes.pipelines.dispatch_github_workflow"):
                    deploy_resp = client.post(f"/api/projects/{proj_data['id']}/deploy")
                    assert deploy_resp.status_code == 201
                    assert deploy_resp.get_json()["success"] is True
