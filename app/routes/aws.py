from flask import Blueprint, jsonify, request

from app.services.aws_service import AwsService
from app.models import get_deployments


aws_bp = Blueprint("aws", __name__, url_prefix="/api/aws")


def _aws_error(error):
    return jsonify({
        "success": False,
        "provider": "AWS",
        "connected": False,
        "error": str(error),
    }), 503


@aws_bp.get("/status")
def aws_status():
    try:
        return jsonify(AwsService().status())
    except Exception as error:
        return _aws_error(error)


@aws_bp.get("/ecr")
def aws_ecr():
    try:
        service = AwsService()
        return jsonify({
            "success": True,
            "provider": "AWS",
            "connected": True,
            "repository": service.repository_info(),
        })
    except Exception as error:
        return _aws_error(error)


@aws_bp.get("/images")
def aws_images():
    try:
        service = AwsService()
        detailed = request.args.get("detailed", "false").lower() in ("true", "1")
        return jsonify({
            "success": True,
            "provider": "AWS",
            "repository": service.repository,
            "images": service.images(detailed=detailed),
        })
    except Exception as error:
        return _aws_error(error)


@aws_bp.get("/overview")
def aws_overview():
    """Return consolidated AWS resource overview (ECR, ECS, CloudWatch, Deployments)."""
    try:
        service = AwsService()
        overview = service.get_aws_overview()
        # Correlate with active database deployments
        active_deployments = [
            d for d in get_deployments()
            if d.get("status") in ("deployed", "running")
        ]
        overview["active_deployments_count"] = len(active_deployments)
        overview["active_deployments"] = active_deployments
        return jsonify(overview)
    except Exception as error:
        return _aws_error(error)


@aws_bp.get("/ecs")
def aws_ecs_details():
    """Return ECS clusters, services, task details, and application endpoints."""
    try:
        service = AwsService()
        cluster = request.args.get("cluster") or service.cluster
        services = service.list_ecs_services(cluster_name=cluster)
        clusters = service.list_ecs_clusters()

        # Augment with deployment metadata from DB
        deployments = get_deployments()
        dep_by_service = {
            d.get("ecs_service"): d
            for d in deployments
            if d.get("ecs_service")
        }

        augmented_services = []
        for s in services:
            svc_name = s.get("service_name")
            matched_dep = dep_by_service.get(svc_name, {})
            augmented_services.append({
                **s,
                "project_id": matched_dep.get("project_id"),
                "app_name": matched_dep.get("app_name", svc_name),
                "app_url": matched_dep.get("app_url"),
                "container_port": matched_dep.get("container_port", 5000),
                "cpu": matched_dep.get("cpu", "256"),
                "memory": matched_dep.get("memory", "512"),
                "health_status": matched_dep.get("health_status", "unknown"),
                "image_uri": matched_dep.get("image_uri"),
            })

        return jsonify({
            "success": True,
            "cluster": cluster,
            "clusters": clusters,
            "services": augmented_services,
            "total_services": len(augmented_services),
            "running_tasks": sum(s.get("running_count", 0) for s in augmented_services),
            "desired_tasks": sum(s.get("desired_count", 0) for s in augmented_services),
        })
    except Exception as error:
        return _aws_error(error)


@aws_bp.get("/cloudwatch")
def aws_cloudwatch():
    """Return CloudWatch log groups for platform and ECS apps."""
    try:
        service = AwsService()
        prefix = request.args.get("prefix", "/ecs")
        groups = service.get_cloudwatch_log_groups(prefix=prefix)
        return jsonify({
            "success": True,
            "log_groups": groups,
            "count": len(groups),
        })
    except Exception as error:
        return _aws_error(error)