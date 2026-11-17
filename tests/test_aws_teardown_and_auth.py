import os
from unittest.mock import Mock, patch
import pytest
from botocore.exceptions import ClientError

from app import create_app
from app.models import create_project, create_deployment, get_deployment
from app.services.aws_service import AwsService


@pytest.fixture
def app():
    os.environ["FLASK_ENV"] = "testing"
    os.environ["API_KEY"] = "test-secret-token"
    app = create_app()
    app.config["TESTING"] = True
    return app


@pytest.fixture
def client(app):
    return app.test_client()


# ============================================================
# 1. AWS ECS SERVICE STOP & DELETE UNIT TESTS
# ============================================================

def test_aws_service_stop_ecs_service():
    ecs_mock = Mock()
    ecs_mock.update_service.return_value = {"service": {"desiredCount": 0}}
    ecs_mock.list_tasks.return_value = {"taskArns": ["arn:aws:ecs:ap-south-1:123:task/abc"]}
    ecs_mock.stop_task.return_value = {}

    service = AwsService(ecs_client=ecs_mock)
    result = service.stop_ecs_service(cluster_name="devsecops-cluster", service_name="devsecops-srv-1")

    assert result["success"] is True
    assert result["desired_count"] == 0
    assert result["stopped_tasks"] == 1
    ecs_mock.update_service.assert_called_once_with(
        cluster="devsecops-cluster",
        service="devsecops-srv-1",
        desiredCount=0,
    )


def test_aws_service_delete_ecs_service():
    ecs_mock = Mock()
    ecs_mock.update_service.return_value = {}
    ecs_mock.delete_service.return_value = {}

    service = AwsService(ecs_client=ecs_mock)
    result = service.delete_ecs_service(cluster_name="devsecops-cluster", service_name="devsecops-srv-1")

    assert result["success"] is True
    assert result["deleted"] is True
    ecs_mock.delete_service.assert_called_once_with(
        cluster="devsecops-cluster",
        service="devsecops-srv-1",
        force=True,
    )


# ============================================================
# 2. ENDPOINT STOP & DELETE WITH AWS TEARDOWN
# ============================================================

def test_deployment_stop_triggers_aws_teardown(client):
    dep = create_deployment(
        app_name="Teardown App",
        ecs_service="devsecops-srv-test",
        ecs_cluster="devsecops-cluster",
        status="deployed",
    )
    dep_id = dep["deployment_id"]

    ecs_mock = Mock()
    ecs_mock.update_service.return_value = {}
    ecs_mock.list_tasks.return_value = {"taskArns": []}

    with patch("app.routes.deployments.AwsService") as mock_service_cls:
        instance = mock_service_cls.return_value
        instance.stop_ecs_service.return_value = {"success": True}

        res = client.post(f"/api/deployments/{dep_id}/stop")
        assert res.status_code == 200
        instance.stop_ecs_service.assert_called_once_with(
            cluster_name="devsecops-cluster",
            service_name="devsecops-srv-test",
        )
        assert res.get_json()["deployment"]["status"] == "stopped"


def test_deployment_delete_failure_prevents_db_deletion(client):
    dep = create_deployment(
        app_name="Failed Teardown App",
        ecs_service="devsecops-srv-fail",
        ecs_cluster="devsecops-cluster",
        status="deployed",
    )
    dep_id = dep["deployment_id"]

    # Temporarily force production mode to verify strict failure protection
    os.environ["FLASK_ENV"] = "production"
    try:
        with patch("app.routes.deployments.AwsService") as mock_service_cls:
            instance = mock_service_cls.return_value
            instance.delete_ecs_service.side_effect = RuntimeError("AWS ECS delete failed: Access Denied")

            res = client.delete(f"/api/deployments/{dep_id}")
            assert res.status_code == 502
            # Database record MUST still be intact because AWS cleanup failed!
            assert get_deployment(dep_id) is not None
    finally:
        os.environ["FLASK_ENV"] = "testing"


# ============================================================
# 3. API AUTHENTICATION & OWNERSHIP TESTS
# ============================================================

def test_require_auth_enforcement(client):
    os.environ["REQUIRE_AUTH"] = "true"
    try:
        # 1. Missing credentials -> 401
        res = client.get("/api/deployments")
        assert res.status_code == 401
        assert "Unauthorized" in res.get_json()["error"]

        # 2. Invalid credentials -> 401
        res = client.get("/api/deployments", headers={"Authorization": "Bearer bad-token"})
        assert res.status_code == 401

        # 3. Valid API Key -> 200
        res = client.get("/api/deployments", headers={"X-API-Key": "test-secret-token"})
        assert res.status_code == 200
        assert res.get_json()["success"] is True

        # 4. Valid Bearer Token -> 200
        res = client.get("/api/deployments", headers={"Authorization": "Bearer test-secret-token"})
        assert res.status_code == 200
    finally:
        os.environ["REQUIRE_AUTH"] = "false"


# ============================================================
# 4. DOCKER & ECR IMAGES ENDPOINT
# ============================================================

def test_docker_images_endpoint_returns_real_ecr_metadata(client):
    dep = create_deployment(
        app_name="Test Image App",
        image_uri="288418346751.dkr.ecr.ap-south-1.amazonaws.com/devsecops-platform:test-tag-123",
        status="deployed",
    )

    with patch("app.routes.containers.AwsService") as mock_aws:
        instance = mock_aws.return_value
        instance.region = "ap-south-1"
        instance.repository_info.return_value = {
            "name": "devsecops-platform",
            "uri": "288418346751.dkr.ecr.ap-south-1.amazonaws.com/devsecops-platform",
        }
        instance.images.return_value = [{
            "tags": ["test-tag-123"],
            "digest": "sha256:fedcba",
            "image_size": 52428800,  # 50 MB
            "pushed_at": "2026-11-17T12:00:00+00:00",
            "media_type": "application/vnd.docker.distribution.manifest.v2+json",
            "scan_status": "COMPLETE",
            "finding_counts": {"CRITICAL": 0, "HIGH": 1},
        }]

        res = client.get("/api/containers/images")
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        assert len(data["images"]) >= 1

        img = next(i for i in data["images"] if i["tag"] == "test-tag-123")
        assert img["image_name"] == "devsecops-platform"
        assert img["tag"] == "test-tag-123"
        assert img["image_size"] == "50.0 MB"
        assert img["build_status"] == "Pushed Successfully"
        assert img["associated_deployment"] == dep["deployment_id"]
        assert img["registry"] == "AWS ECR"


# ============================================================
# 5. AWS INFRASTRUCTURE OVERVIEW ENDPOINTS
# ============================================================

def test_aws_overview_and_ecs_endpoints(client):
    with patch("app.routes.aws.AwsService") as mock_aws:
        instance = mock_aws.return_value
        instance.cluster = "devsecops-cluster"
        instance.get_aws_overview.return_value = {
            "success": True,
            "connected": True,
            "account_id": "288418346751",
            "region": "ap-south-1",
            "running_tasks": 2,
            "ecs_clusters": ["devsecops-cluster"],
            "ecs_services": [{"service_name": "devsecops-srv-1", "running_count": 1}],
            "cloudwatch_log_groups": [{"name": "/ecs/devsecops-platform"}],
        }
        instance.list_ecs_clusters.return_value = ["devsecops-cluster"]
        instance.list_ecs_services.return_value = [{
            "service_name": "devsecops-srv-1",
            "status": "ACTIVE",
            "running_count": 1,
            "desired_count": 1,
            "task_definition": "arn:aws:ecs:task/1",
        }]
        instance.get_cloudwatch_log_groups.return_value = [{
            "name": "/ecs/devsecops-platform",
            "stored_bytes": 1024,
            "created_at": "2026-11-17T00:00:00+00:00",
        }]

        # 1. Overview
        res_ov = client.get("/api/aws/overview")
        assert res_ov.status_code == 200
        assert res_ov.get_json()["account_id"] == "288418346751"

        # 2. ECS
        res_ecs = client.get("/api/aws/ecs")
        assert res_ecs.status_code == 200
        assert len(res_ecs.get_json()["services"]) == 1

        # 3. CloudWatch
        res_cw = client.get("/api/aws/cloudwatch")
        assert res_cw.status_code == 200
        assert len(res_cw.get_json()["log_groups"]) == 1
