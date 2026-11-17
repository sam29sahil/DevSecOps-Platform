import os
import pytest
from unittest.mock import patch

from app import create_app
from app.models import (
    create_project,
    get_project,
    create_deployment,
    get_deployment,
    get_deployments,
    update_deployment,
    delete_deployment,
    create_notification,
    get_notifications,
    clear_notifications,
)
from app.routes.pipelines import (
    create_pipeline_record,
    save_pipeline_run,
    get_pipeline_run,
    DEFAULT_STAGES,
)


@pytest.fixture
def app():
    app = create_app()
    app.config["TESTING"] = True
    return app


@pytest.fixture
def client(app):
    return app.test_client()


# ============================================================
# AUDIT TEST 1: REPOSITORY SUBMISSION & DEPLOYMENT RECORD
# ============================================================

def test_repo_submission_creates_project_and_notification(client):
    res = client.post(
        "/api/projects",
        json={
            "name": "Audit App Alpha",
            "repository_url": "https://github.com/sam29sahil/app-alpha",
            "branch": "main",
            "app_port": 3000,
            "app_type": "node",
        },
    )
    assert res.status_code == 201
    project = res.get_json()["project"]
    assert project["name"] == "Audit App Alpha"
    assert project["app_port"] == 3000

    notifs = get_notifications()
    assert any(
        n["event_type"] == "repo_submitted" and "Audit App Alpha" in n["message"]
        for n in notifs["notifications"]
    )


# ============================================================
# AUDIT TEST 2: MULTI-TENANCY & ISOLATION ACROSS TWO PROJECTS
# ============================================================

def test_multi_tenancy_isolation_between_two_apps(client):
    # App 1
    p1 = create_project(
        name="Tenant One",
        repository_url="https://github.com/org1/app-one",
        branch="main",
        app_port=5000,
    )
    pipe1 = create_pipeline_record(
        name="Pipeline One",
        branch="main",
        repository_url=p1["repository_url"],
        project_id=p1["id"],
        deployment_enabled=True,
    )
    run1 = save_pipeline_run({
        "id": None,
        "pipeline_id": pipe1["id"],
        "pipeline_name": pipe1["name"],
        "status": "running",
        "started_at": "2026-11-17T12:00:00",
        "stages": [{**s, "status": "pending"} for s in DEFAULT_STAGES],
    })
    dep1 = create_deployment(
        project_id=p1["id"],
        pipeline_run_id=run1["id"],
        app_name=p1["name"],
        repository_url=p1["repository_url"],
        image_uri="288418346751.dkr.ecr.ap-south-1.amazonaws.com/devsecops-platform:1-1-abc1234",
        ecs_service="devsecops-srv-1",
        container_port=5000,
        status="deployed",
        health_status="healthy",
        app_url="http://13.232.10.1:5000",
    )

    # App 2
    p2 = create_project(
        name="Tenant Two",
        repository_url="https://github.com/org2/app-two",
        branch="develop",
        app_port=8080,
    )
    pipe2 = create_pipeline_record(
        name="Pipeline Two",
        branch="develop",
        repository_url=p2["repository_url"],
        project_id=p2["id"],
        deployment_enabled=True,
    )
    run2 = save_pipeline_run({
        "id": None,
        "pipeline_id": pipe2["id"],
        "pipeline_name": pipe2["name"],
        "status": "running",
        "started_at": "2026-11-17T12:05:00",
        "stages": [{**s, "status": "pending"} for s in DEFAULT_STAGES],
    })
    dep2 = create_deployment(
        project_id=p2["id"],
        pipeline_run_id=run2["id"],
        app_name=p2["name"],
        repository_url=p2["repository_url"],
        image_uri="288418346751.dkr.ecr.ap-south-1.amazonaws.com/devsecops-platform:2-2-xyz9876",
        ecs_service="devsecops-srv-2",
        container_port=8080,
        status="deployed",
        health_status="healthy",
        app_url="http://13.232.10.2:8080",
    )

    # Verify complete isolation
    assert dep1["deployment_id"] != dep2["deployment_id"]
    assert dep1["app_url"] != dep2["app_url"]
    assert dep1["ecs_service"] != dep2["ecs_service"]
    assert dep1["image_uri"] != dep2["image_uri"]
    assert dep1["container_port"] == 5000
    assert dep2["container_port"] == 8080

    # Project 1 deployments list only contains dep1
    p1_deps = get_deployments(project_id=p1["id"])
    assert len(p1_deps) == 1
    assert p1_deps[0]["deployment_id"] == dep1["deployment_id"]

    # Project 2 deployments list only contains dep2
    p2_deps = get_deployments(project_id=p2["id"])
    assert len(p2_deps) == 1
    assert p2_deps[0]["deployment_id"] == dep2["deployment_id"]


# ============================================================
# AUDIT TEST 3: SIMULATING FAILED BUILDS & HEALTH CHECKS
# ============================================================

def test_failed_deployment_and_health_check_handling(client):
    secret = "audit-callback-secret"
    project = create_project(
        name="Failing App",
        repository_url="https://github.com/fail/app",
        branch="main",
    )
    pipeline = create_pipeline_record(
        name="Failing Pipeline",
        branch="main",
        repository_url=project["repository_url"],
        project_id=project["id"],
        deployment_enabled=True,
    )
    run = save_pipeline_run({
        "id": None,
        "pipeline_id": pipeline["id"],
        "pipeline_name": pipeline["name"],
        "status": "running",
        "started_at": "2026-11-17T12:10:00",
        "stages": [{**s, "status": "pending"} for s in DEFAULT_STAGES],
    })
    dep = create_deployment(
        project_id=project["id"],
        pipeline_run_id=run["id"],
        app_name=project["name"],
        status="pending",
    )
    run["deployment_id"] = dep["deployment_id"]
    save_pipeline_run(run)

    headers = {
        "Authorization": f"Bearer {secret}",
        "Content-Type": "application/json",
    }

    with patch.dict(os.environ, {"GITHUB_CALLBACK_SECRET": secret}):
        # 1. Health check failure callback
        fail_res = client.post(
            f"/api/pipelines/runs/{run['id']}/github-status",
            headers=headers,
            json={
                "stage": "deployment",
                "status": "failed",
                "message": "Health check timed out after 60 seconds.",
                "error": "HTTP health check failed: Connection refused on port 5000",
            },
        )
        assert fail_res.status_code == 200

        # Verify pipeline run failed
        run_data = get_pipeline_run(run["id"])
        assert run_data["status"] == "failed"
        assert "health check" in run_data["error"].lower()
        # Verify NO fake or unverified URL was set
        assert run_data.get("app_url") is None

        # Verify deployment record shows failed & unhealthy
        dep_data = get_deployment(dep["deployment_id"])
        assert dep_data["status"] == "failed"
        assert dep_data["health_status"] == "unhealthy"
        assert not dep_data.get("app_url")

        # Verify notification flags error
        notifs = get_notifications()
        assert any(
            n["event_type"] == "health_check_failed" and n["status"] == "error"
            for n in notifs["notifications"]
        )


# ============================================================
# AUDIT TEST 4: STOP AND DELETE CLEANUP OPERATIONS
# ============================================================

def test_deployment_stop_and_delete_operations(client):
    dep = create_deployment(
        app_name="Cleanup Test App",
        status="deployed",
        health_status="healthy",
        app_url="http://13.232.88.99:5000",
    )
    dep_id = dep["deployment_id"]

    # Stop
    stop_res = client.post(f"/api/deployments/{dep_id}/stop")
    assert stop_res.status_code == 200
    assert stop_res.get_json()["deployment"]["status"] == "stopped"

    # Delete
    del_res = client.delete(f"/api/deployments/{dep_id}")
    assert del_res.status_code == 200
    assert get_deployment(dep_id) is None
