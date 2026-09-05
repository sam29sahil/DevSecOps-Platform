from flask import Flask, jsonify

from app.models import init_db
from app.routes import projects_bp, scans_bp, vulnerabilities_bp, pipelines_bp, reports_bp, containers_bp, aws_bp
from flask_cors import CORS


def create_app():
    app = Flask(__name__)
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [
                    "http://localhost:5173",
                    "http://localhost:3000",
                    "https://devsecops-platform1.onrender.com",
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
    @app.get("/api/health")
    def health_check():
        return jsonify({
            "success": True,
            "service": "DevSecOps Platform API",
            "status": "operational",
        })

    @app.get("/")
    def api_root():
        return jsonify({
            "success": True,
            "service": "DevSecOps Platform API",
            "message": "Backend is running",
            "version": "1.0.0",
        })

    return app