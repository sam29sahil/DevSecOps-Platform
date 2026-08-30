import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from datetime import datetime
from pathlib import Path

from flask import Blueprint, jsonify, request

from app.models import (
    create_finding,
    create_scan,
    get_findings,
    get_project,
    get_projects,
    update_scan,
    get_db,
)

from app.scanners.code_scanner import CodeScanner


# ============================================================
# BLUEPRINT
# ============================================================

pipelines_bp = Blueprint(
    "pipelines",
    __name__,
    url_prefix="/api/pipelines",
)


# ============================================================
# PIPELINE STORAGE
#
# Pipelines and runs are persisted in SQLite.
# ============================================================

def _json_load(value, default):
    try:
        if not value:
            return default
        return json.loads(value)
    except (TypeError, ValueError, json.JSONDecodeError):
        return default


def _json_dump(value):
    return json.dumps(
        value if value is not None else [],
        ensure_ascii=False,
    )


def pipeline_row_to_dict(row):
    """Convert a SQLite pipeline row into the API structure."""

    if row is None:
        return None

    pipeline = dict(row)

    pipeline["fail_on_high"] = bool(
        pipeline.get("fail_on_high")
    )

    pipeline["docker_enabled"] = bool(
        pipeline.get("docker_enabled")
    )

    pipeline["registry_enabled"] = bool(
        pipeline.get("registry_enabled")
    )

    pipeline["deployment_enabled"] = bool(
        pipeline.get("deployment_enabled")
    )

    pipeline["stages"] = _json_load(
        pipeline.pop("stages_json", "[]"),
        [],
    )

    return pipeline


def run_row_to_dict(row):
    """Convert a SQLite pipeline run row into the API structure."""

    if row is None:
        return None

    run = dict(row)

    run["stages"] = _json_load(
        run.pop("stages_json", "[]"),
        [],
    )

    run["scan"] = _json_load(
        run.pop("scan_json", None),
        None,
    )

    run["findings"] = _json_load(
        run.pop("findings_json", "[]"),
        [],
    )

    run["quality_gate"] = _json_load(
        run.pop("quality_gate_json", None),
        None,
    )

    return run


def get_pipeline(pipeline_id):
    """Return one persisted pipeline."""

    db = get_db()

    row = db.execute(
        """
        SELECT *
        FROM pipelines
        WHERE id = ?
        """,
        (pipeline_id,),
    ).fetchone()

    db.close()

    return pipeline_row_to_dict(row)


def get_all_pipelines():
    """Return all persisted pipelines."""

    db = get_db()

    rows = db.execute(
        """
        SELECT *
        FROM pipelines
        ORDER BY id DESC
        """
    ).fetchall()

    db.close()

    return [
        pipeline_row_to_dict(row)
        for row in rows
    ]


def save_pipeline(pipeline):
    """Insert or update a pipeline."""

    db = get_db()

    db.execute(
        """
        INSERT INTO pipelines (
            id,
            name,
            description,
            branch,
            repository_url,
            project_id,
            status,
            created_at,
            updated_at,
            last_run,
            last_run_id,
            last_scan_id,
            last_scan_status,
            last_security_score,
            last_files_scanned,
            last_findings,
            last_error,
            quality_gate_score,
            fail_on_high,
            docker_enabled,
            registry_enabled,
            deployment_enabled,
            stages_json
        )
        VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, 
        )
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            branch = excluded.branch,
            repository_url = excluded.repository_url,
            project_id = excluded.project_id,
            status = excluded.status,
            updated_at = excluded.updated_at,
            last_run = excluded.last_run,
            last_run_id = excluded.last_run_id,
            last_scan_id = excluded.last_scan_id,
            last_scan_status = excluded.last_scan_status,
            last_security_score = excluded.last_security_score,
            last_files_scanned = excluded.last_files_scanned,
            last_findings = excluded.last_findings,
            last_error = excluded.last_error,
            quality_gate_score = excluded.quality_gate_score,
            fail_on_high = excluded.fail_on_high,
            docker_enabled = excluded.docker_enabled,
            registry_enabled = excluded.registry_enabled,
            deployment_enabled = excluded.deployment_enabled,
            stages_json = excluded.stages_json
        """,
        (
            pipeline["id"],
            pipeline["name"],
            pipeline.get("description", ""),
            pipeline.get("branch", "main"),
            pipeline.get("repository_url", ""),
            pipeline.get("project_id"),
            pipeline.get("status", "pending"),
            pipeline.get("created_at"),
            pipeline.get("updated_at"),
            pipeline.get("last_run"),
            pipeline.get("last_run_id"),
            pipeline.get("last_scan_id"),
            pipeline.get("last_scan_status"),
            pipeline.get("last_security_score"),
            pipeline.get("last_files_scanned", 0),
            pipeline.get("last_findings", 0),
            pipeline.get("last_error"),
            pipeline.get("quality_gate_score", 70),
            int(bool(pipeline.get("fail_on_high", True))),
            int(bool(pipeline.get("docker_enabled", True))),
            int(bool(pipeline.get("registry_enabled", False))),
            int(bool(pipeline.get("deployment_enabled", False))),
            _json_dump(pipeline.get("stages", [])),
        ),
    )

    db.commit()
    db.close()

    return get_pipeline(
        pipeline["id"]
    )


def save_pipeline_run(run):
    """Insert or update a persisted pipeline run."""

    db = get_db()

    db.execute(
        """
        INSERT INTO pipeline_runs (
            id,
            pipeline_id,
            pipeline_name,
            status,
            started_at,
            completed_at,
            repository_url,
            branch,
            workspace,
            stages_json,
            scan_json,
            findings_json,
            security_score,
            quality_gate_json,
            error
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            pipeline_id = excluded.pipeline_id,
            pipeline_name = excluded.pipeline_name,
            status = excluded.status,
            started_at = excluded.started_at,
            completed_at = excluded.completed_at,
            repository_url = excluded.repository_url,
            branch = excluded.branch,
            workspace = excluded.workspace,
            stages_json = excluded.stages_json,
            scan_json = excluded.scan_json,
            findings_json = excluded.findings_json,
            security_score = excluded.security_score,
            quality_gate_json = excluded.quality_gate_json,
            error = excluded.error
        """,
        (
            run["id"],
            run["pipeline_id"],
            run.get("pipeline_name"),
            run.get("status", "running"),
            run.get("started_at"),
            run.get("completed_at"),
            run.get("repository_url", ""),
            run.get("branch", "main"),
            run.get("workspace"),
            _json_dump(run.get("stages", [])),
            json.dumps(run.get("scan"), ensure_ascii=False)
                if run.get("scan") is not None
                else None,
            _json_dump(run.get("findings", [])),
            run.get("security_score"),
            json.dumps(
                run.get("quality_gate"),
                ensure_ascii=False,
            )
            if run.get("quality_gate") is not None
            else None,
            run.get("error"),
        ),
    )

    db.commit()
    db.close()

    return get_pipeline_run(run["id"])
    
    


def get_pipeline_run(run_id):
    """Return one persisted pipeline run."""

    db = get_db()

    row = db.execute(
        """
        SELECT *
        FROM pipeline_runs
        WHERE id = ?
        """,
        (run_id,),
    ).fetchone()

    db.close()

    return run_row_to_dict(row)


def get_pipeline_runs(pipeline_id):
    """Return persisted runs for a pipeline."""

    db = get_db()

    rows = db.execute(
        """
        SELECT *
        FROM pipeline_runs
        WHERE pipeline_id = ?
        ORDER BY id DESC
        """,
        (pipeline_id,),
    ).fetchall()

    db.close()

    return [
        run_row_to_dict(row)
        for row in rows
    ]

# ============================================================
# PIPELINE STAGES
# ============================================================

DEFAULT_STAGES = [
    {
        "id": "checkout",
        "name": "Checkout Repository",
        "description": "Clone the configured repository and branch.",
    },
    {
        "id": "dependencies",
        "name": "Dependency Check",
        "description": "Inspect dependency manifests for known package risks.",
    },
    {
        "id": "secrets",
        "name": "Secret Detection",
        "description": "Search source files for accidentally committed secrets.",
    },
    {
        "id": "sast",
        "name": "SAST Security Scan",
        "description": "Run the platform's source-code security scanner.",
    },
    {
        "id": "quality_gate",
        "name": "Quality Gate",
        "description": "Determine whether the security policy allows the pipeline to continue.",
    },
    {
        "id": "docker_build",
        "name": "Docker Build",
        "description": "Build a container image when a Dockerfile is present.",
    },
    {
        "id": "container_scan",
        "name": "Container Security Scan",
        "description": "Inspect the built container image when a scanner is available.",
    },
    {
        "id": "registry_push",
        "name": "Registry Push",
        "description": "Push the image to a configured container registry.",
    },
    {
        "id": "deployment",
        "name": "Deployment",
        "description": "Deploy the image to the configured target environment.",
    },
]


# ============================================================
# HELPERS
# ============================================================

def utc_now():
    return datetime.utcnow().isoformat()


def safe_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def find_pipeline(pipeline_id):
    return get_pipeline(pipeline_id)


def find_run(run_id):
    return get_pipeline_run(run_id)



def create_pipeline_record(
    name,
    description="",
    branch="main",
    repository_url="",
    project_id=None,
    quality_gate_score=70,
    fail_on_high=True,
    docker_enabled=True,
    registry_enabled=False,
    deployment_enabled=False,
):
    now = utc_now()

    db = get_db()

    cursor = db.execute(
        """
        INSERT INTO pipelines (
            name,
            description,
            branch,
            repository_url,
            project_id,
            status,
            created_at,
            updated_at,
            last_run,
            last_run_id,
            last_scan_id,
            last_scan_status,
            last_security_score,
            last_files_scanned,
            last_findings,
            last_error,
            quality_gate_score,
            fail_on_high,
            docker_enabled,
            registry_enabled,
            deployment_enabled,
            stages_json
        )
         VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?
        )        
        """,
        (
            name,        
            description,
            branch,
            repository_url,
            project_id,
            "pending",
            now,
            now,
            None,
            None,
            None,
            None,
            None,
            0,
            0,
            None,
            quality_gate_score,
            int(bool(fail_on_high)),
            int(bool(docker_enabled)),
            int(bool(registry_enabled)),
            int(bool(deployment_enabled)),
            _json_dump([
                {
                    **stage,
                    "status": "pending",
                    "started_at": None,
                    "completed_at": None,
                    "duration_ms": 0,
                    "message": "",
                    "details": {},
                    "error": None,
                }
                for stage in DEFAULT_STAGES
            ]),
        ),
    )

    pipeline_id = cursor.lastrowid

    db.commit()
    db.close()

    return get_pipeline(pipeline_id)

def calculate_security_score(findings):
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


def update_stage(
    run,
    stage_id,
    status,
    message="",
    details=None,
    error=None,
    started_at=None,
    completed_at=None,
    duration_ms=0,
):
    for stage in run["stages"]:
        if stage["id"] == stage_id:
            stage["status"] = status
            stage["message"] = message
            stage["details"] = details or {}
            stage["error"] = error
            stage["started_at"] = started_at
            stage["completed_at"] = completed_at
            stage["duration_ms"] = duration_ms
            return stage

    return None


def stage_start(run, stage_id):
    started = utc_now()

    stage = update_stage(
        run,
        stage_id,
        "running",
        message="Stage is running.",
        started_at=started,
    )

    return stage, time.monotonic()


def stage_finish(
    run,
    stage_id,
    started_monotonic,
    status="success",
    message="Stage completed successfully.",
    details=None,
    error=None,
):
    completed = utc_now()

    duration_ms = int(
        (time.monotonic() - started_monotonic)
        * 1000
    )

    return update_stage(
        run,
        stage_id,
        status,
        message=message,
        details=details,
        error=error,
        completed_at=completed,
        duration_ms=duration_ms,
    )


def run_command(
    command,
    cwd=None,
    timeout=300,
    env=None,
):
    """
    Execute an external command safely and capture output.
    """

    completed = subprocess.run(
        command,
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=timeout,
        check=False,
    )

    return {
        "returncode": completed.returncode,
        "stdout": completed.stdout[-12000:],
        "stderr": completed.stderr[-12000:],
    }


def is_git_available():
    return shutil.which("git") is not None


def is_docker_available():
    return shutil.which("docker") is not None


def is_trivy_available():
    return shutil.which("trivy") is not None


# ============================================================
# REPOSITORY
# ============================================================

def checkout_repository(
    repository_url,
    branch,
):
    """
    Clone a repository into a temporary workspace.
    """

    if not repository_url:
        raise RuntimeError(
            "Repository URL is required."
        )

    if not is_git_available():
        raise RuntimeError(
            "Git is not installed in the pipeline runtime."
        )

    workspace = tempfile.mkdtemp(
        prefix="devsecops-pipeline-"
    )

    command = [
        "git",
        "clone",
        "--depth",
        "1",
        "--branch",
        branch,
        repository_url,
        workspace,
    ]

    result = run_command(
        command,
        timeout=300,
    )

    if result["returncode"] != 0:
        shutil.rmtree(
            workspace,
            ignore_errors=True,
        )

        error = (
            result["stderr"]
            or result["stdout"]
            or "Git checkout failed."
        )

        raise RuntimeError(
            error.strip()
        )

    return workspace, result


# ============================================================
# DEPENDENCY CHECK
# ============================================================

def dependency_check(workspace):
    """
    Inspect common dependency manifests.

    This stage deliberately does not install application
    dependencies into the pipeline container.
    """

    root = Path(workspace)

    manifests = []

    manifest_names = [
        "requirements.txt",
        "requirements-dev.txt",
        "Pipfile",
        "Pipfile.lock",
        "poetry.lock",
        "pyproject.toml",
        "package.json",
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "pom.xml",
        "build.gradle",
        "build.gradle.kts",
        "go.mod",
        "Cargo.toml",
    ]

    for path in root.rglob("*"):
        if not path.is_file():
            continue

        if any(
            part in {
                ".git",
                "node_modules",
                "venv",
                ".venv",
                "__pycache__",
                "dist",
                "build",
            }
            for part in path.parts
        ):
            continue

        if path.name in manifest_names:
            manifests.append(
                str(path.relative_to(root))
            )

    python_manifests = [
        item
        for item in manifests
        if Path(item).name
        in {
            "requirements.txt",
            "requirements-dev.txt",
            "Pipfile",
            "Pipfile.lock",
            "poetry.lock",
            "pyproject.toml",
        }
    ]

    node_manifests = [
        item
        for item in manifests
        if Path(item).name
        in {
            "package.json",
            "package-lock.json",
            "yarn.lock",
            "pnpm-lock.yaml",
        }
    ]

    return {
        "manifests": manifests,
        "manifest_count": len(manifests),
        "python_manifests": python_manifests,
        "node_manifests": node_manifests,
        "status": (
            "detected"
            if manifests
            else "no_dependency_manifest"
        ),
    }


# ============================================================
# SECRET DETECTION
# ============================================================

SECRET_PATTERNS = [
    (
        "AWS Access Key",
        re.compile(
            r"\bAKIA[0-9A-Z]{16}\b"
        ),
    ),
    (
        "Private Key",
        re.compile(
            r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"
        ),
    ),
    (
        "Generic API Key",
        re.compile(
            r"(?i)\b(?:api[_-]?key|secret[_-]?key)"
            r"\s*[:=]\s*['\"][A-Za-z0-9_\-]{16,}['\"]"
        ),
    ),
    (
        "Generic Token",
        re.compile(
            r"(?i)\b(?:access[_-]?token|auth[_-]?token)"
            r"\s*[:=]\s*['\"][A-Za-z0-9_\-\.]{16,}['\"]"
        ),
    ),
    (
        "GitHub Token",
        re.compile(
            r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b"
        ),
    ),
]


def secret_scan(workspace):
    """
    Lightweight repository secret detector.
    """

    root = Path(workspace)

    findings = []

    ignored_names = {
        ".git",
        "node_modules",
        "venv",
        ".venv",
        "__pycache__",
        "dist",
        "build",
    }

    extensions = {
        ".py",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".json",
        ".yaml",
        ".yml",
        ".env",
        ".ini",
        ".cfg",
        ".conf",
        ".txt",
        ".toml",
        ".xml",
        ".java",
        ".go",
        ".rs",
        ".php",
        ".cs",
        ".sh",
    }

    for path in root.rglob("*"):

        if not path.is_file():
            continue

        if any(
            part in ignored_names
            for part in path.parts
        ):
            continue

        if path.suffix.lower() not in extensions:
            continue

        try:
            content = path.read_text(
                encoding="utf-8",
                errors="ignore",
            )
        except Exception:
            continue

        lines = content.splitlines()

        for line_number, line in enumerate(
            lines,
            start=1,
        ):

            for title, pattern in SECRET_PATTERNS:

                if pattern.search(line):

                    findings.append(
                        {
                            "title": title,
                            "severity": "CRITICAL",
                            "file": str(
                                path.relative_to(root)
                            ),
                            "line": line_number,
                            "rule_id": "SECRET-001",
                            "description": (
                                "Potential hard-coded secret "
                                "detected in source code."
                            ),
                            "recommendation": (
                                "Remove the secret from source "
                                "control and rotate it immediately."
                            ),
                            "evidence": line.strip()[:500],
                        }
                    )

    return findings


# ============================================================
# QUALITY GATE
# ============================================================

def evaluate_quality_gate(
    security_score,
    findings,
    minimum_score,
    fail_on_high,
):
    critical = sum(
        1
        for finding in findings
        if str(
            finding.get("severity", "")
        ).upper()
        == "CRITICAL"
    )

    high = sum(
        1
        for finding in findings
        if str(
            finding.get("severity", "")
        ).upper()
        == "HIGH"
    )

    reasons = []

    if security_score < minimum_score:
        reasons.append(
            f"Security score {security_score} "
            f"is below required score {minimum_score}."
        )

    if critical > 0:
        reasons.append(
            f"{critical} critical finding(s) detected."
        )

    if fail_on_high and high > 0:
        reasons.append(
            f"{high} high severity finding(s) detected."
        )

    passed = len(reasons) == 0

    return {
        "passed": passed,
        "minimum_score": minimum_score,
        "security_score": security_score,
        "critical": critical,
        "high": high,
        "reasons": reasons,
    }


# ============================================================
# DOCKER
# ============================================================

def build_docker_image(
    workspace,
    pipeline_id,
    run_id,
):
    dockerfile = Path(workspace) / "Dockerfile"

    if not dockerfile.exists():
        return {
            "status": "skipped",
            "message": "No Dockerfile found.",
        }

    if not is_docker_available():
        return {
            "status": "skipped",
            "message": (
                "Docker CLI is not available "
                "inside the pipeline runtime."
            ),
        }

    image_tag = (
        f"devsecops-pipeline:"
        f"{pipeline_id}-{run_id}"
    )

    result = run_command(
        [
            "docker",
            "build",
            "-t",
            image_tag,
            workspace,
        ],
        timeout=900,
    )

    if result["returncode"] != 0:
        raise RuntimeError(
            result["stderr"]
            or result["stdout"]
            or "Docker build failed."
        )

    return {
        "status": "success",
        "image": image_tag,
        "stdout": result["stdout"],
    }


# ============================================================
# CONTAINER SCAN
# ============================================================

def scan_container_image(image):
    if not image:
        return {
            "status": "skipped",
            "message": "No container image was built.",
        }

    if not is_trivy_available():
        return {
            "status": "skipped",
            "message": (
                "Trivy is not installed. "
                "Container image scan was skipped."
            ),
        }

    result = run_command(
        [
            "trivy",
            "image",
            "--format",
            "json",
            image,
        ],
        timeout=900,
    )

    if result["returncode"] not in (0, 1):
        raise RuntimeError(
            result["stderr"]
            or "Container scan failed."
        )

    parsed = {}

    try:
        parsed = json.loads(
            result["stdout"]
        )
    except Exception:
        pass

    return {
        "status": "success",
        "image": image,
        "result": parsed,
    }


# ============================================================
# REGISTRY PUSH
# ============================================================

def push_registry_image(
    image,
    registry,
):
    if not image:
        return {
            "status": "skipped",
            "message": "No image available.",
        }

    if not registry:
        return {
            "status": "skipped",
            "message": "No registry configured.",
        }

    if not is_docker_available():
        return {
            "status": "skipped",
            "message": "Docker CLI unavailable.",
        }

    target = (
        registry.rstrip("/")
        + "/"
        + image.replace(
            "devsecops-pipeline:",
            "devsecops-pipeline:"
        )
    )

    tag_result = run_command(
        [
            "docker",
            "tag",
            image,
            target,
        ],
        timeout=120,
    )

    if tag_result["returncode"] != 0:
        raise RuntimeError(
            tag_result["stderr"]
            or "Docker tag failed."
        )

    push_result = run_command(
        [
            "docker",
            "push",
            target,
        ],
        timeout=900,
    )

    if push_result["returncode"] != 0:
        raise RuntimeError(
            push_result["stderr"]
            or push_result["stdout"]
            or "Registry push failed."
        )

    return {
        "status": "success",
        "image": target,
    }


# ============================================================
# AZURE DEPLOYMENT
# ============================================================

def deploy_azure_container(
    image,
):
    """
    Deployment is deliberately opt-in.

    Required environment variables:

        AZURE_RESOURCE_GROUP
        AZURE_CONTAINER_APP_NAME
    """

    if not image:
        return {
            "status": "skipped",
            "message": "No image available.",
        }

    resource_group = os.getenv(
        "AZURE_RESOURCE_GROUP"
    )

    container_app = os.getenv(
        "AZURE_CONTAINER_APP_NAME"
    )

    if not resource_group:
        return {
            "status": "skipped",
            "message": (
                "AZURE_RESOURCE_GROUP is not configured."
            ),
        }

    if not container_app:
        return {
            "status": "skipped",
            "message": (
                "AZURE_CONTAINER_APP_NAME is not configured."
            ),
        }

    if shutil.which("az") is None:
        return {
            "status": "skipped",
            "message": (
                "Azure CLI is not available."
            ),
        }

    result = run_command(
        [
            "az",
            "containerapp",
            "update",
            "--name",
            container_app,
            "--resource-group",
            resource_group,
            "--image",
            image,
        ],
        timeout=900,
    )

    if result["returncode"] != 0:
        raise RuntimeError(
            result["stderr"]
            or result["stdout"]
            or "Azure deployment failed."
        )

    return {
        "status": "success",
        "container_app": container_app,
        "resource_group": resource_group,
        "image": image,
    }


# ============================================================
# GET ALL PIPELINES
# ============================================================

@pipelines_bp.get("")
def list_pipelines():
    persisted_pipelines = get_all_pipelines()

    return jsonify(
        {
            "success": True,
            "count": len(persisted_pipelines),
            "pipelines": persisted_pipelines,
        }
    )


# ============================================================
# GET SINGLE PIPELINE
# ============================================================

@pipelines_bp.get("/<int:pipeline_id>")
def pipeline_details(pipeline_id):

    pipeline = find_pipeline(
        pipeline_id
    )

    if pipeline is None:
        return jsonify(
            {
                "success": False,
                "error": "Pipeline not found.",
            }
        ), 404

    return jsonify(
        {
            "success": True,
            "pipeline": pipeline,
        }
    )


# ============================================================
# CREATE PIPELINE
# ============================================================

@pipelines_bp.post("")
def create_pipeline():

    data = request.get_json(
        silent=True
    ) or {}

    name = str(
        data.get("name", "")
    ).strip()

    if not name:
        return jsonify(
            {
                "success": False,
                "error": "Pipeline name is required.",
            }
        ), 400

    repository_url = str(
        data.get(
            "repository_url",
            "",
        )
    ).strip()

    if not repository_url:
        return jsonify(
            {
                "success": False,
                "error": "Repository URL is required.",
            }
        ), 400

    branch = (
        str(
            data.get(
                "branch",
                "main",
            )
        ).strip()
        or "main"
    )

    description = str(
        data.get(
            "description",
            "",
        )
    ).strip()

    project_id = data.get(
        "project_id"
    )

    if project_id is not None:
        project_id = safe_int(
            project_id
        )

        if project_id is None:
            return jsonify(
                {
                    "success": False,
                    "error": (
                        "project_id must be an integer."
                    ),
                }
            ), 400

        if get_project(project_id) is None:
            return jsonify(
                {
                    "success": False,
                    "error": "Project not found.",
                }
    
        ), 404
    # -----------------------------------------------------
    # AUTO CONNECT PIPELINE TO PROJECT
    # -----------------------------------------------------
    #
    # If frontend did not provide project_id, try to find
    # the project using the repository URL.
    # -----------------------------------------------------

    if project_id is None:

        def normalize_repo(url):
            return (
                str(url or "")
                .strip()
                .lower()
                .rstrip("/")
                .removesuffix(".git")
            )

        pipeline_repo = normalize_repo(repository_url)

        if pipeline_repo:

            try:
                projects = get_projects()
            except Exception:
                projects = []

            for project in projects:

                project_repo = normalize_repo(
                    project.get("repository_url")
                )

                if project_repo and project_repo == pipeline_repo:
                    project_id = project.get("id")
                    break
    quality_gate_score = safe_int(
        data.get(
            "quality_gate_score",
            70,
        ),
        70,
    )

    quality_gate_score = max(
        0,
        min(
            100,
            quality_gate_score,
        ),
    )

    pipeline = create_pipeline_record(
        name=name,
        description=description,
        branch=branch,
        repository_url=repository_url,
        project_id=project_id,
        quality_gate_score=quality_gate_score,
        fail_on_high=bool(
            data.get(
                "fail_on_high",
                True,
            )
        ),
        docker_enabled=bool(
            data.get(
                "docker_enabled",
                True,
            )
        ),
        registry_enabled=bool(
            data.get(
                "registry_enabled",
                False,
            )
        ),
        deployment_enabled=bool(
            data.get(
                "deployment_enabled",
                False,
            )
        ),
    )

    return jsonify(
        {
            "success": True,
            "message": (
                "DevSecOps pipeline created successfully."
            ),
            "pipeline": pipeline,
        }
    ), 201


# ============================================================
# UPDATE PIPELINE
# ============================================================

@pipelines_bp.put("/<int:pipeline_id>")
def update_pipeline(pipeline_id):

    pipeline = find_pipeline(
        pipeline_id
    )

    if pipeline is None:
        return jsonify(
            {
                "success": False,
                "error": "Pipeline not found.",
            }
        ), 404

    data = request.get_json(
        silent=True
    ) or {}

    if "name" in data:
        name = str(
            data["name"]
        ).strip()

        if not name:
            return jsonify(
                {
                    "success": False,
                    "error": (
                        "Pipeline name cannot be empty."
                    ),
                }
            ), 400

        pipeline["name"] = name

    if "description" in data:
        pipeline["description"] = str(
            data["description"]
        ).strip()

    if "branch" in data:
        pipeline["branch"] = (
            str(
                data["branch"]
            ).strip()
            or "main"
        )

    if "repository_url" in data:
        pipeline["repository_url"] = str(
            data["repository_url"]
        ).strip()

    if "project_id" in data:
        project_id = data["project_id"]

        if project_id is not None:
            project_id = safe_int(
                project_id
            )

            if project_id is None:
                return jsonify(
                    {
                        "success": False,
                        "error": (
                            "project_id must be an integer."
                        ),
                    }
                ), 400

            if get_project(project_id) is None:
                return jsonify(
                    {
                        "success": False,
                        "error": "Project not found.",
                    }
                ), 404

        pipeline["project_id"] = project_id

    if "quality_gate_score" in data:
        score = safe_int(
            data["quality_gate_score"],
            pipeline["quality_gate_score"],
        )

        pipeline["quality_gate_score"] = max(
            0,
            min(
                100,
                score,
            ),
        )

    if "fail_on_high" in data:
        pipeline["fail_on_high"] = bool(
            data["fail_on_high"]
        )

    if "docker_enabled" in data:
        pipeline["docker_enabled"] = bool(
            data["docker_enabled"]
        )

    if "registry_enabled" in data:
        pipeline["registry_enabled"] = bool(
            data["registry_enabled"]
        )

    if "deployment_enabled" in data:
        pipeline["deployment_enabled"] = bool(
            data["deployment_enabled"]
        )

    pipeline["updated_at"] = utc_now()

    return jsonify(
        {
            "success": True,
            "message": (
                "Pipeline updated successfully."
            ),
            "pipeline": pipeline,
        }
    )


# ============================================================
# DELETE PIPELINE
# ============================================================

@pipelines_bp.delete("/<int:pipeline_id>")
def delete_pipeline(pipeline_id):

    pipeline = find_pipeline(pipeline_id)

    if pipeline is None:
        return jsonify(
            {
                "success": False,
                "error": "Pipeline not found.",
            }
        ), 404

    db = get_db()

    db.execute(
        """
        DELETE FROM pipelines
        WHERE id = ?
        """,
        (pipeline_id,),
    )

    db.commit()
    db.close()

    return jsonify(
        {
            "success": True,
            "message": "Pipeline deleted successfully.",
        }
    )

# ============================================================
# RUN PIPELINE
# ============================================================

@pipelines_bp.post(
    "/<int:pipeline_id>/run"
)
def run_pipeline(pipeline_id):

    pipeline = find_pipeline(
        pipeline_id
    )

    if pipeline is None:
        return jsonify(
            {
                "success": False,
                "error": "Pipeline not found.",
            }
        ), 404

    project_id = pipeline.get(
        "project_id"
    )

    if project_id is None:
        pipeline["status"] = "failed"
        pipeline["last_error"] = (
            "Pipeline is not connected to a project."
        )
        pipeline["updated_at"] = utc_now()
        
        pipeline = save_pipeline(pipeline)

        return jsonify(
            {
                "success": False,
                "error": (
                    "Pipeline must be connected "
                    "to a project before it can run."
                ),
                "pipeline": pipeline,
            }
        ), 400

    project = get_project(
        project_id
    )

    if project is None:
        return jsonify(
            {
                "success": False,
                "error": "Project not found.",
            }
        ), 404

    started_at = utc_now()

    run = {
        "id": None,
        "pipeline_id": pipeline_id,
        "pipeline_name": pipeline["name"],
        "status": "running",

        "started_at": started_at,
        "completed_at": None,

        "repository_url": pipeline[
            "repository_url"
        ],
        "branch": pipeline[
            "branch"
        ],

        "workspace": None,

        "stages": [
            {
                **stage,
                "status": "pending",
                "started_at": None,
                "completed_at": None,
                "duration_ms": 0,
                "message": "",
                "details": {},
                "error": None,
            }
            for stage in DEFAULT_STAGES
        ],

        "scan": None,
        "findings": [],

        "security_score": None,
        "quality_gate": None,

        "docker_image": None,
        "registry_image": None,
        "deployment": None,

        "error": None,
    }
    run = create_pipeline_run_record(run)

    if run is None:
        return jsonify({
            "success": False,
            "error": "Failed to create pipeline run."
        }), 500

    pipeline["status"] = "running"
    pipeline["last_run"] = started_at
    pipeline["last_run_id"] = run["id"]
    pipeline["updated_at"] = started_at
    pipeline["last_error"] = None

    workspace = None
    scan = None

    try:

        # ====================================================
        # STAGE 1 — CHECKOUT
        # ====================================================

        _, stage_timer = stage_start(
            run,
            "checkout",
        )

        workspace, checkout_result = checkout_repository(
            pipeline["repository_url"],
            pipeline["branch"],
        )

        run["workspace"] = workspace

        stage_finish(
            run,
            "checkout",
            stage_timer,
            status="success",
            message=(
                "Repository checked out successfully."
            ),
            details={
                "branch": pipeline["branch"],
                "repository": pipeline[
                    "repository_url"
                ],
                "workspace": workspace,
            },
        )

        # ====================================================
        # STAGE 2 — DEPENDENCY CHECK
        # ====================================================

        _, stage_timer = stage_start(
            run,
            "dependencies",
        )

        dependency_result = dependency_check(
            workspace
        )

        stage_finish(
            run,
            "dependencies",
            stage_timer,
            status="success",
            message=(
                "Dependency manifests inspected."
            ),
            details=dependency_result,
        )

        # ====================================================
        # STAGE 3 — SECRET DETECTION
        # ====================================================

        _, stage_timer = stage_start(
            run,
            "secrets",
        )

        secret_findings = secret_scan(
            workspace
        )

        stage_finish(
            run,
            "secrets",
            stage_timer,
            status=(
                "failed"
                if secret_findings
                else "success"
            ),
            message=(
                "Potential secrets detected."
                if secret_findings
                else "No potential secrets detected."
            ),
            details={
                "findings": len(
                    secret_findings
                ),
            },
        )

        # ====================================================
        # STAGE 4 — SAST
        # ====================================================

        _, stage_timer = stage_start(
            run,
            "sast",
        )

        scan = create_scan(
            project_id
        )

        scanner = CodeScanner(
            workspace
        )

        result = scanner.scan()

        sast_findings = result.get(
            "findings",
            [],
        )

        all_findings = []

        # SAST findings
        for finding in sast_findings:

            normalized = {
                "rule_id": finding.get(
                    "rule_id",
                    "UNKNOWN",
                ),
                "title": finding.get(
                    "title",
                    "Security Finding",
                ),
                "severity": finding.get(
                    "severity",
                    "LOW",
                ),
                "description": finding.get(
                    "description",
                    "",
                ),
                "recommendation": finding.get(
                    "recommendation",
                    "",
                ),
                "file": finding.get(
                    "file",
                    "",
                ),
                "line": finding.get(
                    "line",
                ),
                "evidence": finding.get(
                    "evidence",
                    "",
                ),
            }

            all_findings.append(
                normalized
            )

        # Secret findings
        for finding in secret_findings:
            all_findings.append(
                finding
            )

        # Save all findings
        for finding in all_findings:

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

        security_score = calculate_security_score(
            all_findings
        )

        update_scan(
            scan_id=scan["id"],
            status="completed",
            files_scanned=result.get(
                "files_scanned",
                0,
            ),
            total_findings=len(
                all_findings
            ),
            security_score=security_score,
            completed_at=utc_now(),
        )

        run["scan"] = scan
        run["findings"] = get_findings(
            scan["id"]
        )
        run["security_score"] = security_score

        stage_finish(
            run,
            "sast",
            stage_timer,
            status="success",
            message=(
                "SAST scan completed successfully."
            ),
            details={
                "scan_id": scan["id"],
                "files_scanned": result.get(
                    "files_scanned",
                    0,
                ),
                "findings": len(
                    all_findings
                ),
                "security_score": security_score,
            },
        )

        # ====================================================
        # STAGE 5 — QUALITY GATE
        # ====================================================

        _, stage_timer = stage_start(
            run,
            "quality_gate",
        )

        quality_gate = evaluate_quality_gate(
            security_score=security_score,
            findings=all_findings,
            minimum_score=pipeline[
                "quality_gate_score"
            ],
            fail_on_high=pipeline[
                "fail_on_high"
            ],
        )

        run["quality_gate"] = quality_gate

        if quality_gate["passed"]:

            stage_finish(
                run,
                "quality_gate",
                stage_timer,
                status="success",
                message=(
                    "Quality gate passed."
                ),
                details=quality_gate,
            )

        else:

            stage_finish(
                run,
                "quality_gate",
                stage_timer,
                status="failed",
                message=(
                    "Quality gate failed."
                ),
                details=quality_gate,
                error="; ".join(
                    quality_gate["reasons"]
                ),
            )

            raise RuntimeError(
                "Quality gate failed: "
                + "; ".join(
                    quality_gate["reasons"]
                )
            )

        # ====================================================
        # STAGE 6 — DOCKER BUILD
        # ====================================================

        if pipeline["docker_enabled"]:
            _, stage_timer = stage_start(
                run,
                "docker_build",
            )

            docker_result = build_docker_image(
                workspace,
                pipeline_id,
                run["id"],
            )

            if docker_result["status"] == "success":
                run["docker_image"] = docker_result["image"]

                stage_finish(
                    run,
                    "docker_build",
                    stage_timer,
                    status="success",
                    message="Docker image built successfully.",
                    details=docker_result,
                )

            else:
                error_message = docker_result.get(
                    "message",
                    "Docker build failed.",
                )

                stage_finish(
                    run,
                    "docker_build",
                    stage_timer,
                    status="failed",
                    message="Docker build failed.",
                    details=docker_result,
                    error=error_message,
                )

                raise RuntimeError(
                    f"Docker build failed: {error_message}"
                )

        else:
            update_stage(
                run,
                "docker_build",
                "skipped",
                message=(
                    "Docker build disabled for this pipeline."
                ),
            )


        # ====================================================
        # STAGE 7 — CONTAINER SCAN
        # ====================================================

        if pipeline["docker_enabled"]:
            _, stage_timer = stage_start(
                run,
                "container_scan",
            )

            container_result = scan_container_image(
                run["docker_image"]
            )

            if container_result["status"] == "success":

                stage_finish(
                    run,
                    "container_scan",
                    stage_timer,
                    status="success",
                    message=(
                        "Container security scan completed."
                    ),
                    details=container_result,
                )

            else:
                error_message = container_result.get(
                    "message",
                    "Container security scan failed.",
                )

                stage_finish(
                    run,
                    "container_scan",
                    stage_timer,
                    status="failed",
                    message=(
                        "Container security scan failed."
                    ),
                    details=container_result,
                    error=error_message,
                )

                raise RuntimeError(
                    "Container security scan failed: "
                    + error_message
                )

        else:
            update_stage(
                run,
                "container_scan",
                "skipped",
                message=(
                    "Container scan skipped because "
                    "Docker build is disabled."
                ),
            )


        # ====================================================
        # STAGE 8 — REGISTRY PUSH
        # ====================================================

        if pipeline["registry_enabled"]:
            _, stage_timer = stage_start(
                run,
                "registry_push",
            )

            registry = os.getenv(
                "CONTAINER_REGISTRY"
            )

            registry_result = push_registry_image(
                run["docker_image"],
                registry,
            )

            if registry_result["status"] == "success":

                run["registry_image"] = (
                    registry_result["image"]
                )

                stage_finish(
                    run,
                    "registry_push",
                    stage_timer,
                    status="success",
                    message=(
                        "Container image pushed "
                        "to registry."
                    ),
                    details=registry_result,
                )

            else:
                error_message = registry_result.get(
                    "message",
                    "Registry push failed.",
                )

                stage_finish(
                    run,
                    "registry_push",
                    stage_timer,
                    status="failed",
                    message="Registry push failed.",
                    details=registry_result,
                    error=error_message,
                )

                raise RuntimeError(
                    "Registry push failed: "
                    + error_message
                )

        else:
            update_stage(
                run,
                "registry_push",
                "skipped",
                message=(
                    "Registry push disabled "
                    "for this pipeline."
                ),
            )


        # ====================================================
        # STAGE 9 — DEPLOYMENT
        # ====================================================

        if pipeline["deployment_enabled"]:
            _, stage_timer = stage_start(
                run,
                "deployment",
            )

            deploy_image = (
                run.get("registry_image")
                or run.get("docker_image")
            )

            if not deploy_image:
                error_message = (
                    "No container image is available "
                    "for deployment."
                )

                stage_finish(
                    run,
                    "deployment",
                    stage_timer,
                    status="failed",
                    message=error_message,
                    error=error_message,
                )

                raise RuntimeError(
                    error_message
                )

            deployment_result = (
                deploy_azure_container(
                    deploy_image
                )
            )

            run["deployment"] = deployment_result

            if deployment_result.get(
                "status"
            ) == "success":

                stage_finish(
                    run,
                    "deployment",
                    stage_timer,
                    status="success",
                    message=(
                        "Deployment completed successfully."
                    ),
                    details=deployment_result,
                )

            else:
                error_message = deployment_result.get(
                    "message",
                    "Deployment failed.",
                )

                stage_finish(
                    run,
                    "deployment",
                    stage_timer,
                    status="failed",
                    message="Deployment failed.",
                    details=deployment_result,
                    error=error_message,
                )

                raise RuntimeError(
                    "Deployment failed: "
                    + error_message
                )

        else:
            update_stage(
                run,
                "deployment",
                "skipped",
                message=(
                    "Deployment disabled for this pipeline."
                ),
            )

        # ====================================================
        # PIPELINE SUCCESS
        # ====================================================

        completed_at = utc_now()

        run["status"] = "success"
        run["completed_at"] = completed_at

        pipeline["status"] = "success"
        pipeline["updated_at"] = completed_at

        pipeline["last_scan_id"] = (
            scan["id"]
            if scan
            else None
        )

        pipeline["last_scan_status"] = (
            "completed"
            if scan
            else None
        )

        pipeline["last_security_score"] = (
            security_score
        )

        pipeline["last_files_scanned"] = (
            result.get(
                "files_scanned",
                0,
            )
        )

        pipeline["last_findings"] = len(
            all_findings
        )

        pipeline["last_error"] = None

        pipeline["stages"] = run[
            "stages"
        ]
        
        save_pipeline_run(run)
        save_pipeline(pipeline)

        return jsonify(
            {
                "success": True,
                "message": (
                    "DevSecOps pipeline completed successfully."
                ),
                "pipeline": pipeline,
                "run": run,
                "scan": scan,
                "findings": run[
                    "findings"
                ],
            }
        ), 201

    except Exception as error:

        error_message = str(
            error
        )

        failed_at = utc_now()

        run["status"] = "failed"
        run["completed_at"] = failed_at
        run["error"] = error_message

        pipeline["status"] = "failed"
        pipeline["updated_at"] = failed_at
        pipeline["last_error"] = error_message

        if scan is not None:

            try:
                update_scan(
                    scan_id=scan["id"],
                    status="failed",
                    completed_at=failed_at,
                )
            except Exception:
                pass

            pipeline["last_scan_id"] = (
                scan["id"]
            )

            pipeline["last_scan_status"] = (
                "failed"
            )

        pipeline["stages"] = run[
            "stages"
        ]
        
        save_pipeline_run(run)
        save_pipeline(pipeline)

        return jsonify(
            {
                "success": False,
                "message": (
                    "DevSecOps pipeline failed."
                ),
                "error": error_message,
                "pipeline": pipeline,
                "run": run,
                "scan_id": (
                    scan["id"]
                    if scan
                    else None
                ),
            }
        ), 500

    finally:

        # Workspace is temporary and should not
        # remain after the pipeline execution.
        if workspace:
            shutil.rmtree(
                workspace,
                ignore_errors=True,
            )


# ============================================================
# PIPELINE RUN HISTORY
# ============================================================

@pipelines_bp.get(
    "/<int:pipeline_id>/runs"
)
def pipeline_runs_list(pipeline_id):

    pipeline = find_pipeline(
        pipeline_id
    )

    if pipeline is None:
        return jsonify(
            {
                "success": False,
                "error": "Pipeline not found.",
            }
        ), 404

    runs = get_pipeline_runs(pipeline_id)

    return jsonify(
        {
            "success": True,
            "count": len(runs),
            "runs": runs,
        }
    )


# ============================================================
# SINGLE RUN
# ============================================================

@pipelines_bp.get(
    "/runs/<int:run_id>"
)
def pipeline_run_details(run_id):

    run = find_run(
        run_id
    )

    if run is None:
        return jsonify(
            {
                "success": False,
                "error": "Pipeline run not found.",
            }
        ), 404

    return jsonify(
        {
            "success": True,
            "run": run,
        }
    )