import sqlite3
from pathlib import Path
from datetime import datetime


# ============================================================
# DATABASE
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_DIR = BASE_DIR / "data"
DATABASE_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_PATH = DATABASE_DIR / "devsecops.db"


def get_db():
    """Create and return a SQLite database connection."""

    connection = sqlite3.connect(DATABASE_PATH)
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
):
    """Create a new project."""

    db = get_db()

    now = datetime.utcnow().isoformat()

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
            status,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            name,
            description,
            repository_url,
            branch,
            source_directory,
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
):
    """Update an existing project."""

    db = get_db()

    now = datetime.utcnow().isoformat()

    source_directory = (
        str(source_directory).strip()
        if source_directory is not None
        else "."
    )

    if not source_directory:
        source_directory = "."

    cursor = db.execute(
        """
        UPDATE projects
        SET
            name = ?,
            description = ?,
            repository_url = ?,
            branch = ?,
            source_directory = ?,
            status = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            name,
            description,
            repository_url,
            branch,
            source_directory,
            status,
            now,
            project_id,
        ),
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

    now = datetime.utcnow().isoformat()

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

    now = datetime.utcnow().isoformat()

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