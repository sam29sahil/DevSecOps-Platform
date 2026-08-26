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


# ============================================================
# SCANS BLUEPRINT
# ============================================================

scans_bp = Blueprint(
    "scans",
    __name__,
    url_prefix="/api/scans",
)


# ============================================================
# LIST SCANS
# ============================================================

@scans_bp.route("", methods=["GET"])
def list_scans():
    """
    Return security scans.

    Optional query parameter:
        project_id
    """

    project_id = request.args.get(
        "project_id",
        type=int,
    )

    scans = get_scans(project_id)

    return jsonify({
        "success": True,
        "count": len(scans),
        "scans": scans,
    })


# ============================================================
# SCAN DETAILS
# ============================================================

@scans_bp.route("/<int:scan_id>", methods=["GET"])
def scan_details(scan_id):
    """
    Return one scan together with its findings.
    """

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


# ============================================================
# RUN SECURITY SCAN
# ============================================================

@scans_bp.route("", methods=["POST"])
def run_scan():
    """
    Run a security scan for a project.

    The frontend only needs to provide:

        {
            "project_id": 4
        }

    The backend automatically gets source_directory
    from the saved project configuration.
    """

    data = request.get_json(silent=True) or {}

    # --------------------------------------------------------
    # PROJECT ID
    # --------------------------------------------------------

    project_id = data.get("project_id")

    if project_id is None:
        return jsonify({
            "success": False,
            "error": "project_id is required.",
        }), 400

    try:
        project_id = int(project_id)
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "error": "project_id must be a valid integer.",
        }), 400

    # --------------------------------------------------------
    # LOAD PROJECT
    # --------------------------------------------------------

    project = get_project(project_id)

    if project is None:
        return jsonify({
            "success": False,
            "error": "Project not found.",
        }), 404

    # --------------------------------------------------------
    # GET SAVED SOURCE DIRECTORY
    # --------------------------------------------------------

    source_directory = (
        project.get("source_directory")
        or "."
    )

    source_directory = str(
        source_directory
    ).strip()

    if not source_directory:
        source_directory = "."

    # --------------------------------------------------------
    # CREATE SCAN RECORD
    # --------------------------------------------------------

    scan = create_scan(project_id)

    if scan is None:
        return jsonify({
            "success": False,
            "error": "Unable to create scan.",
        }), 500

    try:

        # ----------------------------------------------------
        # INITIALIZE SCANNER
        # ----------------------------------------------------

        scanner = CodeScanner(
            source_directory
        )

        # ----------------------------------------------------
        # RUN SCANNER
        # ----------------------------------------------------

        result = scanner.scan()

        findings = result.get(
            "findings",
            [],
        )

        # ----------------------------------------------------
        # SAVE FINDINGS
        # ----------------------------------------------------

        for finding in findings:

            create_finding(
                scan_id=scan["id"],
                rule_id=finding.get(
                    "rule_id",
                    "",
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
                    0,
                ),
                evidence=finding.get(
                    "evidence",
                    "",
                ),
            )

        # ----------------------------------------------------
        # CALCULATE SECURITY SCORE
        # ----------------------------------------------------

        security_score = calculate_security_score(
            findings
        )

        completed_at = datetime.utcnow().isoformat()

        # ----------------------------------------------------
        # UPDATE SCAN
        # ----------------------------------------------------

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

        # ----------------------------------------------------
        # RETURN RESULT
        # ----------------------------------------------------

        return jsonify({
            "success": True,
            "message": "Security scan completed.",
            "scan": updated_scan,
            "findings": get_findings(
                scan["id"]
            ),
        }), 201

    except Exception as error:

        # ----------------------------------------------------
        # MARK SCAN AS FAILED
        # ----------------------------------------------------

        try:
            update_scan(
                scan_id=scan["id"],
                status="failed",
                completed_at=datetime.utcnow().isoformat(),
            )
        except Exception:
            pass

        return jsonify({
            "success": False,
            "error": str(error),
            "scan_id": scan["id"],
            "project_id": project_id,
            "source_directory": source_directory,
        }), 500


# ============================================================
# VULNERABILITIES
# ============================================================

vulnerabilities_bp = Blueprint(
    "vulnerabilities",
    __name__,
    url_prefix="/api",
)


@vulnerabilities_bp.route(
    "/vulnerabilities",
    methods=["GET"],
)
def list_vulnerabilities():
    """
    Return security findings across all scans.

    Optional filters:

        project_id
        severity
    """

    project_id = request.args.get(
        "project_id",
        type=int,
    )

    severity = request.args.get(
        "severity",
        type=str,
    )

    if severity:
        severity = severity.upper()

    scans = get_scans(project_id)

    vulnerabilities = []

    for scan in scans:

        scan_id = scan["id"]

        findings = get_findings(
            scan_id
        )

        for finding in findings:

            finding = dict(finding)

            finding["scan_id"] = scan_id

            finding["project_id"] = scan.get(
                "project_id"
            )

            finding["project_name"] = scan.get(
                "project_name"
            )

            # ------------------------------------------------
            # SEVERITY FILTER
            # ------------------------------------------------

            if severity:

                finding_severity = str(
                    finding.get(
                        "severity",
                        "",
                    )
                ).upper()

                if finding_severity != severity:
                    continue

            vulnerabilities.append(
                finding
            )

    return jsonify({
        "success": True,
        "count": len(vulnerabilities),
        "vulnerabilities": vulnerabilities,
    })


# ============================================================
# SECURITY SCORE
# ============================================================

def calculate_security_score(findings):
    """
    Calculate an initial security score.

    Starting score:
        100

    Deductions:
        CRITICAL = 25
        HIGH     = 15
        MEDIUM   = 7
        LOW      = 3

    Score is always kept between 0 and 100.
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
            finding.get(
                "severity",
                "LOW",
            )
        ).upper()

        score -= deductions.get(
            severity,
            1,
        )

    return max(
        0,
        min(
            100,
            score,
        ),
    )