import logging
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# Reliably load .env from workspace root if it exists (skip when running test suites)
_is_testing = (
    "pytest" in sys.modules
    or "unittest" in sys.modules
    or bool(os.getenv("PYTEST_CURRENT_TEST"))
    or os.getenv("TESTING") == "true"
    or os.getenv("FLASK_ENV") == "testing"
)
if not _is_testing:
    _dotenv_path = Path(__file__).resolve().parent.parent / ".env"
    if _dotenv_path.is_file():
        load_dotenv(dotenv_path=_dotenv_path, override=False)

from app.models import init_db
from app.routes import (
    projects_bp,
    scans_bp,
    vulnerabilities_bp,
    pipelines_bp,
    reports_bp,
    containers_bp,
    aws_bp,
    deployments_bp,
    notifications_bp,
)


def get_cors_origins():
    """
    Compute allowed CORS origins from environment variables and dev defaults.
    Never uses wildcard '*' with credentials.
    Supports comma-separated CORS_ALLOWED_ORIGINS or FRONTEND_URL.
    """
    default_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    ]
    origins = list(default_origins)
    for env_var in ("CORS_ALLOWED_ORIGINS", "FRONTEND_URL"):
        val = os.getenv(env_var, "").strip()
        if val:
            for item in val.split(","):
                cleaned = item.strip().rstrip("/")
                if cleaned and cleaned not in origins:
                    origins.append(cleaned)
    return origins


def create_app():
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
    )
    app = Flask(__name__)

    cors_origins = get_cors_origins()
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": cors_origins,
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "allow_headers": [
                    "Content-Type",
                    "Authorization",
                    "X-API-Key",
                    "X-User-ID",
                    "Accept",
                    "Origin",
                    "X-Requested-With",
                ],
                "expose_headers": ["Content-Type", "Authorization"],
                "supports_credentials": True,
                "max_age": 600,
            }
        },
    )

    @app.before_request
    def handle_options_preflight():
        if request.path.startswith("/api") and request.method == "OPTIONS":
            return app.make_default_options_response()

    # Basic configuration
    app.config["JSON_SORT_KEYS"] = False

    # Initialize database
    init_db()

    # Register API blueprints
    app.register_blueprint(projects_bp)
    app.register_blueprint(scans_bp)
    app.register_blueprint(vulnerabilities_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(pipelines_bp)
    app.register_blueprint(containers_bp)
    app.register_blueprint(aws_bp)
    app.register_blueprint(deployments_bp)
    app.register_blueprint(notifications_bp)

    dist_dir = Path(__file__).resolve().parent.parent / "frontend" / "dist"

    @app.get("/api/health")
    def health_check():
        return jsonify({
            "success": True,
            "service": "DevSecOps Platform API",
            "status": "operational",
        })

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        if path.startswith("api"):
            return jsonify({"error": "API route not found"}), 404
        if dist_dir.exists():
            file_path = dist_dir / path
            if file_path.is_file():
                return send_from_directory(dist_dir, path)
            return send_from_directory(dist_dir, "index.html")
        return jsonify({
            "success": True,
            "service": "DevSecOps Platform API",
            "message": "Backend is running",
            "version": "1.0.0",
        })

    return app