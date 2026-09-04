import os
from datetime import datetime, timezone

import boto3


DEFAULT_REGION = "ap-south-1"
DEFAULT_REPOSITORY = "devsecops-platform"


class AwsService:
    def __init__(self, client=None, region=None, repository=None):
        self.region = region or os.getenv("AWS_REGION", DEFAULT_REGION)
        self.repository = repository or os.getenv(
            "ECR_REPOSITORY", DEFAULT_REPOSITORY
        )
        self.client = client or boto3.client(
            "ecr", region_name=self.region
        )

    def status(self):
        self.client.describe_repositories(
            repositoryNames=[self.repository]
        )
        return {
            "success": True,
            "provider": "AWS",
            "connected": True,
            "region": self.region,
        }

    def repository_info(self):
        response = self.client.describe_repositories(
            repositoryNames=[self.repository]
        )
        repository = response.get("repositories", [None])[0]
        if not isinstance(repository, dict):
            raise ValueError("AWS returned an invalid ECR repository response.")

        images_response = self.client.describe_images(
            repositoryName=self.repository,
            filter={"tagStatus": "TAGGED"},
        )
        images = images_response.get("imageDetails", [])
        if not isinstance(images, list):
            raise ValueError("AWS returned an invalid ECR image response.")

        latest = max(
            images,
            key=lambda image: image.get("imagePushedAt") or datetime.min.replace(
                tzinfo=timezone.utc
            ),
            default=None,
        )

        return {
            "name": repository.get("repositoryName"),
            "uri": repository.get("repositoryUri"),
            "region": self.region,
            "image_count": len(images),
            "created_at": _serialize_datetime(repository.get("createdAt")),
            "latest_image": serialize_image(latest) if latest else None,
        }

    def images(self):
        response = self.client.describe_images(
            repositoryName=self.repository,
            filter={"tagStatus": "TAGGED"},
        )
        image_details = response.get("imageDetails", [])
        if not isinstance(image_details, list):
            raise ValueError("AWS returned an invalid ECR image response.")

        return [serialize_image(image) for image in image_details]


def _serialize_datetime(value):
    return value.isoformat() if isinstance(value, datetime) else None


def serialize_image(image):
    if not isinstance(image, dict):
        raise ValueError("AWS returned an invalid ECR image item.")

    return {
        "tags": image.get("imageTags") or [],
        "digest": image.get("imageDigest"),
        "size": image.get("imageSizeInBytes"),
        "pushed_at": _serialize_datetime(image.get("imagePushedAt")),
    }