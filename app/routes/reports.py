from flask import Blueprint, jsonify

from app.models import get_scan, get_findings


reports_bp = Blueprint(
    "reports",
    __name__,
    url_prefix="/api/reports",
)


@reports_bp.get("")
def reports_list():
    """
    Reports endpoint.

    Reports are generated from existing completed scans.
    """

    return jsonify({
        "success": True,
        "reports": [],
        "count": 0,
        "message": "Reports are generated from security scans.",
    })


@reports_bp.get("/<int:scan_id>")
def get_report(scan_id):
    """
    Generate a security report from an existing scan.
    """

    scan = get_scan(scan_id)

    if scan is None:
        return jsonify({
            "success": False,
            "error": "Scan not found.",
        }), 404

    findings = get_findings(scan_id)

    severity_counts = {
        "CRITICAL": 0,
        "HIGH": 0,
        "MEDIUM": 0,
        "LOW": 0,
    }

    for finding in findings:
        severity = str(
            finding.get("severity", "LOW")
        ).upper()

        if severity in severity_counts:
            severity_counts[severity] += 1

    report = {
        "scan": scan,
        "findings": findings,
        "summary": {
            "security_score": scan.get(
                "security_score", 0
            ),
            "files_scanned": scan.get(
                "files_scanned", 0
            ),
            "total_findings": scan.get(
                "total_findings",
                len(findings),
            ),
            "severity_counts": severity_counts,
        },
    }

    return jsonify({
        "success": True,
        "report": report,
    })