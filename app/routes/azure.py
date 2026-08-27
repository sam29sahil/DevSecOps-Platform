from flask import Blueprint, jsonify
import subprocess
import json


azure_bp = Blueprint(
    "azure",
    __name__,
    url_prefix="/api/azure",
)


def run_azure_command(args):
    """
    Execute an Azure CLI command and return parsed JSON.
    Read-only commands only.
    """

    try:
        result = subprocess.run(
            ["az"] + args,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )

        if result.returncode != 0:
            return None, (
                result.stderr.strip()
                or "Azure CLI command failed."
            )

        if not result.stdout.strip():
            return {}, None

        try:
            return json.loads(result.stdout), None
        except json.JSONDecodeError:
            return result.stdout.strip(), None

    except subprocess.TimeoutExpired:
        return None, "Azure CLI command timed out."

    except FileNotFoundError:
        return None, "Azure CLI was not found."

    except Exception as error:
        return None, str(error)


# ============================================================
# AZURE OVERVIEW
# ============================================================

@azure_bp.get("/overview")
def azure_overview():

    account, error = run_azure_command([
        "account",
        "show",
    ])

    if error:
        return jsonify({
            "success": False,
            "connected": False,
            "error": error,
        }), 503

    resources, resource_error = run_azure_command([
        "resource",
        "list",
    ])

    if resource_error:
        resources = []

    if not isinstance(resources, list):
        resources = []

    resource_summary = {}

    for resource in resources:
        resource_type = resource.get("type", "Unknown")

        resource_summary[resource_type] = (
            resource_summary.get(resource_type, 0) + 1
        )

    return jsonify({
        "success": True,
        "connected": True,

        "subscription": {
            "name": account.get("name"),
            "id": account.get("id"),
            "state": account.get("state"),
            "tenant_id": account.get("tenantId"),
            "environment": account.get("environmentName"),
        },

        "resources": {
            "count": len(resources),
            "items": resources,
            "by_type": resource_summary,
        },
    })


# ============================================================
# AZURE RESOURCES
# ============================================================

@azure_bp.get("/resources")
def azure_resources():

    resources, error = run_azure_command([
        "resource",
        "list",
    ])

    if error:
        return jsonify({
            "success": False,
            "resources": [],
            "error": error,
        }), 503

    if not isinstance(resources, list):
        resources = []

    return jsonify({
        "success": True,
        "count": len(resources),
        "resources": resources,
    })


# ============================================================
# AZURE HEALTH
# ============================================================

@azure_bp.get("/health")
def azure_health():

    account, error = run_azure_command([
        "account",
        "show",
    ])

    if error:
        return jsonify({
            "success": False,
            "connected": False,
            "status": "disconnected",
            "error": error,
        }), 503

    return jsonify({
        "success": True,
        "connected": True,
        "status": "connected",
        "subscription": account.get("name"),
        "subscription_state": account.get("state"),
    })