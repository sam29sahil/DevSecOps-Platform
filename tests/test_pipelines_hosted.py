import os
import re
from unittest.mock import Mock, patch
import pytest

from app import create_app
from app.models import get_db, create_project
from app.routes.pipelines import (
    is_valid_github_url,
    dispatch_github_workflow,
    create_pipeline_record,
    get_pipeline_run,
    get_pipeline,
)


# ============================================================
# FIXTURES
# ============================================================

@pytest.fixture
def app():
    app = create_app()
    app.config["TESTING"] = True
    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def test_project():
    project = create_project(
        name="Test Pipeline Project",
        description="A project for pipeline testing",
        repository_url="https://github.com/sam29sahil/DevSecOps-Platform",
        branch="main",
    )
    return project


@pytest.fixture
def test_pipeline(test_project):
    pipeline = create_pipeline_record(
        name="Test Pipeline",
        description="Hosted mode test pipeline",
        branch="main",
        repository_url="https://github.com/sam29sahil/DevSecOps-Platform",
        project_id=test_project["id"],
        quality_gate_score=70,
        fail_on_high=True,
        docker_enabled=True,
        registry_enabled=True,
        deployment_enabled=True,
    )
    return pipeline


# ============================================================
# 1. GITHUB URL VALIDATION TESTS
# ============================================================

def test_github_url_validation_valid():
    valid_urls = [
        "https://github.com/sam29sahil/DevSecOps-Platform",
        "https://github.com/sam29sahil/DevSecOps-Platform.git",
        "https://www.github.com/torvalds/linux",
        "https://github.com/facebook/react.git",
        "https://github.com/owner-name/repo_name.with-dots",
    ]
    for url in valid_urls:
        assert is_valid_github_url(url) is True, f"Failed for valid URL: {url}"


def test_github_url_validation_invalid():
    invalid_urls = [
        "",
        None,
        123,
        "http://github.com/sam29sahil/DevSecOps-Platform",  # Not HTTPS
        "https://gitlab.com/sam29sahil/DevSecOps-Platform",  # Not GitHub
        "https://bitbucket.org/owner/repo",                  # Not GitHub
        "https://github.com/",                              # Missing path
        "https://github.com/owner",                         # Missing repo
        "https://github.com/owner/repo/extra/path",         # Too many path segments
        "https://github.com/owner/repo?branch=main",        # Query parameters not allowed
        "https://github.com/owner/repo#frag",               # Fragment not allowed
        "https://github.com/owner/repo;rm -rf /",           # Invalid characters
        "ftp://github.com/owner/repo",                      # Wrong scheme
    ]
    for url in invalid_urls:
        assert is_valid_github_url(url) is False, f"Expected invalid for: {url}"


# ============================================================
# 2. WORKFLOW DISPATCH REQUEST CONSTRUCTION
# ============================================================

def test_dispatch_github_workflow_construction():
    env = {
        "GITHUB_TOKEN": "test-token-12345",
        "GITHUB_REPOSITORY": "sam29sahil/DevSecOps-Platform",
        "GITHUB_CALLBACK_URL": "https://devsecops-platform.onrender.com",
    }
    with patch.dict(os.environ, env):
        with patch("requests.post") as mock_post:
            mock_post.return_value = Mock(status_code=204, text="")

            result = dispatch_github_workflow(
                repository_url="https://github.com/octocat/Hello-World",
                branch="develop",
                pipeline_id=10,
                run_id=42,
                docker_enabled=True,
                registry_enabled=True,
                deployment_enabled=True,
            )

            assert result is True
            mock_post.assert_called_once()
            called_url = mock_post.call_args[0][0]
            called_headers = mock_post.call_args[1]["headers"]
            called_json = mock_post.call_args[1]["json"]

            assert called_url == "https://api.github.com/repos/sam29sahil/DevSecOps-Platform/actions/workflows/devsecops-pipeline.yml/dispatches"
            assert called_headers["Authorization"] == "Bearer test-token-12345"
            assert called_headers["Accept"] == "application/vnd.github+json"
            assert called_headers["X-GitHub-Api-Version"] == "2022-11-28"

            assert called_json["ref"] == "main"
            inputs = called_json["inputs"]
            assert inputs["repository_url"] == "https://github.com/octocat/Hello-World"
            assert inputs["branch"] == "develop"
            assert inputs["pipeline_id"] == "10"
            assert inputs["run_id"] == "42"
            assert inputs["callback_url"] == "https://devsecops-platform.onrender.com"
            assert inputs["docker_enabled"] == "true"
            assert inputs["registry_enabled"] == "true"
            assert inputs["deployment_enabled"] == "true"


def test_dispatch_github_workflow_missing_token():
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(RuntimeError) as exc_info:
            dispatch_github_workflow(
                repository_url="https://github.com/octocat/Hello-World",
                branch="main",
                pipeline_id=1,
                run_id=1,
            )
        assert "GitHub Actions integration is not configured." in str(exc_info.value)


# ============================================================
# 3. HOSTED MODE DOES NOT CALL DOCKER
# ============================================================

def test_hosted_mode_does_not_call_docker(client, test_pipeline):
    env = {
        "PIPELINE_EXECUTION_MODE": "hosted",
        "GITHUB_TOKEN": "test-secret-token",
        "GITHUB_CALLBACK_SECRET": "cb_secret_xyz",
        "GITHUB_REPOSITORY": "sam29sahil/DevSecOps-Platform",
    }

    mock_scan_result = {
        "files_scanned": 5,
        "findings": [],
        "security_score": 100,
    }

    with patch.dict(os.environ, env):
        with patch("app.routes.pipelines.checkout_repository", return_value=("/tmp/fake-workspace", {"status": "success"})):
            with patch("app.routes.pipelines.run_command", return_value={"returncode": 0, "stdout": "", "stderr": ""}):
                with patch("app.routes.pipelines.CodeScanner.scan", return_value=mock_scan_result):
                    with patch("app.routes.pipelines.dispatch_github_workflow") as mock_dispatch:
                        with patch("app.routes.pipelines.build_docker_image") as mock_docker_build:
                            with patch("app.routes.pipelines.scan_container_image") as mock_container_scan:
                                with patch("app.routes.pipelines.push_registry_image") as mock_registry_push:
                                    response = client.post(f"/api/pipelines/{test_pipeline['id']}/run")

                                    assert response.status_code == 201
                                    data = response.get_json()
                                    assert data["success"] is True
                                    assert "container stages queued in GitHub Actions" in data["message"]

                                    # Verify Docker CLI functions were NEVER invoked on the Render side
                                    assert mock_docker_build.called is False
                                    assert mock_container_scan.called is False
                                    assert mock_registry_push.called is False

                                    # Verify GitHub Actions workflow was dispatched
                                    assert mock_dispatch.called is True
                                    assert mock_dispatch.call_args[1]["pipeline_id"] == test_pipeline["id"]


# ============================================================
# 4. CALLBACK AUTHENTICATION TESTS
# ============================================================

def test_callback_authentication_missing_secret(client, test_pipeline):
    with patch.dict(os.environ, {}, clear=True):
        response = client.post(
            "/api/pipelines/runs/1/github-status",
            headers={"Authorization": "Bearer some-token"},
            json={"stage": "docker_build", "status": "running"},
        )
        assert response.status_code == 500
        assert "GITHUB_CALLBACK_SECRET is not configured" in response.get_json()["error"]


def test_callback_authentication_missing_header(client):
    with patch.dict(os.environ, {"GITHUB_CALLBACK_SECRET": "correct-secret"}):
        response = client.post(
            "/api/pipelines/runs/1/github-status",
            json={"stage": "docker_build", "status": "running"},
        )
        assert response.status_code == 401
        assert "Missing or invalid authorization header" in response.get_json()["error"]


def test_callback_authentication_invalid_token(client):
    with patch.dict(os.environ, {"GITHUB_CALLBACK_SECRET": "correct-secret"}):
        response = client.post(
            "/api/pipelines/runs/1/github-status",
            headers={"Authorization": "Bearer wrong-secret"},
            json={"stage": "docker_build", "status": "running"},
        )
        assert response.status_code == 401
        assert "Unauthorized" in response.get_json()["error"]


# ============================================================
# 5. CALLBACK UPDATES PIPELINE RUN ACCURATELY
# ============================================================

def test_callback_updates_pipeline_run_stages(client, test_pipeline):
    # First create a pipeline run in database
    env = {
        "PIPELINE_EXECUTION_MODE": "hosted",
        "GITHUB_TOKEN": "test-secret",
        "GITHUB_CALLBACK_SECRET": "test-callback-secret-123",
    }
    with patch.dict(os.environ, env):
        with patch("app.routes.pipelines.checkout_repository", return_value=("/tmp/fake-workspace", {"status": "success"})):
            with patch("app.routes.pipelines.run_command", return_value={"returncode": 0, "stdout": "", "stderr": ""}):
                with patch("app.routes.pipelines.CodeScanner.scan", return_value={"files_scanned": 1, "findings": [], "security_score": 100}):
                    with patch("app.routes.pipelines.dispatch_github_workflow"):
                        run_resp = client.post(f"/api/pipelines/{test_pipeline['id']}/run")
                        run_id = run_resp.get_json()["run"]["id"]

        headers = {
            "Authorization": "Bearer test-callback-secret-123",
            "Content-Type": "application/json",
        }

        # 1. Update docker_build -> running
        res1 = client.post(
            f"/api/pipelines/runs/{run_id}/github-status",
            headers=headers,
            json={
                "stage": "docker_build",
                "status": "running",
                "message": "Building Docker image in GitHub Actions...",
            },
        )
        assert res1.status_code == 200
        run_data = get_pipeline_run(run_id)
        stage_map = {s["id"]: s for s in run_data["stages"]}
        assert stage_map["docker_build"]["status"] == "running"

        # 2. Update docker_build -> success with image details
        image_uri = "288418346751.dkr.ecr.ap-south-1.amazonaws.com/devsecops-platform:1-1-abc"
        res2 = client.post(
            f"/api/pipelines/runs/{run_id}/github-status",
            headers=headers,
            json={
                "stage": "docker_build",
                "status": "success",
                "message": "Docker image built successfully.",
                "details": {"image": image_uri},
            },
        )
        assert res2.status_code == 200
        run_data = get_pipeline_run(run_id)
        stage_map = {s["id"]: s for s in run_data["stages"]}
        assert stage_map["docker_build"]["status"] == "success"
        assert run_data["docker_image"] == image_uri

        # 3. Update container_scan -> success
        res3 = client.post(
            f"/api/pipelines/runs/{run_id}/github-status",
            headers=headers,
            json={
                "stage": "container_scan",
                "status": "success",
                "message": "Trivy scan passed with zero HIGH/CRITICAL vulnerabilities.",
            },
        )
        assert res3.status_code == 200

        # 4. Update registry_push -> success
        res4 = client.post(
            f"/api/pipelines/runs/{run_id}/github-status",
            headers=headers,
            json={
                "stage": "registry_push",
                "status": "success",
                "message": "Image pushed to AWS ECR.",
                "details": {"image": image_uri},
            },
        )
        assert res4.status_code == 200
        run_data = get_pipeline_run(run_id)
        assert run_data["registry_image"] == image_uri

        # 5. Update deployment -> success
        res5 = client.post(
            f"/api/pipelines/runs/{run_id}/github-status",
            headers=headers,
            json={
                "stage": "deployment",
                "status": "success",
                "message": "Render deployment triggered successfully.",
            },
        )
        assert res5.status_code == 200
        run_data = get_pipeline_run(run_id)
        pipeline_data = get_pipeline(test_pipeline["id"])

        # Entire run should now be marked terminal success
        assert run_data["status"] == "success"
        assert pipeline_data["status"] == "success"


def test_callback_handles_failure(client, test_pipeline):
    env = {
        "PIPELINE_EXECUTION_MODE": "hosted",
        "GITHUB_TOKEN": "test-secret",
        "GITHUB_CALLBACK_SECRET": "test-callback-secret-123",
    }
    with patch.dict(os.environ, env):
        with patch("app.routes.pipelines.checkout_repository", return_value=("/tmp/fake-workspace", {"status": "success"})):
            with patch("app.routes.pipelines.run_command", return_value={"returncode": 0, "stdout": "", "stderr": ""}):
                with patch("app.routes.pipelines.CodeScanner.scan", return_value={"files_scanned": 1, "findings": [], "security_score": 100}):
                    with patch("app.routes.pipelines.dispatch_github_workflow"):
                        run_resp = client.post(f"/api/pipelines/{test_pipeline['id']}/run")
                        run_id = run_resp.get_json()["run"]["id"]

        headers = {
            "Authorization": "Bearer test-callback-secret-123",
            "Content-Type": "application/json",
        }

        # Send failure in container_scan
        res = client.post(
            f"/api/pipelines/runs/{run_id}/github-status",
            headers=headers,
            json={
                "stage": "container_scan",
                "status": "failed",
                "message": "Trivy detected CRITICAL vulnerability CVE-2026-1234.",
                "error": "Quality check failed on container image.",
            },
        )
        assert res.status_code == 200
        run_data = get_pipeline_run(run_id)
        pipeline_data = get_pipeline(test_pipeline["id"])

        assert run_data["status"] == "failed"
        assert "CVE-2026-1234" in run_data["error"]
        assert pipeline_data["status"] == "failed"


# ============================================================
# 6. GITHUB ACTIONS YAML SYNTAX & INPUTS VALIDATION
# ============================================================

def test_workflow_yaml_structure():
    workflow_path = ".github/workflows/devsecops-pipeline.yml"
    assert os.path.exists(workflow_path), "Workflow file does not exist!"

    with open(workflow_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Check key declarations and inputs
    assert "name: DevSecOps Pipeline" in content
    assert "workflow_dispatch:" in content
    assert "repository_url:" in content
    assert "branch:" in content
    assert "pipeline_id:" in content
    assert "run_id:" in content
    assert "id-token: write" in content
    assert "arn:aws:iam::288418346751:role/DevSecOpsPlatform-GitHubActions" in content
    assert "288418346751.dkr.ecr.ap-south-1.amazonaws.com" in content
    assert "secrets.DEVSECOPS_CALLBACK_SECRET" in content
    assert "secrets.RENDER_DEPLOY_HOOK" in content


