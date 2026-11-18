import json
import os
import sqlite3
from pathlib import Path
from datetime import datetime, timezone


def utc_now():
    """Return ISO 8601 UTC timestamp with timezone awareness."""
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# DATABASE
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_DIR = BASE_DIR / "data"
DATABASE_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_DATABASE_PATH = DATABASE_DIR / "devsecops.db"


def get_database_path():
    env_path = os.getenv("DEVSECOPS_DB_PATH") or os.getenv("DATABASE_PATH")
    if env_path:
        return Path(env_path)
    return DEFAULT_DATABASE_PATH


def get_db():
    """Create and return a SQLite database connection."""

    connection = sqlite3.connect(get_database_path())
    connection.row_factory = sqlite3.Row

    return connection


def init_db():
    """Create database tables and apply safe schema updates."""

    db = get_db()

    # ========================================================
    # PROJECTS
    # ========================================================

    db.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            repository_url TEXT,
            branch TEXT DEFAULT 'main',
            source_directory TEXT DEFAULT '.',
            status TEXT DEFAULT 'active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    # --------------------------------------------------------
    # IMPORTANT:
    # Existing databases already have the projects table.
    # Add source_directory without deleting existing projects.
    # --------------------------------------------------------

    project_columns = {
        row["name"]
        for row in db.execute(
            "PRAGMA table_info(projects)"
        ).fetchall()
    }

    if "source_directory" not in project_columns:
        db.execute("""
            ALTER TABLE projects
            ADD COLUMN source_directory TEXT DEFAULT '.'
        """)

    # Make sure old projects receive the default value.

    db.execute("""
        UPDATE projects
        SET source_directory = '.'
        WHERE source_directory IS NULL
           OR TRIM(source_directory) = ''
    """)

    # ========================================================
    # SCANS
    # ========================================================

    db.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            files_scanned INTEGER DEFAULT 0,
            total_findings INTEGER DEFAULT 0,
            security_score INTEGER DEFAULT 100,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id)
                REFERENCES projects(id)
                ON DELETE CASCADE
        )
    """)

    # ========================================================
    # FINDINGS
    # ========================================================

    db.execute("""
        CREATE TABLE IF NOT EXISTS findings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id INTEGER NOT NULL,
            rule_id TEXT,
            title TEXT NOT NULL,
            severity TEXT NOT NULL,
            description TEXT,
            recommendation TEXT,
            file_path TEXT,
            line_number INTEGER,
            evidence TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (scan_id)
                REFERENCES scans(id)
                ON DELETE CASCADE
        )
    """)
    
        # ========================================================
    # PIPELINES
    # ========================================================

    db.execute("""
        CREATE TABLE IF NOT EXISTS pipelines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            branch TEXT DEFAULT 'main',
            repository_url TEXT DEFAULT '',
            project_id INTEGER,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_run TEXT,
            last_run_id INTEGER,
            last_scan_id INTEGER,
            last_scan_status TEXT,
            last_security_score INTEGER,
            last_files_scanned INTEGER DEFAULT 0,
            last_findings INTEGER DEFAULT 0,
            last_error TEXT,
            quality_gate_score INTEGER DEFAULT 70,
            fail_on_high INTEGER DEFAULT 1,
            docker_enabled INTEGER DEFAULT 1,
            registry_enabled INTEGER DEFAULT 0,
            deployment_enabled INTEGER DEFAULT 0,
            stages_json TEXT DEFAULT '[]',
            FOREIGN KEY (project_id)
                REFERENCES projects(id)
                ON DELETE SET NULL
        )
    """)

    # ========================================================
    # PIPELINE RUNS
    # ========================================================

    db.execute("""
        CREATE TABLE IF NOT EXISTS pipeline_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pipeline_id INTEGER NOT NULL,
            pipeline_name TEXT,
            status TEXT DEFAULT 'running',
            started_at TEXT,
            completed_at TEXT,
            repository_url TEXT DEFAULT '',
            branch TEXT DEFAULT 'main',
            workspace TEXT,
            stages_json TEXT DEFAULT '[]',
            scan_json TEXT,
            findings_json TEXT DEFAULT '[]',
            security_score INTEGER,
            quality_gate_json TEXT,
            error TEXT,
            FOREIGN KEY (pipeline_id)
                REFERENCES pipelines(id)
                ON DELETE CASCADE
        )
    """)

    # Safe migrations for pipeline_runs
    pipeline_run_cols = {
        row["name"]
        for row in db.execute("PRAGMA table_info(pipeline_runs)").fetchall()
    }
    if "app_url" not in pipeline_run_cols:
        db.execute("ALTER TABLE pipeline_runs ADD COLUMN app_url TEXT")
    if "deployment_id" not in pipeline_run_cols:
        db.execute("ALTER TABLE pipeline_runs ADD COLUMN deployment_id TEXT")
    if "github_run_id" not in pipeline_run_cols:
        db.execute("ALTER TABLE pipeline_runs ADD COLUMN github_run_id INTEGER")
    if "github_run_url" not in pipeline_run_cols:
        db.execute("ALTER TABLE pipeline_runs ADD COLUMN github_run_url TEXT")

    # Safe migrations for projects
    if "app_port" not in project_columns:
        db.execute("ALTER TABLE projects ADD COLUMN app_port INTEGER DEFAULT 5000")
    if "app_type" not in project_columns:
        db.execute("ALTER TABLE projects ADD COLUMN app_type TEXT DEFAULT 'web'")
    if "user_id" not in project_columns:
        db.execute("ALTER TABLE projects ADD COLUMN user_id TEXT DEFAULT 'default_user'")
    if "dockerfile_path" not in project_columns:
        db.execute("ALTER TABLE projects ADD COLUMN dockerfile_path TEXT DEFAULT 'Dockerfile'")
    if "build_context" not in project_columns:
        db.execute("ALTER TABLE projects ADD COLUMN build_context TEXT DEFAULT '.'")
    if "health_check_path" not in project_columns:
        db.execute("ALTER TABLE projects ADD COLUMN health_check_path TEXT DEFAULT '/'")

    # ========================================================
    # DEPLOYMENTS
    # ========================================================

    db.execute("""
        CREATE TABLE IF NOT EXISTS deployments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deployment_id TEXT UNIQUE NOT NULL,
            project_id INTEGER,
            pipeline_run_id INTEGER,
            app_name TEXT,
            repository_url TEXT,
            branch TEXT DEFAULT 'main',
            image_uri TEXT,
            ecr_repository TEXT,
            ecs_cluster TEXT,
            ecs_service TEXT,
            task_definition_arn TEXT,
            container_port INTEGER DEFAULT 5000,
            cpu TEXT DEFAULT '256',
            memory TEXT DEFAULT '512',
            platform TEXT DEFAULT 'AWS ECS Fargate',
            region TEXT DEFAULT 'ap-south-1',
            status TEXT DEFAULT 'pending',
            health_status TEXT DEFAULT 'unknown',
            app_url TEXT,
            error_message TEXT,
            user_id TEXT DEFAULT 'default_user',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            completed_at TEXT,
            FOREIGN KEY (project_id)
                REFERENCES projects(id)
                ON DELETE CASCADE,
            FOREIGN KEY (pipeline_run_id)
                REFERENCES pipeline_runs(id)
                ON DELETE SET NULL
        )
    """)

    dep_cols = {row["name"] for row in db.execute("PRAGMA table_info(deployments)").fetchall()}
    if "user_id" not in dep_cols:
        db.execute("ALTER TABLE deployments ADD COLUMN user_id TEXT DEFAULT 'default_user'")
    if "github_run_id" not in dep_cols:
        db.execute("ALTER TABLE deployments ADD COLUMN github_run_id INTEGER")
    if "github_run_url" not in dep_cols:
        db.execute("ALTER TABLE deployments ADD COLUMN github_run_url TEXT")

    # ========================================================
    # NOTIFICATIONS
    # ========================================================

    db.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            deployment_id TEXT,
            pipeline_run_id INTEGER,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            event_type TEXT NOT NULL,
            status TEXT DEFAULT 'info',
            read INTEGER DEFAULT 0,
            user_id TEXT DEFAULT 'default_user',
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id)
                REFERENCES projects(id)
                ON DELETE CASCADE
        )
    """)

    notif_cols = {row["name"] for row in db.execute("PRAGMA table_info(notifications)").fetchall()}
    if "user_id" not in notif_cols:
        db.execute("ALTER TABLE notifications ADD COLUMN user_id TEXT DEFAULT 'default_user'")

    db.commit()
    db.close()


# ============================================================
# PROJECTS
# ============================================================

def create_project(
    name,
    description="",
    repository_url="",
    branch="main",
    source_directory=".",
    app_port=5000,
    app_type="web",
    dockerfile_path="Dockerfile",
    build_context=".",
    health_check_path="/",
    user_id="default_user",
):
    """Create a new project."""

    db = get_db()

    now = utc_now()

    source_directory = (
        str(source_directory).strip()
        if source_directory is not None
        else "."
    )

    if not source_directory:
        source_directory = "."

    cursor = db.execute(
        """
        INSERT INTO projects
        (
            name,
            description,
            repository_url,
            branch,
            source_directory,
            app_port,
            app_type,
            dockerfile_path,
            build_context,
            health_check_path,
            user_id,
            status,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            name,
            description,
            repository_url,
            branch,
            source_directory,
            int(app_port or 5000),
            str(app_type or "web"),
            str(dockerfile_path or "Dockerfile"),
            str(build_context or "."),
            str(health_check_path or "/"),
            str(user_id or "default_user"),
            "active",
            now,
            now,
        ),
    )

    project_id = cursor.lastrowid

    db.commit()
    db.close()

    return get_project(project_id)


def get_projects():
    """Return all projects."""

    db = get_db()

    projects = db.execute(
        """
        SELECT *
        FROM projects
        ORDER BY id DESC
        """
    ).fetchall()

    db.close()

    return [dict(project) for project in projects]


def get_project(project_id):
    """Return one project by ID."""

    db = get_db()

    project = db.execute(
        """
        SELECT *
        FROM projects
        WHERE id = ?
        """,
        (project_id,),
    ).fetchone()

    db.close()

    if project is None:
        return None

    return dict(project)


def update_project(
    project_id,
    name,
    description="",
    repository_url="",
    branch="main",
    source_directory=".",
    status="active",
    app_port=None,
    app_type=None,
    dockerfile_path=None,
    build_context=None,
    health_check_path=None,
):
    """Update an existing project."""

    db = get_db()

    now = utc_now()

    source_directory = (
        str(source_directory).strip()
        if source_directory is not None
        else "."
    )

    if not source_directory:
        source_directory = "."

    fields = [
        "name = ?",
        "description = ?",
        "repository_url = ?",
        "branch = ?",
        "source_directory = ?",
        "status = ?",
        "updated_at = ?",
    ]
    values = [
        name,
        description,
        repository_url,
        branch,
        source_directory,
        status,
        now,
    ]

    if app_port is not None:
        fields.append("app_port = ?")
        values.append(int(app_port))

    if app_type is not None:
        fields.append("app_type = ?")
        values.append(str(app_type))

    if dockerfile_path is not None:
        fields.append("dockerfile_path = ?")
        values.append(str(dockerfile_path))

    if build_context is not None:
        fields.append("build_context = ?")
        values.append(str(build_context))

    if health_check_path is not None:
        fields.append("health_check_path = ?")
        values.append(str(health_check_path))

    values.append(project_id)

    cursor = db.execute(
        f"""
        UPDATE projects
        SET {", ".join(fields)}
        WHERE id = ?
        """,
        values,
    )

    db.commit()

    updated = cursor.rowcount > 0

    db.close()

    if not updated:
        return None

    return get_project(project_id)


def delete_project(project_id):
    """Delete a project."""

    db = get_db()

    cursor = db.execute(
        """
        DELETE FROM projects
        WHERE id = ?
        """,
        (project_id,),
    )

    db.commit()

    deleted = cursor.rowcount > 0

    db.close()

    return deleted


def get_project_count():
    """Return the number of active projects."""

    db = get_db()

    result = db.execute(
        """
        SELECT COUNT(*)
        FROM projects
        WHERE status = 'active'
        """
    ).fetchone()

    db.close()

    return result[0]


# ============================================================
# SCANS
# ============================================================

def create_scan(project_id):
    """Create a new security scan."""

    db = get_db()

    now = utc_now()

    cursor = db.execute(
        """
        INSERT INTO scans
        (
            project_id,
            status,
            files_scanned,
            total_findings,
            security_score,
            started_at,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            "running",
            0,
            0,
            100,
            now,
            now,
        ),
    )

    scan_id = cursor.lastrowid

    db.commit()
    db.close()

    return get_scan(scan_id)


def get_scan(scan_id):
    """Return one scan."""

    db = get_db()

    scan = db.execute(
        """
        SELECT
            scans.*,
            projects.name AS project_name
        FROM scans
        JOIN projects
            ON projects.id = scans.project_id
        WHERE scans.id = ?
        """,
        (scan_id,),
    ).fetchone()

    db.close()

    if scan is None:
        return None

    return dict(scan)


def get_scans(project_id=None):
    """Return scans, optionally filtered by project."""

    db = get_db()

    if project_id is None:
        scans = db.execute(
            """
            SELECT
                scans.*,
                projects.name AS project_name
            FROM scans
            JOIN projects
                ON projects.id = scans.project_id
            ORDER BY scans.id DESC
            """
        ).fetchall()

    else:
        scans = db.execute(
            """
            SELECT
                scans.*,
                projects.name AS project_name
            FROM scans
            JOIN projects
                ON projects.id = scans.project_id
            WHERE scans.project_id = ?
            ORDER BY scans.id DESC
            """,
            (project_id,),
        ).fetchall()

    db.close()

    return [dict(scan) for scan in scans]


def update_scan(
    scan_id,
    status=None,
    files_scanned=None,
    total_findings=None,
    security_score=None,
    completed_at=None,
):
    """Update scan information."""

    db = get_db()

    fields = []
    values = []

    if status is not None:
        fields.append("status = ?")
        values.append(status)

    if files_scanned is not None:
        fields.append("files_scanned = ?")
        values.append(files_scanned)

    if total_findings is not None:
        fields.append("total_findings = ?")
        values.append(total_findings)

    if security_score is not None:
        fields.append("security_score = ?")
        values.append(security_score)

    if completed_at is not None:
        fields.append("completed_at = ?")
        values.append(completed_at)

    if not fields:
        db.close()
        return get_scan(scan_id)

    values.append(scan_id)

    db.execute(
        f"""
        UPDATE scans
        SET {", ".join(fields)}
        WHERE id = ?
        """,
        values,
    )

    db.commit()
    db.close()

    return get_scan(scan_id)


# ============================================================
# FINDINGS
# ============================================================

def create_finding(
    scan_id,
    rule_id,
    title,
    severity,
    description,
    recommendation,
    file_path,
    line_number,
    evidence,
):
    """Store one security finding."""

    db = get_db()

    now = utc_now()

    cursor = db.execute(
        """
        INSERT INTO findings
        (
            scan_id,
            rule_id,
            title,
            severity,
            description,
            recommendation,
            file_path,
            line_number,
            evidence,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            scan_id,
            rule_id,
            title,
            severity,
            description,
            recommendation,
            file_path,
            line_number,
            evidence,
            now,
        ),
    )

    finding_id = cursor.lastrowid

    db.commit()
    db.close()

    return get_finding(finding_id)


def get_finding(finding_id):
    """Return one finding."""

    db = get_db()

    finding = db.execute(
        """
        SELECT *
        FROM findings
        WHERE id = ?
        """,
        (finding_id,),
    ).fetchone()

    db.close()

    if finding is None:
        return None

    return dict(finding)


def get_findings(scan_id=None):
    """Return findings, optionally filtered by scan."""

    db = get_db()

    if scan_id is None:
        findings = db.execute(
            """
            SELECT *
            FROM findings
            ORDER BY id DESC
            """
        ).fetchall()

    else:
        findings = db.execute(
            """
            SELECT *
            FROM findings
            WHERE scan_id = ?
            ORDER BY
                CASE severity
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'HIGH' THEN 2
                    WHEN 'MEDIUM' THEN 3
                    WHEN 'LOW' THEN 4
                    ELSE 5
                END,
                id DESC
            """,
            (scan_id,),
        ).fetchall()

    db.close()

    return [dict(finding) for finding in findings]


# ============================================================
# DEPLOYMENTS
# ============================================================

def create_deployment(
    project_id=None,
    pipeline_run_id=None,
    app_name="App",
    repository_url="",
    branch="main",
    image_uri="",
    ecr_repository="",
    ecs_cluster="devsecops-cluster",
    ecs_service="",
    task_definition_arn="",
    container_port=5000,
    cpu="256",
    memory="512",
    platform="AWS ECS Fargate",
    region="ap-south-1",
    status="pending",
    health_status="unknown",
    app_url="",
    error_message="",
    deployment_id=None,
    github_run_id=None,
    github_run_url=None,
    completed_at=None,
    user_id="default_user",
):
    """Create a new deployment record."""
    db = get_db()
    now = utc_now()

    if not deployment_id:
        import uuid
        deployment_id = f"deploy-{uuid.uuid4().hex[:8]}"

    cursor = db.execute(
        """
        INSERT INTO deployments (
            deployment_id,
            project_id,
            pipeline_run_id,
            app_name,
            repository_url,
            branch,
            image_uri,
            ecr_repository,
            ecs_cluster,
            ecs_service,
            task_definition_arn,
            container_port,
            cpu,
            memory,
            platform,
            region,
            status,
            health_status,
            app_url,
            error_message,
            github_run_id,
            github_run_url,
            completed_at,
            user_id,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            deployment_id,
            project_id,
            pipeline_run_id,
            app_name,
            repository_url,
            branch,
            image_uri,
            ecr_repository,
            ecs_cluster,
            ecs_service,
            task_definition_arn,
            int(container_port or 5000),
            str(cpu or "256"),
            str(memory or "512"),
            platform,
            region,
            status,
            health_status,
            app_url,
            error_message,
            github_run_id,
            github_run_url,
            completed_at,
            user_id or "default_user",
            now,
            now,
        ),
    )

    db.commit()
    db.close()
    return get_deployment(deployment_id)


def get_deployment(identifier):
    """Return one deployment by ID or deployment_id string."""
    db = get_db()
    if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
        row = db.execute(
            """
            SELECT d.*, p.name AS project_name
            FROM deployments d
            LEFT JOIN projects p ON p.id = d.project_id
            WHERE d.id = ?
            """,
            (int(identifier),),
        ).fetchone()
    else:
        row = db.execute(
            """
            SELECT d.*, p.name AS project_name
            FROM deployments d
            LEFT JOIN projects p ON p.id = d.project_id
            WHERE d.deployment_id = ?
            """,
            (str(identifier),),
        ).fetchone()

    db.close()
    if row is None:
        return None
    return dict(row)


def get_pipeline_run_record(run_id):
    """Return raw pipeline run dict by id."""
    if not run_id:
        return None
    try:
        db = get_db()
        row = db.execute("SELECT * FROM pipeline_runs WHERE id = ?", (int(run_id),)).fetchone()
        db.close()
        return dict(row) if row else None
    except Exception:
        return None


def get_deployments(project_id=None):
    """Return all deployments, optionally filtered by project_id."""
    db = get_db()
    if project_id is not None:
        rows = db.execute(
            """
            SELECT d.*, p.name AS project_name
            FROM deployments d
            LEFT JOIN projects p ON p.id = d.project_id
            WHERE d.project_id = ?
            ORDER BY d.id DESC
            """,
            (project_id,),
        ).fetchall()
    else:
        rows = db.execute(
            """
            SELECT d.*, p.name AS project_name
            FROM deployments d
            LEFT JOIN projects p ON p.id = d.project_id
            ORDER BY d.id DESC
            """,
        ).fetchall()

    db.close()
    return [dict(row) for row in rows]


def get_latest_deployment(project_id=None):
    """Return the most recent deployment, optionally filtered by project_id."""
    db = get_db()
    if project_id is not None:
        row = db.execute(
            """
            SELECT d.*, p.name AS project_name
            FROM deployments d
            LEFT JOIN projects p ON p.id = d.project_id
            WHERE d.project_id = ?
            ORDER BY d.id DESC
            LIMIT 1
            """,
            (project_id,),
        ).fetchone()
    else:
        row = db.execute(
            """
            SELECT d.*, p.name AS project_name
            FROM deployments d
            LEFT JOIN projects p ON p.id = d.project_id
            ORDER BY d.id DESC
            LIMIT 1
            """
        ).fetchone()

    db.close()
    if row is None:
        return None
    return dict(row)


def update_deployment(identifier, **updates):
    """Update fields of an existing deployment while preserving verified URL and health."""
    existing = get_deployment(identifier)
    if existing:
        if "app_url" in updates:
            incoming_url = str(updates.get("app_url") or "").strip()
            existing_url = str(existing.get("app_url") or "").strip()
            if existing_url and not incoming_url:
                updates.pop("app_url", None)
            else:
                updates["app_url"] = incoming_url

        if "health_status" in updates:
            incoming_health = str(updates.get("health_status") or "").strip().lower()
            existing_health = str(existing.get("health_status") or "").strip().lower()
            if existing_health == "healthy" and incoming_health in ("", "unknown", "pending"):
                updates.pop("health_status", None)

    db = get_db()
    now = utc_now()
    updates["updated_at"] = now

    fields = []
    values = []
    for key, val in updates.items():
        fields.append(f"{key} = ?")
        values.append(val)

    if not fields:
        db.close()
        return get_deployment(identifier)

    if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
        values.append(int(identifier))
        db.execute(
            f"UPDATE deployments SET {', '.join(fields)} WHERE id = ?",
            values,
        )
    else:
        values.append(str(identifier))
        db.execute(
            f"UPDATE deployments SET {', '.join(fields)} WHERE deployment_id = ?",
            values,
        )

    db.commit()
    db.close()
    return get_deployment(identifier)


def update_pipeline_run_deployment_info(
    run_id,
    app_url=None,
    health_status=None,
    deployment_details=None,
    github_run_id=None,
    github_run_url=None,
):
    """Keep pipeline_runs.app_url, GitHub run metadata, and deployment stage details synchronized without erasing saved values."""
    if not run_id:
        return None
    try:
        db = get_db()
        row = db.execute("SELECT * FROM pipeline_runs WHERE id = ?", (int(run_id),)).fetchone()
        if not row:
            db.close()
            return None

        record = dict(row)
        existing_url = str(record.get("app_url") or "").strip()
        incoming_url = str(app_url or "").strip()
        final_url = incoming_url or existing_url

        stages = []
        try:
            stages = json.loads(record.get("stages_json") or "[]")
        except Exception:
            stages = []

        stages_changed = False
        if isinstance(stages, list):
            for stage in stages:
                if isinstance(stage, dict) and stage.get("id") == "deployment":
                    prev_details = dict(stage.get("details") or {}) if isinstance(stage.get("details"), dict) else {}
                    merged = dict(prev_details)

                    if isinstance(deployment_details, dict):
                        for k, v in deployment_details.items():
                            if v is None:
                                continue
                            if isinstance(v, str) and not v.strip():
                                continue
                            if k == "health_status":
                                prev_h = str(merged.get("health_status") or "").strip().lower()
                                inc_h = str(v).strip().lower()
                                if prev_h == "healthy" and inc_h in ("", "unknown", "pending"):
                                    continue
                            merged[k] = v.strip() if isinstance(v, str) else v

                    if final_url:
                        merged["app_url"] = final_url
                        merged.pop("url", None)

                    if health_status:
                        prev_h = str(merged.get("health_status") or "").strip().lower()
                        inc_h = str(health_status).strip().lower()
                        if not (prev_h == "healthy" and inc_h in ("", "unknown", "pending")):
                            merged["health_status"] = inc_h

                    if merged != prev_details:
                        stage["details"] = merged
                        stages_changed = True
                    break

        update_cols = []
        update_vals = []
        if final_url and final_url != existing_url:
            update_cols.append("app_url = ?")
            update_vals.append(final_url)
        if github_run_id and str(github_run_id) != str(record.get("github_run_id") or ""):
            update_cols.append("github_run_id = ?")
            update_vals.append(github_run_id)
        if github_run_url and github_run_url != record.get("github_run_url"):
            update_cols.append("github_run_url = ?")
            update_vals.append(github_run_url)
        if stages_changed:
            update_cols.append("stages_json = ?")
            update_vals.append(json.dumps(stages))

        if update_cols:
            update_vals.append(int(run_id))
            db.execute(
                f"UPDATE pipeline_runs SET {', '.join(update_cols)} WHERE id = ?",
                update_vals,
            )
            db.commit()

        db.close()
        return get_pipeline_run_record(run_id)
    except Exception:
        return None


def delete_deployment(identifier):
    """Delete a deployment record."""
    db = get_db()
    if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
        cursor = db.execute("DELETE FROM deployments WHERE id = ?", (int(identifier),))
    else:
        cursor = db.execute("DELETE FROM deployments WHERE deployment_id = ?", (str(identifier),))
    db.commit()
    deleted = cursor.rowcount > 0
    db.close()
    return deleted


def get_deployment_stats():
    """Return deployment statistics."""
    db = get_db()
    total = db.execute("SELECT COUNT(*) FROM deployments").fetchone()[0]
    successful = db.execute(
        "SELECT COUNT(*) FROM deployments WHERE status IN ('deployed', 'success', 'running')"
    ).fetchone()[0]
    failed = db.execute(
        "SELECT COUNT(*) FROM deployments WHERE status = 'failed'"
    ).fetchone()[0]
    running = db.execute(
        "SELECT COUNT(*) FROM deployments WHERE status IN ('deployed', 'running') AND health_status = 'healthy'"
    ).fetchone()[0]
    db.close()

    latest = get_latest_deployment()
    return {
        "total": total,
        "successful": successful,
        "failed": failed,
        "running": running,
        "latest": latest,
    }


# ============================================================
# NOTIFICATIONS
# ============================================================

def create_notification(
    title,
    message,
    event_type,
    status="info",
    project_id=None,
    deployment_id=None,
    pipeline_run_id=None,
    user_id="default_user",
    **kwargs,
):
    """Store a persistent deployment or pipeline event notification."""
    db = get_db()
    now = utc_now()

    cursor = db.execute(
        """
        INSERT INTO notifications (
            project_id,
            deployment_id,
            pipeline_run_id,
            title,
            message,
            event_type,
            status,
            user_id,
            read,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        """,
        (
            project_id,
            deployment_id,
            pipeline_run_id,
            title,
            message,
            event_type,
            status,
            user_id or "default_user",
            now,
        ),
    )
    notif_id = cursor.lastrowid
    db.commit()

    row = db.execute("SELECT * FROM notifications WHERE id = ?", (notif_id,)).fetchone()
    db.close()
    return dict(row)


def get_pipeline_run_record(run_id):
    """Return raw pipeline run dict by id."""
    if not run_id:
        return None
    try:
        db = get_db()
        row = db.execute("SELECT * FROM pipeline_runs WHERE id = ?", (int(run_id),)).fetchone()
        db.close()
        return dict(row) if row else None
    except Exception:
        return None if row else None


def get_notifications(limit=50, unread_only=False):
    """Retrieve notifications, ordered newest first."""
    db = get_db()
    query = """
        SELECT n.*, p.name AS project_name
        FROM notifications n
        LEFT JOIN projects p ON p.id = n.project_id
    """
    params = []
    if unread_only:
        query += " WHERE n.read = 0"
    query += " ORDER BY n.id DESC LIMIT ?"
    params.append(limit)

    rows = db.execute(query, params).fetchall()

    unread_count = db.execute(
        "SELECT COUNT(*) FROM notifications WHERE read = 0"
    ).fetchone()[0]
    db.close()

    return {
        "notifications": [dict(r) for r in rows],
        "unread_count": unread_count,
        "total": len(rows),
    }


def mark_notification_read(notification_id=None, mark_all=False):
    """Mark a notification or all notifications as read."""
    db = get_db()
    if mark_all:
        db.execute("UPDATE notifications SET read = 1 WHERE read = 0")
    elif notification_id is not None:
        db.execute("UPDATE notifications SET read = 1 WHERE id = ?", (notification_id,))
    db.commit()
    db.close()
    return True


def clear_notifications():
    """Clear all notifications."""
    db = get_db()
    db.execute("DELETE FROM notifications")
    db.commit()
    db.close()
    return True