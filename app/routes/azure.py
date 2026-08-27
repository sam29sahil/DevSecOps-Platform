from flask import Blueprint, jsonify
import subprocess
import json
import os
import shutil


azure_bp = Blueprint(
    "azure",
    __name__,
    url_prefix="/api/azure",
)


def run_azure_command(args):
    """
    Execute Azure CLI on Windows or Linux/Docker
    and return parsed JSON.
    """

    try:
        # Automatically find Azure CLI:
        # Windows -> az.cmd
        # Linux/Docker -> /usr/bin/az
        az_path = shutil.which("az")

        if not az_path:
            az_path = shutil.which("az.cmd")

        if not az_path:
            return None, "Azure CLI was not found."

        result = subprocess.run(
            [az_path] + args,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
            env=os.environ.copy(),
        )

        if result.returncode != 0:
            return None, (
                result.stderr.strip()
                or result.stdout.strip()
                or "Azure CLI command failed."
            )

        output = result.stdout.strip()

        if not output:
            return {}, None

        return json.loads(output), None

    except subprocess.TimeoutExpired:
        return None, "Azure CLI command timed out."

    except FileNotFoundError:
        return None, "Azure CLI was not found."

    except json.JSONDecodeError:
        return None, "Invalid Azure CLI response."

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