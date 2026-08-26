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


# =========================================================
# GET ALL PROJECTS
# =========================================================

@projects_bp.get("")
def list_projects():
    """Get all projects."""

    projects = get_projects()

    return jsonify({
        "success": True,
        "count": len(projects),
        "projects": projects,
    })


# =========================================================
# GET SINGLE PROJECT
# =========================================================

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


# =========================================================
# CREATE PROJECT
# =========================================================

@projects_bp.post("")
def create_new_project():
    """Create a new project."""

    data = request.get_json(silent=True) or {}

    # -----------------------------------------------------
    # Basic project information
    # -----------------------------------------------------

    name = str(
        data.get("name", "")
    ).strip()

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

    # -----------------------------------------------------
    # Source directory
    #
    # "." means the root of the repository/project.
    # -----------------------------------------------------

    source_directory = str(
        data.get("source_directory", ".")
    ).strip() or "."

    # -----------------------------------------------------
    # Create project
    # -----------------------------------------------------

    project = create_project(
        name=name,
        description=description,
        repository_url=repository_url,
        branch=branch,
        source_directory=source_directory,
    )

    return jsonify({
        "success": True,
        "message": "Project created successfully",
        "project": project,
    }), 201


# =========================================================
# UPDATE PROJECT
# =========================================================

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

    # -----------------------------------------------------
    # Name
    # -----------------------------------------------------

    name = str(
        data.get(
            "name",
            existing.get("name", ""),
        )
    ).strip()

    if not name:
        return jsonify({
            "success": False,
            "error": "Project name is required",
        }), 400

    # -----------------------------------------------------
    # Description
    # -----------------------------------------------------

    description = str(
        data.get(
            "description",
            existing.get("description", "") or "",
        )
    ).strip()

    # -----------------------------------------------------
    # Repository URL
    # -----------------------------------------------------

    repository_url = str(
        data.get(
            "repository_url",
            existing.get("repository_url", "") or "",
        )
    ).strip()

    # -----------------------------------------------------
    # Branch
    # -----------------------------------------------------

    branch = str(
        data.get(
            "branch",
            existing.get("branch", "main") or "main",
        )
    ).strip() or "main"

    # -----------------------------------------------------
    # Source directory
    #
    # Existing projects that don't have this value get ".".
    # -----------------------------------------------------

    source_directory = str(
        data.get(
            "source_directory",
            existing.get("source_directory", ".") or ".",
        )
    ).strip() or "."

    # -----------------------------------------------------
    # Status
    # -----------------------------------------------------

    status = str(
        data.get(
            "status",
            existing.get("status", "active") or "active",
        )
    ).strip() or "active"

    # -----------------------------------------------------
    # Update project
    # -----------------------------------------------------

    project = update_project(
        project_id=project_id,
        name=name,
        description=description,
        repository_url=repository_url,
        branch=branch,
        source_directory=source_directory,
        status=status,
    )

    return jsonify({
        "success": True,
        "message": "Project updated successfully",
        "project": project,
    })


# =========================================================
# DELETE PROJECT
# =========================================================

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