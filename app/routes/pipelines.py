from datetime import datetime

from flask import Blueprint, jsonify, request

from app.models import (
    create_finding,
    create_scan,
    get_findings,
    get_project,
    update_scan,
)

from app.scanners.code_scanner import CodeScanner


pipelines_bp = Blueprint(
    "pipelines",
    __name__,
    url_prefix="/api/pipelines",
)


# ==========================================================
# IN-MEMORY PIPELINE STORAGE
# ==========================================================

pipelines = []

_next_pipeline_id = 1


def create_pipeline_record(
    name,
    description="",
    branch="main",
    repository_url="",
    project_id=None,
):
    global _next_pipeline_id

    now = datetime.utcnow().isoformat()

    pipeline = {
        "id": _next_pipeline_id,
        "name": name,
        "description": description,
        "branch": branch,
        "repository_url": repository_url,
        "project_id": project_id,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "last_run": None,
        "last_scan_id": None,
        "last_scan_status": None,
        "last_security_score": None,
        "last_files_scanned": 0,
        "last_findings": 0,
        "last_error": None,
    }

    _next_pipeline_id += 1

    pipelines.append(pipeline)

    return pipeline


def find_pipeline(pipeline_id):
    return next(
        (
            pipeline
            for pipeline in pipelines
            if pipeline["id"] == pipeline_id
        ),
        None,
    )


def calculate_security_score(findings):
    """
    Calculate the security score using the same
    basic scoring model used by the scan system.
    """

    deductions = {
        "CRITICAL": 25,
        "HIGH": 15,
        "MEDIUM": 7,
        "LOW": 3,
    }

    score = 100

    for finding in findings:
        severity = str(
            finding.get("severity", "LOW")
        ).upper()

        score -= deductions.get(
            severity,
            1,
        )

    return max(
        0,
        min(100, score),
    )


# ==========================================================
# GET ALL PIPELINES
# ==========================================================

@pipelines_bp.get("")
def list_pipelines():
    """
    Return all pipelines.
    """

    return jsonify({
        "success": True,
        "count": len(pipelines),
        "pipelines": pipelines,
    })


# ==========================================================
# GET SINGLE PIPELINE
# ==========================================================

@pipelines_bp.get("/<int:pipeline_id>")
def pipeline_details(pipeline_id):
    """
    Return one pipeline.
    """

    pipeline = find_pipeline(pipeline_id)

    if pipeline is None:
        return jsonify({
            "success": False,
            "error": "Pipeline not found.",
        }), 404

    return jsonify({
        "success": True,
        "pipeline": pipeline,
    })


# ==========================================================
# CREATE PIPELINE
# ==========================================================

@pipelines_bp.post("")
def create_pipeline():
    """
    Create a new pipeline.
    """

    data = request.get_json(silent=True) or {}

    name = str(
        data.get("name", "")
    ).strip()

    if not name:
        return jsonify({
            "success": False,
            "error": "Pipeline name is required.",
        }), 400

    description = str(
        data.get("description", "")
    ).strip()

    branch = str(
        data.get("branch", "main")
    ).strip() or "main"

    repository_url = str(
        data.get("repository_url", "")
    ).strip()

    project_id = data.get("project_id")

    try:
        if project_id is not None:
            project_id = int(project_id)

    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "error": "project_id must be an integer.",
        }), 400

    if project_id is not None:

        project = get_project(project_id)

        if project is None:
            return jsonify({
                "success": False,
                "error": "Project not found.",
            }), 404

    pipeline = create_pipeline_record(
        name=name,
        description=description,
        branch=branch,
        repository_url=repository_url,
        project_id=project_id,
    )

    return jsonify({
        "success": True,
        "message": "Pipeline created successfully.",
        "pipeline": pipeline,
    }), 201


# ==========================================================
# UPDATE PIPELINE
# ==========================================================

@pipelines_bp.put("/<int:pipeline_id>")
def update_pipeline(pipeline_id):
    """
    Update an existing pipeline.
    """

    pipeline = find_pipeline(pipeline_id)

    if pipeline is None:
        return jsonify({
            "success": False,
            "error": "Pipeline not found.",
        }), 404

    data = request.get_json(silent=True) or {}

    if "name" in data:

        name = str(
            data["name"]
        ).strip()

        if not name:
            return jsonify({
                "success": False,
                "error": "Pipeline name cannot be empty.",
            }), 400

        pipeline["name"] = name

    if "description" in data:

        pipeline["description"] = str(
            data["description"]
        ).strip()

    if "branch" in data:

        pipeline["branch"] = (
            str(data["branch"]).strip()
            or "main"
        )

    if "repository_url" in data:

        pipeline["repository_url"] = str(
            data["repository_url"]
        ).strip()

    if "project_id" in data:

        try:

            pipeline["project_id"] = (
                int(data["project_id"])
                if data["project_id"] is not None
                else None
            )

        except (TypeError, ValueError):

            return jsonify({
                "success": False,
                "error": "project_id must be an integer.",
            }), 400

        if pipeline["project_id"] is not None:

            project = get_project(
                pipeline["project_id"]
            )

            if project is None:
                return jsonify({
                    "success": False,
                    "error": "Project not found.",
                }), 404

    if "status" in data:

        pipeline["status"] = str(
            data["status"]
        ).strip().lower()

    pipeline["updated_at"] = (
        datetime.utcnow().isoformat()
    )

    return jsonify({
        "success": True,
        "message": "Pipeline updated successfully.",
        "pipeline": pipeline,
    })


# ==========================================================
# DELETE PIPELINE
# ==========================================================

@pipelines_bp.delete("/<int:pipeline_id>")
def delete_pipeline(pipeline_id):
    """
    Delete a pipeline.
    """

    global pipelines

    pipeline = find_pipeline(pipeline_id)

    if pipeline is None:
        return jsonify({
            "success": False,
            "error": "Pipeline not found.",
        }), 404

    pipelines = [
        item
        for item in pipelines
        if item["id"] != pipeline_id
    ]

    return jsonify({
        "success": True,
        "message": "Pipeline deleted successfully.",
    })


# ==========================================================
# RUN PIPELINE
# ==========================================================

@pipelines_bp.post("/<int:pipeline_id>/run")
def run_pipeline(pipeline_id):
    """
    Execute a real security scan through the pipeline.

    The pipeline uses the project's configured
    source_directory and the existing CodeScanner.
    """

    pipeline = find_pipeline(pipeline_id)

    if pipeline is None:
        return jsonify({
            "success": False,
            "error": "Pipeline not found.",
        }), 404

    # ------------------------------------------------------
    # Validate project
    # ------------------------------------------------------

    project_id = pipeline.get("project_id")

    if project_id is None:
        pipeline["status"] = "failed"
        pipeline["last_error"] = (
            "Pipeline is not connected to a project."
        )
        pipeline["updated_at"] = (
            datetime.utcnow().isoformat()
        )

        return jsonify({
            "success": False,
            "error": (
                "Pipeline must be connected "
                "to a project before it can run."
            ),
            "pipeline": pipeline,
        }), 400

    project = get_project(project_id)

    if project is None:

        pipeline["status"] = "failed"
        pipeline["last_error"] = "Project not found."
        pipeline["updated_at"] = (
            datetime.utcnow().isoformat()
        )

        return jsonify({
            "success": False,
            "error": "Project not found.",
            "pipeline": pipeline,
        }), 404

    # ------------------------------------------------------
    # Resolve source directory
    # ------------------------------------------------------

    source_directory = (
        project.get("source_directory")
        or "."
    )

    # ------------------------------------------------------
    # Mark pipeline as running
    # ------------------------------------------------------

    started_at = datetime.utcnow().isoformat()

    pipeline["status"] = "running"
    pipeline["last_run"] = started_at
    pipeline["updated_at"] = started_at
    pipeline["last_error"] = None

    # ------------------------------------------------------
    # Create scan record
    # ------------------------------------------------------

    scan = None

    try:

        scan = create_scan(
            project_id
        )

        # --------------------------------------------------
        # Run existing CodeScanner
        # --------------------------------------------------

        scanner = CodeScanner(
            source_directory
        )

        result = scanner.scan()

        findings = result.get(
            "findings",
            [],
        )

        # --------------------------------------------------
        # Save findings
        # --------------------------------------------------

        for finding in findings:

            create_finding(
                scan_id=scan["id"],
                rule_id=finding.get(
                    "rule_id",
                    "UNKNOWN",
                ),
                title=finding.get(
                    "title",
                    "Security Finding",
                ),
                severity=finding.get(
                    "severity",
                    "LOW",
                ),
                description=finding.get(
                    "description",
                    "",
                ),
                recommendation=finding.get(
                    "recommendation",
                    "",
                ),
                file_path=finding.get(
                    "file",
                    "",
                ),
                line_number=finding.get(
                    "line",
                ),
                evidence=finding.get(
                    "evidence",
                    "",
                ),
            )

        # --------------------------------------------------
        # Calculate score
        # --------------------------------------------------

        security_score = calculate_security_score(
            findings
        )

        completed_at = datetime.utcnow().isoformat()

        # --------------------------------------------------
        # Complete scan
        # --------------------------------------------------

        updated_scan = update_scan(
            scan_id=scan["id"],
            status="completed",
            files_scanned=result.get(
                "files_scanned",
                0,
            ),
            total_findings=result.get(
                "total_findings",
                len(findings),
            ),
            security_score=security_score,
            completed_at=completed_at,
        )

        # --------------------------------------------------
        # Complete pipeline
        # --------------------------------------------------

        pipeline["status"] = "success"
        pipeline["updated_at"] = completed_at

        pipeline["last_scan_id"] = scan["id"]
        pipeline["last_scan_status"] = "completed"
        pipeline["last_security_score"] = security_score
        pipeline["last_files_scanned"] = result.get(
            "files_scanned",
            0,
        )
        pipeline["last_findings"] = result.get(
            "total_findings",
            len(findings),
        )
        pipeline["last_error"] = None

        return jsonify({
            "success": True,
            "message": "Pipeline completed successfully.",
            "pipeline": pipeline,
            "scan": updated_scan,
            "findings": get_findings(
                scan["id"]
            ),
        }), 201

    except Exception as error:

        error_message = str(error)

        # --------------------------------------------------
        # Mark scan failed if one was created
        # --------------------------------------------------

        if scan is not None:

            try:

                update_scan(
                    scan_id=scan["id"],
                    status="failed",
                    completed_at=(
                        datetime.utcnow().isoformat()
                    ),
                )

            except Exception:
                pass

        # --------------------------------------------------
        # Mark pipeline failed
        # --------------------------------------------------

        failed_at = datetime.utcnow().isoformat()

        pipeline["status"] = "failed"
        pipeline["updated_at"] = failed_at
        pipeline["last_error"] = error_message

        if scan is not None:
            pipeline["last_scan_id"] = scan["id"]
            pipeline["last_scan_status"] = "failed"

        return jsonify({
            "success": False,
            "message": "Pipeline execution failed.",
            "error": error_message,
            "pipeline": pipeline,
            "scan_id": (
                scan["id"]
                if scan is not None
                else None
            ),
        }), 500