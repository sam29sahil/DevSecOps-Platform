from flask import Blueprint, jsonify

from app.services.aws_service import AwsService


aws_bp = Blueprint("aws", __name__, url_prefix="/api/aws")


def _aws_error(error):
    return jsonify({
        "success": False,
        "provider": "AWS",
        "connected": False,
        "error": str(error),
    }), 503


@aws_bp.get("/status")
def aws_status():
    try:
        return jsonify(AwsService().status())
    except Exception as error:
        return _aws_error(error)


@aws_bp.get("/ecr")
def aws_ecr():
    try:
        service = AwsService()
        return jsonify({
            "success": True,
            "provider": "AWS",
            "connected": True,
            "repository": service.repository_info(),
        })
    except Exception as error:
        return _aws_error(error)


@aws_bp.get("/images")
def aws_images():
    try:
        service = AwsService()
        return jsonify({
            "success": True,
            "provider": "AWS",
            "repository": service.repository,
            "images": service.images(),
        })
    except Exception as error:
        return _aws_error(error)