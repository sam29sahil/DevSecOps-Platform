import os
from unittest.mock import Mock, patch
import pytest
import requests

from app import create_app
from app.services.github_service import GithubService
from app.models import create_project, create_deployment, get_deployment
from app.routes.deployments import sync_deployment_status


@pytest.fixture
def app():
    app = create_app()
    app.config["TESTING"] = True
    return app


@pytest.fixture
def client(app):
    return app.test_client()


# ============================================================
# 1. GITHUB SERVICE CONFIGURATION & VALIDATION TESTS
# ============================================================

def test_github_service_missing_token():
    svc = GithubService(token="", repository="sam29sahil/DevSecOps-Platform")
    res = svc.validate_configuration()
    assert res["valid"] is False
    assert res["error_code"] == "MISSING_GITHUB_TOKEN"
    assert "GITHUB_TOKEN is missing" in res["message"]
    # Ensure token value is not exposed
    assert "token" not in res or res.get("token") is None


def test_github_service_invalid_repo_format():
    svc = GithubService(token="ghp_test123", repository="invalid-repo-without-slash")
    res = svc.validate_configuration()
    assert res["valid"] is False
    assert res["error_code"] == "INVALID_REPOSITORY_FORMAT"
    assert "must be formatted as 'owner/repo'" in res["message"]


# ============================================================
# 2. GITHUB API AUTHENTICATION & ERROR HANDLING TESTS
# ============================================================

def test_github_service_invalid_or_expired_token():
    svc = GithubService(token="ghp_invalid_token", repository="sam29sahil/DevSecOps-Platform")

    mock_resp = Mock()
    mock_resp.status_code = 401
    mock_resp.headers = {}

    with patch("requests.get", return_value=mock_resp):
        res = svc.validate_authentication()
        assert res["valid"] is False
        assert res["error_code"] == "INVALID_OR_EXPIRED_TOKEN"
        assert "HTTP 401 Unauthorized" in res["message"]


def test_github_service_rate_limited():
    svc = GithubService(token="ghp_rate_limited", repository="sam29sahil/DevSecOps-Platform")

    mock_resp = Mock()
    mock_resp.status_code = 403
    mock_resp.headers = {"x-ratelimit-remaining": "0", "x-ratelimit-reset": "1731850000"}

    with patch("requests.get", return_value=mock_resp):
        res = svc.validate_authentication()
        assert res["valid"] is False
        assert res["error_code"] == "RATE_LIMIT_EXCEEDED"
        assert "rate limit exceeded" in res["message"]


def test_github_service_repository_not_found():
    svc = GithubService(token="ghp_valid", repository="sam29sahil/NonExistentRepo")

    mock_user_resp = Mock()
    mock_user_resp.status_code = 200
    mock_user_resp.headers = {"x-ratelimit-remaining": "4999"}
    mock_user_resp.json.return_value = {"login": "testuser"}

    mock_repo_resp = Mock()
    mock_repo_resp.status_code = 404

    def side_effect(url, **kwargs):
        if url == "https://api.github.com/user":
            return mock_user_resp
        return mock_repo_resp

    with patch("requests.get", side_effect=side_effect):
        res = svc.validate_authentication()
        assert res["valid"] is False
        assert res["error_code"] == "REPOSITORY_NOT_FOUND"


def test_github_service_workflow_not_found():
    svc = GithubService(token="ghp_valid", repository="sam29sahil/DevSecOps-Platform")

    mock_user_resp = Mock()
    mock_user_resp.status_code = 200
    mock_user_resp.headers = {"x-ratelimit-remaining": "4999"}
    mock_user_resp.json.return_value = {"login": "testuser"}

    mock_repo_resp = Mock()
    mock_repo_resp.status_code = 200
    mock_repo_resp.json.return_value = {"private": False}

    mock_wf_resp = Mock()
    mock_wf_resp.status_code = 404

    def side_effect(url, **kwargs):
        if url == "https://api.github.com/user":
            return mock_user_resp
        if "workflows/devsecops-pipeline.yml" in url:
            return mock_wf_resp
        return mock_repo_resp

    with patch("requests.get", side_effect=side_effect):
        res = svc.validate_authentication()
        assert res["valid"] is False
        assert res["error_code"] == "WORKFLOW_NOT_FOUND"


def test_github_service_workflow_actions_permission_denied():
    svc = GithubService(token="ghp_valid", repository="sam29sahil/DevSecOps-Platform")

    mock_user_resp = Mock()
    mock_user_resp.status_code = 200
    mock_user_resp.headers = {"x-ratelimit-remaining": "4999"}
    mock_user_resp.json.return_value = {"login": "testuser"}

    mock_repo_resp = Mock()
    mock_repo_resp.status_code = 200
    mock_repo_resp.json.return_value = {"private": False}

    mock_wf_resp = Mock()
    mock_wf_resp.status_code = 403

    def side_effect(url, **kwargs):
        if url == "https://api.github.com/user":
            return mock_user_resp
        if "workflows/devsecops-pipeline.yml" in url:
            return mock_wf_resp
        return mock_repo_resp

    with patch("requests.get", side_effect=side_effect):
        res = svc.validate_authentication()
        assert res["valid"] is False
        assert res["error_code"] == "INSUFFICIENT_ACTIONS_PERMISSIONS"


def test_github_service_successful_verification():
    svc = GithubService(token="ghp_valid", repository="sam29sahil/DevSecOps-Platform")

    mock_user_resp = Mock()
    mock_user_resp.status_code = 200
    mock_user_resp.headers = {"x-ratelimit-remaining": "4999"}
    mock_user_resp.json.return_value = {"login": "sam29sahil"}

    mock_repo_resp = Mock()
    mock_repo_resp.status_code = 200
    mock_repo_resp.json.return_value = {"private": False}

    mock_wf_resp = Mock()
    mock_wf_resp.status_code = 200

    def side_effect(url, **kwargs):
        if url == "https://api.github.com/user":
            return mock_user_resp
        if "workflows/devsecops-pipeline.yml" in url:
            return mock_wf_resp
        return mock_repo_resp

    with patch("requests.get", side_effect=side_effect):
        res = svc.validate_authentication()
        assert res["valid"] is True
        assert res["authenticated"] is True
        assert res["authenticated_as"] == "sam29sahil"
        assert res["repository"] == "sam29sahil/DevSecOps-Platform"
        assert res["permissions"]["actions"] == "read_write"
        assert res["permissions"]["contents"] == "read"


# ============================================================
# 3. WORKFLOW DISPATCH TESTS
# ============================================================

def test_github_service_dispatch_workflow_success():
    svc = GithubService(token="ghp_valid", repository="sam29sahil/DevSecOps-Platform")

    mock_post_resp = Mock()
    mock_post_resp.status_code = 204

    with patch("requests.post", return_value=mock_post_resp) as mock_post:
        success = svc.dispatch_workflow(
            repository_url="https://github.com/sam29sahil/password_web_checker.git",
            branch="main",
            pipeline_id=1,
            run_id=10,
            deployment_id="deploy-test1234",
            container_port=5000,
            docker_enabled=True,
            registry_enabled=True,
            deployment_enabled=True,
        )
        assert success is True
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        assert "dispatches" in mock_post.call_args[0][0]
        inputs = call_kwargs["json"]["inputs"]
        assert inputs["pipeline_id"] == "1"
        assert inputs["run_id"] == "10"
        assert inputs["deployment_id"] == "deploy-test1234"
        assert inputs["container_port"] == "5000"


def test_github_service_dispatch_workflow_failure():
    svc = GithubService(token="ghp_valid", repository="sam29sahil/DevSecOps-Platform")

    mock_post_resp = Mock()
    mock_post_resp.status_code = 422
    mock_post_resp.text = '{"message": "Validation Failed"}'

    with patch("requests.post", return_value=mock_post_resp):
        with pytest.raises(RuntimeError) as exc_info:
            svc.dispatch_workflow(
                repository_url="https://github.com/sam29sahil/password_web_checker.git",
                branch="main",
                pipeline_id=1,
                run_id=10,
            )
        assert "GitHub API dispatch failed with status 422" in str(exc_info.value)


# ============================================================
# 4. FLASK API STATUS & CONFIG CHECK ENDPOINTS
# ============================================================

def test_api_github_status_endpoint(client):
    # When token is missing
    with patch.dict(os.environ, {"GITHUB_TOKEN": ""}, clear=True):
        resp = client.get("/api/pipelines/github/status")
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["success"] is False
        assert data["result"]["error_code"] == "MISSING_GITHUB_TOKEN"
        # Never expose token
        assert "ghp_" not in str(data)

    # When token is valid
    mock_valid = {
        "valid": True,
        "authenticated": True,
        "authenticated_as": "sam29sahil",
        "repository": "sam29sahil/DevSecOps-Platform",
    }
    with patch.object(GithubService, "validate_authentication", return_value=mock_valid):
        resp = client.get("/api/pipelines/github/status")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert data["result"]["authenticated_as"] == "sam29sahil"


def test_api_deployment_config_endpoint(client):
    env = {
        "PIPELINE_EXECUTION_MODE": "hosted",
        "GITHUB_TOKEN": "ghp_my_secret_token",
        "GITHUB_REPOSITORY": "sam29sahil/DevSecOps-Platform",
        "AWS_REGION": "ap-south-1",
        "CONTAINER_REGISTRY": "288418346751.dkr.ecr.ap-south-1.amazonaws.com",
    }
    with patch.dict(os.environ, env):
        resp = client.get("/api/deployments/config")
        assert resp.status_code == 200
        data = resp.get_json()["config"]
        assert data["execution_mode"] == "hosted"
        assert data["github_token_configured"] is True
        assert data["github_repository"] == "sam29sahil/DevSecOps-Platform"
        assert data["ready_for_hosted_deployment"] is True
        # Critical security check: raw secret value must NEVER be returned
        assert "ghp_my_secret_token" not in str(resp.get_json())
