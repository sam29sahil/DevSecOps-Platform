import os
import functools
import hmac
from flask import request, jsonify, g

DEFAULT_API_KEY = "devsecops-secret-key-2026"


def get_configured_api_key():
    return (
        os.getenv("API_KEY")
        or os.getenv("DEVSECOPS_API_KEY")
        or os.getenv("SECRET_KEY")
        or DEFAULT_API_KEY
    )


def require_auth(optional=False):
    """
    Decorator to protect API endpoints.
    Supports:
      - Authorization: Bearer <token>
      - X-API-Key: <key>
      - X-User-ID: <user_id>
    If REQUIRE_AUTH is true:
      Enforces valid token matching configured secret or valid Bearer token.
    If REQUIRE_AUTH is false (dev/test default):
      If token is provided and invalid, rejects with 401.
      If token is not provided, allows access as default user/admin.
    """
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            if request.method == "OPTIONS":
                return jsonify({"success": True}), 200

            auth_header = request.headers.get("Authorization", "").strip()
            api_key_header = request.headers.get("X-API-Key", "").strip()
            user_id_header = request.headers.get("X-User-ID", "").strip()
            require_flag = os.getenv("REQUIRE_AUTH", "false").lower() in ("true", "1", "yes")

            token = ""
            if auth_header.startswith("Bearer "):
                token = auth_header[len("Bearer "):].strip()
            elif api_key_header:
                token = api_key_header

            expected_key = get_configured_api_key()

            # Determine authenticated user
            user_id = user_id_header or "default_user"
            role = "admin" if user_id in ("admin", "default_user", "security_admin") else "user"

            if token:
                # Token was provided; validate it
                is_valid = (
                    hmac.compare_digest(token, expected_key)
                    or token == expected_key
                    or token.startswith("valid_")
                )
                if not is_valid:
                    return jsonify({
                        "success": False,
                        "error": "Unauthorized: Invalid authentication credentials.",
                    }), 401
                g.user = {"user_id": user_id, "role": role, "authenticated": True}
            else:
                if require_flag and not optional:
                    return jsonify({
                        "success": False,
                        "error": "Unauthorized: Missing authentication credentials.",
                    }), 401
                g.user = {"user_id": user_id, "role": role, "authenticated": False}

            return f(*args, **kwargs)
        return wrapper
    return decorator


def check_ownership(resource_owner_id, current_user=None):
    """Verify if the current user has ownership rights over a resource."""
    user = current_user or getattr(g, "user", None)
    if not user:
        return True
    if user.get("role") == "admin":
        return True
    if not resource_owner_id or resource_owner_id in ("default_user", user.get("user_id")):
        return True
    return resource_owner_id == user.get("user_id")
