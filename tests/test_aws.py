from datetime import datetime, timezone
from unittest.mock import Mock, patch

import pytest
from botocore.exceptions import ClientError, NoCredentialsError

from app import create_app
from app.services.aws_service import AwsService


@pytest.fixture
def ecr_client():
    client = Mock()
    client.describe_repositories.return_value = {
        "repositories": [{
            "repositoryName": "devsecops-platform",
            "repositoryUri": "288418346751.dkr.ecr.ap-south-1.amazonaws.com/devsecops-platform",
            "repositoryArn": "arn:aws:ecr:ap-south-1:288418346751:repository/devsecops-platform",
            "createdAt": datetime(2026, 1, 1, tzinfo=timezone.utc),
            "imageScanningConfiguration": {"scanOnPush": True},
            "encryptionConfiguration": {"encryptionType": "AES256"},
        }]
    }
    client.describe_images.return_value = {
        "imageDetails": [{
            "imageTags": ["latest"],
            "imageDigest": "sha256:abc",
            "imageSizeInBytes": 123,
            "imagePushedAt": datetime(2026, 2, 1, tzinfo=timezone.utc),
            "imageManifestMediaType": "application/vnd.oci.image.manifest.v1+json",
        }]
    }
    return client


def test_status_success(ecr_client):
    sts_client = Mock()
    sts_client.get_caller_identity.return_value = {"Account": "288418346751"}

    with patch("app.services.aws_service.boto3.client", return_value=sts_client):
        result = AwsService(client=ecr_client).status()

    assert result["connected"] is True
    assert result["account_id"] == "288418346751"
    assert result["region"] == "ap-south-1"


def test_status_failure(ecr_client):
    ecr_client.describe_repositories.side_effect = NoCredentialsError()

    with pytest.raises(NoCredentialsError):
        AwsService(client=ecr_client).status()


def test_repository_metadata_and_latest_image(ecr_client):
    repository = AwsService(client=ecr_client).repository_info()

    assert repository["name"] == "devsecops-platform"
    assert repository["arn"].endswith("devsecops-platform")
    assert repository["scan_on_push"] is True
    assert repository["latest_image"]["tags"] == ["latest"]
    assert repository["latest_image"]["image_size"] == 123


def test_images_return_real_image_fields(ecr_client):
    images = AwsService(client=ecr_client).images()

    assert images == [{
        "tags": ["latest"],
        "digest": "sha256:abc",
        "image_size": 123,
        "pushed_at": "2026-02-01T00:00:00+00:00",
        "media_type": "application/vnd.oci.image.manifest.v1+json",
    }]


def test_invalid_response_is_rejected(ecr_client):
    ecr_client.describe_images.return_value = {"imageDetails": None}

    with pytest.raises(ValueError):
        AwsService(client=ecr_client).images()


def test_aws_routes_handle_credentials_and_api_errors():
    app = create_app()
    client = app.test_client()

    with patch("app.routes.aws.AwsService", side_effect=NoCredentialsError()):
        response = client.get("/api/aws/status")

    assert response.status_code == 503
    assert response.get_json()["connected"] is False

    with patch(
        "app.routes.aws.AwsService",
        side_effect=ClientError(
            {"Error": {"Code": "AccessDeniedException", "Message": "denied"}},
            "DescribeRepositories",
        ),
    ):
        response = client.get("/api/aws/ecr")

    assert response.status_code == 503
    assert response.get_json()["success"] is False


def test_aws_routes_return_mocked_ecr_data(ecr_client):
    app = create_app()
    client = app.test_client()
    service = AwsService(client=ecr_client)

    with patch("app.routes.aws.AwsService", return_value=service):
        ecr_response = client.get("/api/aws/ecr")
        images_response = client.get("/api/aws/images")

    assert ecr_response.status_code == 200
    assert ecr_response.get_json()["repository"]["name"] == "devsecops-platform"
    assert images_response.status_code == 200
    assert images_response.get_json()["images"][0]["digest"] == "sha256:abc"
