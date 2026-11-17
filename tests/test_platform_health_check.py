import json
import os
import yaml
import pytest
from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    return app.test_client()


def test_api_health_endpoint(client):
    """Confirm the existing /api/health endpoint returns 200 and operational status."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert data["service"] == "DevSecOps Platform API"
    assert data["status"] == "operational"


def test_deploy_platform_workflow_ecs_health_check():
    """Verify that deploy-platform.yml registers the task definition with the proper container healthCheck."""
    workflow_path = ".github/workflows/deploy-platform.yml"
    assert os.path.exists(workflow_path), "deploy-platform.yml must exist"

    with open(workflow_path, "r", encoding="utf-8") as f:
        content = f.read()
        workflow_yaml = yaml.safe_load(content)

    assert workflow_yaml is not None
    assert "jobs" in workflow_yaml
    assert "deploy-to-aws" in workflow_yaml["jobs"]

    # Verify task definition healthCheck presence in workflow content
    assert "healthCheck" in content
    assert "CMD-SHELL" in content
    assert "http://127.0.0.1:5000/api/health" in content
    assert "startPeriod" in content or "start_period" in content


def test_deploy_platform_workflow_native_verification():
    """Confirm the workflow uses describe-tasks healthStatus and does NOT curl the public IP."""
    workflow_path = ".github/workflows/deploy-platform.yml"
    with open(workflow_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Must verify container healthStatus natively
    assert "containers[0].healthStatus" in content or "healthStatus" in content
    assert "HEALTHY" in content

    # Must NOT attempt an external HTTP request to public IP from runner
    assert 'curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${PLATFORM_URL}/api/health"' not in content
    assert 'curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${PLATFORM_URL}/"' not in content
