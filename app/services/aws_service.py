import os
from datetime import datetime, timezone
import boto3
from botocore.exceptions import ClientError, NoCredentialsError

DEFAULT_REGION = "ap-south-1"
DEFAULT_REPOSITORY = "devsecops-platform"
DEFAULT_CLUSTER = "devsecops-cluster"


class AwsService:
    def __init__(
        self,
        client=None,
        ecs_client=None,
        logs_client=None,
        ec2_client=None,
        region=None,
        repository=None,
        cluster=None,
    ):
        self.region = region or os.getenv("AWS_REGION", DEFAULT_REGION)
        self.repository = repository or os.getenv(
            "AWS_ECR_REPOSITORY",
            os.getenv("ECR_REPOSITORY", DEFAULT_REPOSITORY),
        )
        self.cluster = cluster or os.getenv(
            "AWS_ECS_CLUSTER",
            DEFAULT_CLUSTER,
        )
        self.client = client or boto3.client(
            "ecr", region_name=self.region
        )
        self._ecs_client = ecs_client
        self._logs_client = logs_client
        self._ec2_client = ec2_client

    @property
    def ecs_client(self):
        if self._ecs_client is None:
            self._ecs_client = boto3.client("ecs", region_name=self.region)
        return self._ecs_client

    @property
    def ec2_client(self):
        if self._ec2_client is None:
            self._ec2_client = boto3.client("ec2", region_name=self.region)
        return self._ec2_client

    @property
    def logs_client(self):
        if self._logs_client is None:
            self._logs_client = boto3.client("logs", region_name=self.region)
        return self._logs_client

    def status(self):
        self.client.describe_repositories(
            repositoryNames=[self.repository]
        )
        identity = boto3.client(
            "sts", region_name=self.region
        ).get_caller_identity()
        return {
            "success": True,
            "provider": "AWS",
            "connected": True,
            "account_id": identity.get("Account"),
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
            "arn": repository.get("repositoryArn"),
            "region": self.region,
            "image_count": len(images),
            "created_at": _serialize_datetime(repository.get("createdAt")),
            "scan_on_push": (
                repository.get("imageScanningConfiguration", {})
                .get("scanOnPush")
            ),
            "encryption": repository.get("encryptionConfiguration", {}),
            "latest_image": serialize_image(latest) if latest else None,
        }

    def images(self, detailed=False):
        response = self.client.describe_images(
            repositoryName=self.repository,
            filter={"tagStatus": "TAGGED"},
        )
        image_details = response.get("imageDetails", [])
        if not isinstance(image_details, list):
            raise ValueError("AWS returned an invalid ECR image response.")

        return [serialize_image(image, include_details=detailed) for image in image_details]

    # ========================================================
    # ECS OPERATIONS (MANAGEMENT & TEARDOWN)
    # ========================================================

    def stop_ecs_service(self, cluster_name=None, service_name=None):
        """Update ECS service desiredCount to 0 and terminate running tasks."""
        cluster = cluster_name or self.cluster
        if not service_name:
            raise ValueError("Service name is required to stop an ECS service.")

        try:
            update_resp = self.ecs_client.update_service(
                cluster=cluster,
                service=service_name,
                desiredCount=0,
            )
            # Find and stop running tasks for immediate termination
            tasks_resp = self.ecs_client.list_tasks(
                cluster=cluster,
                serviceName=service_name,
                desiredStatus="RUNNING",
            )
            stopped_task_count = 0
            for task_arn in tasks_resp.get("taskArns", []):
                try:
                    self.ecs_client.stop_task(
                        cluster=cluster,
                        task=task_arn,
                        reason="Deployment stopped by user via DevSecOps Platform",
                    )
                    stopped_task_count += 1
                except Exception:
                    pass

            return {
                "success": True,
                "cluster": cluster,
                "service": service_name,
                "desired_count": 0,
                "stopped_tasks": stopped_task_count,
                "status": "stopped",
            }
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code")
            if code in ("ServiceNotFoundException", "ClusterNotFoundException"):
                return {
                    "success": True,
                    "cluster": cluster,
                    "service": service_name,
                    "desired_count": 0,
                    "stopped_tasks": 0,
                    "status": "stopped",
                    "note": f"Service or cluster did not exist on AWS: {code}",
                }
            raise

    def delete_ecs_service(self, cluster_name=None, service_name=None, force=True):
        """Scale down and delete an ECS service from AWS."""
        cluster = cluster_name or self.cluster
        if not service_name:
            raise ValueError("Service name is required to delete an ECS service.")

        try:
            # 1. First set desiredCount to 0
            try:
                self.ecs_client.update_service(
                    cluster=cluster,
                    service=service_name,
                    desiredCount=0,
                )
            except Exception:
                pass

            # 2. Delete the service
            self.ecs_client.delete_service(
                cluster=cluster,
                service=service_name,
                force=force,
            )
            return {
                "success": True,
                "cluster": cluster,
                "service": service_name,
                "deleted": True,
            }
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code")
            if code in ("ServiceNotFoundException", "ClusterNotFoundException"):
                return {
                    "success": True,
                    "cluster": cluster,
                    "service": service_name,
                    "deleted": True,
                    "note": f"Resource did not exist on AWS ({code})",
                }
            raise

    def describe_ecs_service(self, cluster_name=None, service_name=None):
        """Get details of a specific ECS service."""
        cluster = cluster_name or self.cluster
        if not service_name:
            return None

        try:
            resp = self.ecs_client.describe_services(
                cluster=cluster,
                services=[service_name],
            )
            services = resp.get("services", [])
            if not services:
                return None

            svc = services[0]
            return {
                "service_name": svc.get("serviceName"),
                "service_arn": svc.get("serviceArn"),
                "status": svc.get("status"),
                "desired_count": svc.get("desiredCount", 0),
                "running_count": svc.get("runningCount", 0),
                "pending_count": svc.get("pendingCount", 0),
                "task_definition": svc.get("taskDefinition"),
                "created_at": _serialize_datetime(svc.get("createdAt")),
                "launch_type": svc.get("launchType", "FARGATE"),
            }
        except ClientError:
            return None

    def get_ecs_service_public_ip(self, cluster_name=None, service_name=None):
        """Retrieve the public IPv4 address associated with a running task of an ECS service."""
        cluster = cluster_name or self.cluster
        if not service_name:
            return None
        try:
            tasks_resp = self.ecs_client.list_tasks(
                cluster=cluster,
                serviceName=service_name,
                desiredStatus="RUNNING",
            )
            task_arns = tasks_resp.get("taskArns", [])
            if not task_arns:
                return None

            tasks_desc = self.ecs_client.describe_tasks(
                cluster=cluster,
                tasks=task_arns[:5],
            ).get("tasks", [])

            for task in tasks_desc:
                for attachment in task.get("attachments", []):
                    for detail in attachment.get("details", []):
                        if detail.get("name") == "networkInterfaceId":
                            eni_id = detail.get("value")
                            if eni_id:
                                eni_resp = self.ec2_client.describe_network_interfaces(
                                    NetworkInterfaceIds=[eni_id]
                                )
                                enis = eni_resp.get("NetworkInterfaces", [])
                                if enis:
                                    ip = enis[0].get("Association", {}).get("PublicIp")
                                    if ip:
                                        return ip
            return None
        except Exception:
            return None

    def list_ecs_clusters(self):
        """List active ECS clusters."""
        try:
            resp = self.ecs_client.list_clusters()
            return [arn.split("/")[-1] for arn in resp.get("clusterArns", [])]
        except Exception:
            return [self.cluster]

    def list_ecs_services(self, cluster_name=None):
        """List all services in an ECS cluster with descriptive details."""
        cluster = cluster_name or self.cluster
        try:
            list_resp = self.ecs_client.list_services(cluster=cluster, maxResults=50)
            service_arns = list_resp.get("serviceArns", [])
            if not service_arns:
                return []

            desc_resp = self.ecs_client.describe_services(
                cluster=cluster,
                services=service_arns[:10],
            )
            services_info = []
            for s in desc_resp.get("services", []):
                services_info.append({
                    "cluster": cluster,
                    "service_name": s.get("serviceName"),
                    "service_arn": s.get("serviceArn"),
                    "status": s.get("status"),
                    "desired_count": s.get("desiredCount", 0),
                    "running_count": s.get("runningCount", 0),
                    "pending_count": s.get("pendingCount", 0),
                    "task_definition": s.get("taskDefinition"),
                    "created_at": _serialize_datetime(s.get("createdAt")),
                    "launch_type": s.get("launchType", "FARGATE"),
                })
            return services_info
        except Exception:
            return []

    def get_cloudwatch_log_groups(self, prefix="/ecs"):
        """List CloudWatch log groups for the platform and apps."""
        try:
            resp = self.logs_client.describe_log_groups(
                logGroupNamePrefix=prefix,
                limit=20,
            )
            return [
                {
                    "name": g.get("logGroupName"),
                    "arn": g.get("arn"),
                    "stored_bytes": g.get("storedBytes", 0),
                    "created_at": _serialize_datetime(
                        datetime.fromtimestamp(g.get("creationTime", 0) / 1000.0, tz=timezone.utc)
                    ) if g.get("creationTime") else None,
                }
                for g in resp.get("logGroups", [])
            ]
        except Exception:
            return []

    def get_aws_overview(self):
        """Compile a full overview of AWS resources across ECR, ECS, CloudWatch, and STS."""
        identity = {}
        try:
            identity = boto3.client("sts", region_name=self.region).get_caller_identity()
        except Exception:
            pass

        account_id = identity.get("Account") or os.getenv("AWS_ACCOUNT_ID", "288418346751")

        repo_info = None
        try:
            repo_info = self.repository_info()
        except Exception:
            pass

        clusters = self.list_ecs_clusters()
        services = self.list_ecs_services(self.cluster)
        running_tasks = sum(s.get("running_count", 0) for s in services)
        log_groups = self.get_cloudwatch_log_groups()

        return {
            "success": True,
            "connected": bool(identity),
            "account_id": account_id,
            "region": self.region,
            "ecr_repository": repo_info,
            "ecs_clusters": clusters,
            "ecs_services": services,
            "running_tasks": running_tasks,
            "stopped_tasks": 0,
            "cloudwatch_log_groups": log_groups,
        }


def _serialize_datetime(value):
    return value.isoformat() if isinstance(value, datetime) else None


def serialize_image(image, include_details=False):
    if not isinstance(image, dict):
        raise ValueError("AWS returned an invalid ECR image item.")

    data = {
        "tags": image.get("imageTags") or [],
        "digest": image.get("imageDigest"),
        "image_size": image.get("imageSizeInBytes"),
        "pushed_at": _serialize_datetime(image.get("imagePushedAt")),
        "media_type": image.get("imageManifestMediaType"),
    }
    if include_details:
        scan_findings = image.get("imageScanFindingsSummary", {})
        data["scan_status"] = image.get("imageScanStatus", {}).get("status", "COMPLETE")
        data["finding_counts"] = scan_findings.get("findingCounts", {})
    return data