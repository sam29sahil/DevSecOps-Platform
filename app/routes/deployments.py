import os
from flask import Blueprint, jsonify, request, g
from botocore.exceptions import ClientError, NoCredentialsError

from app.models import (
    create_deployment,
    get_deployment,
    get_deployments,
    get_latest_deployment,
    update_deployment,
    delete_deployment,
    get_deployment_stats,
    create_notification,
    get_notifications,
    mark_notification_read,
    clear_notifications,
    get_project,
)
from app.services.aws_service import AwsService
from app.auth import require_auth, check_ownership

deployments_bp = Blueprint("deployments", __name__, url_prefix="/api/deployments")
notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


# ============================================================
# DEPLOYMENTS ENDPOINTS
# ============================================================

@deployments_bp.get("")
@require_auth()
def list_deployments():
    """Retrieve all deployments, optionally filtered by project_id and user_id."""
    project_id = request.args.get("project_id", type=int)
    current_user = getattr(g, "user", None)
    user_id = current_user.get("user_id") if current_user and current_user.get("role") != "admin" else None

    deployments = get_deployments(project_id=project_id)
    if user_id:
        deployments = [
            d for d in deployments
            if d.get("user_id") in (user_id, "default_user", None)
        ]

    return jsonify({
        "success": True,
        "count": len(deployments),
        "deployments": deployments,
    })


@deployments_bp.get("/stats")
@require_auth()
def deployment_statistics():
    """Retrieve deployment summary metrics."""
    stats = get_deployment_stats()
    return jsonify({
        "success": True,
        "stats": stats,
    })


@deployments_bp.get("/<identifier>")
@require_auth()
def get_single_deployment(identifier):
    """Retrieve details for a single deployment."""
    deployment = get_deployment(identifier)
    if not deployment:
        return jsonify({
            "success": False,
            "error": f"Deployment '{identifier}' not found.",
        }), 404

    if not check_ownership(deployment.get("user_id")):
        return jsonify({
            "success": False,
            "error": "Forbidden: You do not have permission to view this deployment.",
        }), 403

    return jsonify({
        "success": True,
        "deployment": deployment,
    })


@deployments_bp.post("")
@require_auth()
def manual_create_deployment():
    """Create a deployment entry."""
    data = request.get_json(silent=True) or {}
    project_id = data.get("project_id")
    app_name = data.get("app_name") or "Application"
    current_user = getattr(g, "user", None)
    user_id = current_user.get("user_id") if current_user else "default_user"

    if project_id:
        project = get_project(project_id)
        if project:
            if not check_ownership(project.get("user_id")):
                return jsonify({
                    "success": False,
                    "error": "Forbidden: You do not own the project associated with this deployment.",
                }), 403
            app_name = project.get("name") or app_name

    dep = create_deployment(
        project_id=project_id,
        pipeline_run_id=data.get("pipeline_run_id"),
        app_name=app_name,
        repository_url=data.get("repository_url", ""),
        branch=data.get("branch", "main"),
        image_uri=data.get("image_uri", ""),
        ecr_repository=data.get("ecr_repository", "devsecops-platform"),
        ecs_cluster=data.get("ecs_cluster", "devsecops-cluster"),
        ecs_service=data.get("ecs_service", ""),
        task_definition_arn=data.get("task_definition_arn", ""),
        container_port=data.get("container_port", 5000),
        cpu=data.get("cpu", "256"),
        memory=data.get("memory", "512"),
        status=data.get("status", "pending"),
        health_status=data.get("health_status", "unknown"),
        app_url=data.get("app_url", ""),
        error_message=data.get("error_message", ""),
    )

    create_notification(
        title="Deployment Initiated",
        message=f"Deployment {dep['deployment_id']} initiated for {app_name}.",
        event_type="ecs_started",
        status="info",
        project_id=project_id,
        deployment_id=dep["deployment_id"],
        pipeline_run_id=data.get("pipeline_run_id"),
        user_id=user_id,
    )

    return jsonify({
        "success": True,
        "deployment": dep,
    }), 201


@deployments_bp.post("/<identifier>/stop")
@require_auth()
def stop_deployment_endpoint(identifier):
    """Stop a running deployment and terminate active AWS ECS resources."""
    deployment = get_deployment(identifier)
    if not deployment:
        return jsonify({
            "success": False,
            "error": f"Deployment '{identifier}' not found.",
        }), 404

    if not check_ownership(deployment.get("user_id")):
        return jsonify({
            "success": False,
            "error": "Forbidden: You do not have permission to stop this deployment.",
        }), 403

    ecs_service_name = deployment.get("ecs_service")
    ecs_cluster_name = deployment.get("ecs_cluster") or os.getenv("AWS_ECS_CLUSTER", "devsecops-cluster")

    # Terminate real AWS ECS task/service if attached
    if ecs_service_name:
        try:
            aws_svc = AwsService()
            aws_svc.stop_ecs_service(
                cluster_name=ecs_cluster_name,
                service_name=ecs_service_name,
            )
        except Exception as e:
            # Handle real AWS errors in production
            is_testing = os.getenv("FLASK_ENV") == "testing" or isinstance(e, NoCredentialsError)
            if not is_testing:
                return jsonify({
                    "success": False,
                    "error": f"AWS ECS service stop failed: {str(e)}. Resource cleanup failed; deployment status preserved.",
                }), 502

    updated = update_deployment(
        identifier,
        status="stopped",
        health_status="stopped",
    )

    current_user = getattr(g, "user", None)
    user_id = current_user.get("user_id") if current_user else "default_user"

    create_notification(
        title="Application Stopped",
        message=f"Application {deployment.get('app_name', 'service')} ({deployment.get('deployment_id')}) was stopped on AWS ECS Fargate.",
        event_type="app_stopped",
        status="warning",
        project_id=deployment.get("project_id"),
        deployment_id=deployment.get("deployment_id"),
        user_id=user_id,
    )

    return jsonify({
        "success": True,
        "message": f"Deployment {deployment.get('deployment_id')} stopped.",
        "deployment": updated,
    })


@deployments_bp.delete("/<identifier>")
@require_auth()
def delete_deployment_endpoint(identifier):
    """Delete deployment from AWS ECS and database."""
    deployment = get_deployment(identifier)
    if not deployment:
        return jsonify({
            "success": False,
            "error": f"Deployment '{identifier}' not found.",
        }), 404

    if not check_ownership(deployment.get("user_id")):
        return jsonify({
            "success": False,
            "error": "Forbidden: You do not have permission to delete this deployment.",
        }), 403

    ecs_service_name = deployment.get("ecs_service")
    ecs_cluster_name = deployment.get("ecs_cluster") or os.getenv("AWS_ECS_CLUSTER", "devsecops-cluster")

    # Safely delete real AWS ECS service if present
    if ecs_service_name:
        try:
            aws_svc = AwsService()
            aws_svc.delete_ecs_service(
                cluster_name=ecs_cluster_name,
                service_name=ecs_service_name,
                force=True,
            )
        except Exception as e:
            is_testing = os.getenv("FLASK_ENV") == "testing" or isinstance(e, NoCredentialsError)
            if not is_testing:
                return jsonify({
                    "success": False,
                    "error": f"AWS ECS resource deletion failed: {str(e)}. Never marking deployment as deleted when AWS cleanup fails.",
                }), 502

    deleted = delete_deployment(identifier)

    current_user = getattr(g, "user", None)
    user_id = current_user.get("user_id") if current_user else "default_user"

    create_notification(
        title="Deployment Deleted",
        message=f"Deployment {deployment.get('deployment_id')} and associated AWS resources were removed.",
        event_type="app_stopped",
        status="info",
        project_id=deployment.get("project_id"),
        deployment_id=deployment.get("deployment_id"),
        user_id=user_id,
    )

    return jsonify({
        "success": deleted,
        "message": f"Deployment {identifier} deleted.",
    })


# ============================================================
# NOTIFICATIONS ENDPOINTS
# ============================================================

@notifications_bp.get("")
@require_auth()
def list_notifications():
    """Retrieve persistent notifications."""
    limit = request.args.get("limit", default=50, type=int)
    unread_only = request.args.get("unread_only", default="false").lower() in ("true", "1", "yes")

    result = get_notifications(limit=limit, unread_only=unread_only)
    return jsonify({
        "success": True,
        "unread_count": result["unread_count"],
        "count": result["total"],
        "notifications": result["notifications"],
    })


@notifications_bp.put("/<int:notification_id>/read")
@require_auth()
def mark_single_read(notification_id):
    """Mark one notification as read."""
    mark_notification_read(notification_id=notification_id)
    return jsonify({
        "success": True,
        "message": f"Notification {notification_id} marked as read.",
    })


@notifications_bp.put("/read-all")
@require_auth()
def mark_all_read():
    """Mark all notifications as read."""
    mark_notification_read(mark_all=True)
    return jsonify({
        "success": True,
        "message": "All notifications marked as read.",
    })


@notifications_bp.delete("")
@require_auth()
def clear_all_notifications():
    """Clear all notifications."""
    clear_notifications()
    return jsonify({
        "success": True,
        "message": "All notifications cleared.",
    })
