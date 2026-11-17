import os
import pytest
from unittest.mock import patch

from app import create_app
from app.models import (
    create_project,
    create_deployment,
    get_deployment,
    get_deployments,
    get_deployment_stats,
    update_deployment,
    delete_deployment,
    create_notification,
    get_notifications,
    mark_notification_read,
    clear_notifications,
)
from app.routes.pipelines import create_pipeline_record, save_pipeline_run, DEFAULT_STAGES


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
    return create_project(
        name="Deployment Test App",
        description="Testing deployments & notifications",
        repository_url="https://github.com/sam29sahil/my-flask-app",
        branch="main",
        app_port=5000,
    )


# ============================================================
# 1. DATABASE & MODEL TESTS
# ============================================================

def test_deployment_crud_and_stats(test_project):
    # Create deployment
    dep = create_deployment(
        project_id=test_project["id"],
        app_name=test_project["name"],
        repository_url=test_project["repository_url"],
        platform="AWS ECS Fargate",
        region="ap-south-1",
        container_port=5000,
        status="pending",
    )
    assert dep is not None
    assert dep["deployment_id"].startswith("deploy-")
    assert dep["status"] == "pending"
    assert dep["container_port"] == 5000

    # Retrieve deployment
    fetched = get_deployment(dep["deployment_id"])
    assert fetched["id"] == dep["id"]
    assert fetched["app_name"] == test_project["name"]

    # Update with live URL
    live_url = "http://13.232.50.60:5000"
    updated = update_deployment(
        dep["deployment_id"],
        status="deployed",
        health_status="healthy",
        app_url=live_url,
    )
    assert updated["status"] == "deployed"
    assert updated["health_status"] == "healthy"
    assert updated["app_url"] == live_url

    # Stats
    stats = get_deployment_stats()
    assert stats["total"] >= 1
    assert stats["successful"] >= 1

    # Cleanup
    assert delete_deployment(dep["deployment_id"]) is True


def test_notification_system(test_project):
    clear_notifications()

    # Create notifications
    n1 = create_notification(
        title="Repository Submitted",
        message="User submitted repository successfully.",
        event_type="repo_submitted",
        status="success",
        project_id=test_project["id"],
    )
    n2 = create_notification(
        title="Application Deployed Successfully",
        message="App is live on AWS ECS Fargate.",
        event_type="deployed_success",
        status="success",
        project_id=test_project["id"],
    )

    all_notifs = get_notifications()
    assert all_notifs["total"] == 2
    assert all_notifs["unread_count"] == 2

    # Mark single read
    mark_notification_read(n1["id"])
    after_one = get_notifications()
    assert after_one["unread_count"] == 1

    # Mark all read
    mark_notification_read(mark_all=True)
    after_all = get_notifications()
    assert after_all["unread_count"] == 0

    # Clear
    clear_notifications()
    assert get_notifications()["total"] == 0


# ============================================================
# 2. API ENDPOINTS TESTS
# ============================================================

def test_deployments_api(client, test_project):
    # Create deployment
    create_res = client.post(
        "/api/deployments",
        json={
            "project_id": test_project["id"],
            "app_name": "API Created App",
            "repository_url": test_project["repository_url"],
            "container_port": 8080,
            "status": "deployed",
            "health_status": "healthy",
            "app_url": "http://13.232.99.1:8080",
        },
    )
    assert create_res.status_code == 201
    dep_id = create_res.get_json()["deployment"]["deployment_id"]

    # List
    list_res = client.get("/api/deployments")
    assert list_res.status_code == 200
    assert any(d["deployment_id"] == dep_id for d in list_res.get_json()["deployments"])

    # Stats
    stats_res = client.get("/api/deployments/stats")
    assert stats_res.status_code == 200
    assert stats_res.get_json()["stats"]["total"] >= 1

    # Get single
    single_res = client.get(f"/api/deployments/{dep_id}")
    assert single_res.status_code == 200
    assert single_res.get_json()["deployment"]["app_url"] == "http://13.232.99.1:8080"

    # Stop deployment
    stop_res = client.post(f"/api/deployments/{dep_id}/stop")
    assert stop_res.status_code == 200
    assert stop_res.get_json()["deployment"]["status"] == "stopped"

    # Delete
    del_res = client.delete(f"/api/deployments/{dep_id}")
    assert del_res.status_code == 200


def test_notifications_api(client, test_project):
    client.delete("/api/notifications")

    create_notification(
        title="Docker Built",
        message="Container built successfully.",
        event_type="docker_built",
        status="success",
        project_id=test_project["id"],
    )

    get_res = client.get("/api/notifications")
    assert get_res.status_code == 200
    data = get_res.get_json()
    assert data["unread_count"] >= 1
    notif_id = data["notifications"][0]["id"]

    # Read single
    read_res = client.put(f"/api/notifications/{notif_id}/read")
    assert read_res.status_code == 200

    # Read all
    read_all_res = client.put("/api/notifications/read-all")
    assert read_all_res.status_code == 200
    assert client.get("/api/notifications").get_json()["unread_count"] == 0

    # Clear
    clear_res = client.delete("/api/notifications")
    assert clear_res.status_code == 200
    assert client.get("/api/notifications").get_json()["count"] == 0


# ============================================================
# 3. AUTHENTICATED CALLBACK UPDATES DEPLOYMENT & LIVE URL
# ============================================================

def test_callback_updates_live_url_and_deployment(client, test_project):
    secret = "test-callback-secret-deploy"

    pipeline = create_pipeline_record(
        name="ECS Deploy Pipeline",
        description="Testing ECS callback",
        branch="main",
        repository_url=test_project["repository_url"],
        project_id=test_project["id"],
        deployment_enabled=True,
    )

    run = save_pipeline_run({
        "id": None,
        "pipeline_id": pipeline["id"],
        "pipeline_name": pipeline["name"],
        "status": "running",
        "started_at": "2026-11-17T10:00:00",
        "completed_at": None,
        "repository_url": test_project["repository_url"],
        "branch": "main",
        "stages": [
            {**stage, "status": "pending", "details": {}}
            for stage in DEFAULT_STAGES
        ],
    })

    # Initial pending deployment
    dep = create_deployment(
        project_id=test_project["id"],
        pipeline_run_id=run["id"],
        app_name=test_project["name"],
        repository_url=test_project["repository_url"],
        status="pending",
    )
    run["deployment_id"] = dep["deployment_id"]
    save_pipeline_run(run)

    headers = {
        "Authorization": f"Bearer {secret}",
        "Content-Type": "application/json",
    }

    live_url = "http://13.232.100.200:5000"

    with patch.dict(os.environ, {"GITHUB_CALLBACK_SECRET": secret}):
        # Send deployment success callback with live URL
        cb_res = client.post(
            f"/api/pipelines/runs/{run['id']}/github-status",
            headers=headers,
            json={
                "stage": "deployment",
                "status": "success",
                "message": "Application deployed successfully to AWS ECS Fargate.",
                "details": {
                    "app_url": live_url,
                    "ecs_service": "devsecops-srv-test",
                    "ecs_cluster": "devsecops-cluster",
                    "container_port": 5000,
                    "health_status": "healthy",
                },
            },
        )
        assert cb_res.status_code == 200

        # Verify pipeline run has the live URL
        run_res = client.get(f"/api/pipelines/runs/{run['id']}")
        run_data = run_res.get_json()["run"]
        assert run_data["app_url"] == live_url

        # Verify deployment record was updated with live URL & healthy status
        updated_dep = get_deployment(dep["deployment_id"])
        assert updated_dep["status"] == "deployed"
        assert updated_dep["health_status"] == "healthy"
        assert updated_dep["app_url"] == live_url

        # Verify persistent notification was generated
        notifs = get_notifications()
        assert any(
            n["event_type"] == "deployed_success" and live_url in n["message"]
            for n in notifs["notifications"]
        )


def test_sync_deployment_transitions_pending_to_failed_when_pipeline_skipped(client, test_project):
    from app.routes.deployments import sync_deployment_status

    pipeline = create_pipeline_record(
        name="Sync Test Pipeline",
        description="Testing sync status",
        branch="main",
        repository_url=test_project["repository_url"],
        project_id=test_project["id"],
        deployment_enabled=True,
    )

    # Pipeline run completed locally where deployment stage was skipped
    run = save_pipeline_run({
        "id": None,
        "pipeline_id": pipeline["id"],
        "pipeline_name": pipeline["name"],
        "status": "success",
        "started_at": "2026-11-17T11:00:00",
        "completed_at": "2026-11-17T11:01:00",
        "repository_url": test_project["repository_url"],
        "branch": "main",
        "github_run_id": None,
        "stages": [
            {
                "id": "deployment",
                "name": "Deployment",
                "status": "skipped",
                "details": {
                    "reason": "Local deployment skipped. Remote AWS ECS Fargate deployment executes via GitHub Actions."
                },
            }
        ],
    })

    dep = create_deployment(
        project_id=test_project["id"],
        pipeline_run_id=run["id"],
        app_name=test_project["name"],
        repository_url=test_project["repository_url"],
        status="pending",
    )

    synced = sync_deployment_status(dep)
    assert synced["status"] == "failed"
    assert synced["health_status"] == "failed"
    assert "Workflow was not dispatched" in synced["error_message"]


def test_sync_deployment_api_endpoint(client, test_project):
    dep = create_deployment(
        project_id=test_project["id"],
        app_name=test_project["name"],
        repository_url=test_project["repository_url"],
        status="pending",
    )

    # Calling the sync endpoint
    res = client.post(f"/api/deployments/{dep['deployment_id']}/sync")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "deployment" in data
