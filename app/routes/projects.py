from flask import Blueprint, jsonify, request

from app.models import (
    create_project,
    get_projects,
    get_project,
    update_project,
    delete_project,
)


projects_bp = Blueprint(
    "projects",
    __name__,
    url_prefix="/api/projects",
)


@projects_bp.get("")
def list_projects():
    """Get all projects."""

    projects = get_projects()

    return jsonify({
        "success": True,
        "count": len(projects),
        "projects": projects,
    })


@projects_bp.get("/<int:project_id>")
def project_details(project_id):
    """Get a single project."""

    project = get_project(project_id)

    if project is None:
        return jsonify({
            "success": False,
            "error": "Project not found",
        }), 404

    return jsonify({
        "success": True,
        "project": project,
    })


@projects_bp.post("")
def create_new_project():
    """Create a new project."""

    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()

    if not name:
        return jsonify({
            "success": False,
            "error": "Project name is required",
        }), 400

    description = str(
        data.get("description", "")
    ).strip()

    repository_url = str(
        data.get("repository_url", "")
    ).strip()

    branch = str(
        data.get("branch", "main")
    ).strip() or "main"

    project = create_project(
        name=name,
        description=description,
        repository_url=repository_url,
        branch=branch,
    )

    return jsonify({
        "success": True,
        "message": "Project created successfully",
        "project": project,
    }), 201


@projects_bp.put("/<int:project_id>")
def update_existing_project(project_id):
    """Update a project."""

    existing = get_project(project_id)

    if existing is None:
        return jsonify({
            "success": False,
            "error": "Project not found",
        }), 404

    data = request.get_json(silent=True) or {}

    name = str(
        data.get("name", existing["name"])
    ).strip()

    if not name:
        return jsonify({
            "success": False,
            "error": "Project name is required",
        }), 400

    description = str(
        data.get(
            "description",
            existing["description"] or "",
        )
    ).strip()

    repository_url = str(
        data.get(
            "repository_url",
            existing["repository_url"] or "",
        )
    ).strip()

    branch = str(
        data.get(
            "branch",
            existing["branch"] or "main",
        )
    ).strip() or "main"

    status = str(
        data.get(
            "status",
            existing["status"] or "active",
        )
    ).strip()

    project = update_project(
        project_id=project_id,
        name=name,
        description=description,
        repository_url=repository_url,
        branch=branch,
        status=status,
    )

    return jsonify({
        "success": True,
        "message": "Project updated successfully",
        "project": project,
    })


@projects_bp.delete("/<int:project_id>")
def delete_existing_project(project_id):
    """Delete a project."""

    deleted = delete_project(project_id)

    if not deleted:
        return jsonify({
            "success": False,
            "error": "Project not found",
        }), 404

    return jsonify({
        "success": True,
        "message": "Project deleted successfully",
    })