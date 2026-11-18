from flask import Blueprint, jsonify, request

from app.models import (
    create_project,
    get_projects,
    get_project,
    update_project,
    delete_project,
    create_notification,
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

    app_port = data.get("app_port", 8000)
    try:
        app_port = int(app_port) if app_port else 8000
    except (ValueError, TypeError):
        app_port = 8000

    app_type = str(data.get("app_type", "web")).strip() or "web"
    dockerfile_path = str(data.get("dockerfile_path", "Dockerfile")).strip() or "Dockerfile"
    build_context = str(data.get("build_context", ".")).strip() or "."
    health_check_path = str(data.get("health_check_path", "/")).strip() or "/"
    start_pipeline = bool(data.get("start_pipeline") or data.get("deploy_immediately"))

    # -----------------------------------------------------
    # Create project
    # -----------------------------------------------------

    project = create_project(
        name=name,
        description=description,
        repository_url=repository_url,
        branch=branch,
        source_directory=source_directory,
        app_port=app_port,
        app_type=app_type,
        dockerfile_path=dockerfile_path,
        build_context=build_context,
        health_check_path=health_check_path,
    )

    create_notification(
        title="Repository Submitted Successfully",
        message=f"Repository '{name}' ({repository_url or 'Local'}) was submitted successfully.",
        event_type="repo_submitted",
        status="success",
        project_id=project["id"],
    )

    # Automatically create associated DevSecOps pipeline
    pipeline = None
    run_response = None
    try:
        from app.routes.pipelines import create_pipeline_record, run_pipeline
        pipeline = create_pipeline_record(
            name=f"{name} Pipeline",
            description=f"Automated CI/CD pipeline for {name}",
            branch=branch,
            repository_url=repository_url,
            project_id=project["id"],
            docker_enabled=True,
            registry_enabled=True,
            deployment_enabled=True,
        )

        if start_pipeline and pipeline:
            resp = run_pipeline(pipeline["id"])
            if isinstance(resp, tuple):
                run_response = resp[0].get_json() if hasattr(resp[0], "get_json") else None
            elif hasattr(resp, "get_json"):
                run_response = resp.get_json()
    except Exception as e:
        pass

    return jsonify({
        "success": True,
        "message": "Project created successfully",
        "project": project,
        "pipeline": pipeline,
        "pipeline_run": run_response,
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

    app_port = data.get("app_port")
    app_type = data.get("app_type")
    dockerfile_path = data.get("dockerfile_path")
    build_context = data.get("build_context")
    health_check_path = data.get("health_check_path")

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
        app_port=app_port,
        app_type=app_type,
        dockerfile_path=dockerfile_path,
        build_context=build_context,
        health_check_path=health_check_path,
    )

    return jsonify({
        "success": True,
        "message": "Project updated successfully",
        "project": project,
    })


# =========================================================
# TRIGGER PROJECT PIPELINE (ONE-CLICK DEPLOY)
# =========================================================

@projects_bp.post("/<int:project_id>/deploy")
def deploy_project_pipeline(project_id):
    """Trigger the CI/CD pipeline and AWS deployment for a project."""
    project = get_project(project_id)
    if not project:
        return jsonify({"success": False, "error": "Project not found"}), 404

    from app.routes.pipelines import get_all_pipelines, create_pipeline_record, run_pipeline

    all_pipes = get_all_pipelines()
    project_pipes = [p for p in all_pipes if p.get("project_id") == project_id]

    if project_pipes:
        target_pipe = project_pipes[0]
    else:
        target_pipe = create_pipeline_record(
            name=f"{project['name']} Pipeline",
            description=f"Automated CI/CD pipeline for {project['name']}",
            branch=project.get("branch", "main"),
            repository_url=project.get("repository_url", ""),
            project_id=project_id,
            docker_enabled=True,
            registry_enabled=True,
            deployment_enabled=True,
        )

    return run_pipeline(target_pipe["id"])


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