from datetime import datetime

from flask import Blueprint, jsonify, request

from app.models import (
    create_finding,
    create_scan,
    get_findings,
    get_project,
    get_scan,
    get_scans,
    update_scan,
)

from app.scanners.code_scanner import CodeScanner


scans_bp = Blueprint(
    "scans",
    __name__,
    url_prefix="/api/scans",
)


@scans_bp.route("", methods=["GET"])
def list_scans():
    """Return security scans."""
    project_id = request.args.get("project_id", type=int)

    scans = get_scans(project_id)

    return jsonify({
        "success": True,
        "count": len(scans),
        "scans": scans,
    })


@scans_bp.route("/<int:scan_id>", methods=["GET"])
def scan_details(scan_id):
    """Return one scan and its findings."""
    scan = get_scan(scan_id)

    if scan is None:
        return jsonify({
            "success": False,
            "error": "Scan not found.",
        }), 404

    findings = get_findings(scan_id)

    return jsonify({
        "success": True,
        "scan": scan,
        "findings": findings,
    })


@scans_bp.route("", methods=["POST"])
def run_scan():
    """Run a security scan against a local source directory."""

    data = request.get_json(silent=True) or {}

    project_id = data.get("project_id")
    source_directory = data.get("source_directory")

    if not project_id:
        return jsonify({
            "success": False,
            "error": "project_id is required.",
        }), 400

    project = get_project(project_id)

    if project is None:
        return jsonify({
            "success": False,
            "error": "Project not found.",
        }), 404

    if not source_directory:
        return jsonify({
            "success": False,
            "error": "source_directory is required.",
        }), 400

    scan = create_scan(project_id)

    try:
        scanner = CodeScanner(source_directory)

        result = scanner.scan()

        findings = result["findings"]

        for finding in findings:
            create_finding(
                scan_id=scan["id"],
                rule_id=finding["rule_id"],
                title=finding["title"],
                severity=finding["severity"],
                description=finding["description"],
                recommendation=finding["recommendation"],
                file_path=finding["file"],
                line_number=finding["line"],
                evidence=finding["evidence"],
            )

        security_score = calculate_security_score(findings)

        completed_at = datetime.utcnow().isoformat()

        updated_scan = update_scan(
            scan_id=scan["id"],
            status="completed",
            files_scanned=result["files_scanned"],
            total_findings=result["total_findings"],
            security_score=security_score,
            completed_at=completed_at,
        )

        return jsonify({
            "success": True,
            "message": "Security scan completed.",
            "scan": updated_scan,
            "findings": get_findings(scan["id"]),
        }), 201

    except Exception as error:
        update_scan(
            scan_id=scan["id"],
            status="failed",
            completed_at=datetime.utcnow().isoformat(),
        )

        return jsonify({
            "success": False,
            "error": str(error),
            "scan_id": scan["id"],
        }), 500


def calculate_security_score(findings):
    """
    Calculate a simple security score.

    This is an initial scoring system. Later we'll replace it
    with a more sophisticated risk model.
    """

    deductions = {
        "CRITICAL": 25,
        "HIGH": 15,
        "MEDIUM": 7,
        "LOW": 3,
    }

    score = 100

    for finding in findings:
        severity = finding.get("severity", "LOW").upper()
        score -= deductions.get(severity, 1)

    return max(0, min(100, score))