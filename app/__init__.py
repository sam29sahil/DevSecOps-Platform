from pathlib import Path
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

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


def create_app():
    app = Flask(__name__)
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                    "http://localhost:3000",
                    "http://127.0.0.1:3000",
                ]
            }
        }
    )

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