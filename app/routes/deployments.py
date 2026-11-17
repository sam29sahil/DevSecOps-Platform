from flask import Blueprint, jsonify, request
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

deployments_bp = Blueprint("deployments", __name__, url_prefix="/api/deployments")
notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


# ============================================================
# DEPLOYMENTS ENDPOINTS
# ============================================================

@deployments_bp.get("")
def list_deployments():
    """Retrieve all deployments, optionally filtered by project_id."""
    project_id = request.args.get("project_id", type=int)
    deployments = get_deployments(project_id=project_id)
    return jsonify({
        "success": True,
        "count": len(deployments),
        "deployments": deployments,
    })


@deployments_bp.get("/stats")
def deployment_statistics():
    """Retrieve deployment summary metrics."""
    stats = get_deployment_stats()
    return jsonify({
        "success": True,
        "stats": stats,
    })


@deployments_bp.get("/<identifier>")
def get_single_deployment(identifier):
    """Retrieve details for a single deployment."""
    deployment = get_deployment(identifier)
    if not deployment:
        return jsonify({
            "success": False,
            "error": f"Deployment '{identifier}' not found.",
        }), 404

    return jsonify({
        "success": True,
        "deployment": deployment,
    })


@deployments_bp.post("")
def manual_create_deployment():
    """Create a deployment entry."""
    data = request.get_json(silent=True) or {}
    project_id = data.get("project_id")
    app_name = data.get("app_name") or "Application"

    if project_id:
        project = get_project(project_id)
        if project:
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
    )

    return jsonify({
        "success": True,
        "deployment": dep,
    }), 201


@deployments_bp.post("/<identifier>/stop")
def stop_deployment_endpoint(identifier):
    """Stop a running deployment."""
    deployment = get_deployment(identifier)
    if not deployment:
        return jsonify({
            "success": False,
            "error": f"Deployment '{identifier}' not found.",
        }), 404

    updated = update_deployment(
        identifier,
        status="stopped",
        health_status="stopped",
    )

    create_notification(
        title="Application Stopped",
        message=f"Application {deployment.get('app_name', 'service')} ({deployment.get('deployment_id')}) was stopped.",
        event_type="app_stopped",
        status="warning",
        project_id=deployment.get("project_id"),
        deployment_id=deployment.get("deployment_id"),
    )

    return jsonify({
        "success": True,
        "message": f"Deployment {deployment.get('deployment_id')} stopped.",
        "deployment": updated,
    })


@deployments_bp.delete("/<identifier>")
def delete_deployment_endpoint(identifier):
    """Delete a deployment record."""
    deployment = get_deployment(identifier)
    if not deployment:
        return jsonify({
            "success": False,
            "error": f"Deployment '{identifier}' not found.",
        }), 404

    deleted = delete_deployment(identifier)

    create_notification(
        title="Deployment Record Deleted",
        message=f"Deployment record {deployment.get('deployment_id')} removed.",
        event_type="app_stopped",
        status="info",
        project_id=deployment.get("project_id"),
        deployment_id=deployment.get("deployment_id"),
    )

    return jsonify({
        "success": deleted,
        "message": f"Deployment {identifier} deleted.",
    })


# ============================================================
# NOTIFICATIONS ENDPOINTS
# ============================================================

@notifications_bp.get("")
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
def mark_single_read(notification_id):
    """Mark one notification as read."""
    mark_notification_read(notification_id=notification_id)
    return jsonify({
        "success": True,
        "message": f"Notification {notification_id} marked as read.",
    })


@notifications_bp.put("/read-all")
def mark_all_read():
    """Mark all notifications as read."""
    mark_notification_read(mark_all=True)
    return jsonify({
        "success": True,
        "message": "All notifications marked as read.",
    })


@notifications_bp.delete("")
def clear_all_notifications():
    """Clear all notifications."""
    clear_notifications()
    return jsonify({
        "success": True,
        "message": "All notifications cleared.",
    })
