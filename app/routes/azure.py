from flask import Blueprint, jsonify
import os

from azure.identity import DefaultAzureCredential
from azure.mgmt.resource.resources import ResourceManagementClient


azure_bp = Blueprint(
    "azure",
    __name__,
    url_prefix="/api/azure",
)


# ============================================================
# AZURE CONFIGURATION
# ============================================================

RESOURCE_GROUP = os.getenv(
    "AZURE_RESOURCE_GROUP",
    "NetworkWatcherRG",
)

AZURE_SUBSCRIPTION_ID = os.getenv(
    "AZURE_SUBSCRIPTION_ID",
    "ef50c11e-d07b-45e1-bd21-65d08c73c3cd",
)


# ============================================================
# AZURE CLIENT
# ============================================================

def get_azure_clients():
    """
    Create Azure SDK client using DefaultAzureCredential.

    Locally:
        DefaultAzureCredential can use Azure CLI login.

    Azure Container Apps:
        DefaultAzureCredential uses the Container App's
        managed identity.
    """

    credential = DefaultAzureCredential()

    resource_client = ResourceManagementClient(
        credential,
        AZURE_SUBSCRIPTION_ID,
    )

    return credential, AZURE_SUBSCRIPTION_ID, resource_client


# ============================================================
# SERIALIZE RESOURCE
# ============================================================

def serialize_resource(resource):
    return {
        "id": getattr(resource, "id", None),
        "name": getattr(resource, "name", None),
        "type": getattr(resource, "type", None),
        "location": getattr(resource, "location", None),
        "resource_group": RESOURCE_GROUP,
        "tags": getattr(resource, "tags", None) or {},
    }


# ============================================================
# AZURE HEALTH
# ============================================================

@azure_bp.get("/health")
def azure_health():

    try:

        credential, subscription_id, resource_client = (
            get_azure_clients()
        )

        # Force an authenticated Azure API request.
        # This verifies that the managed identity / credential
        # actually has access to Azure resources.

        resources = resource_client.resources.list(
            filter=f"resourceGroup eq '{RESOURCE_GROUP}'"
        )

        # Consume one result if available.
        next(iter(resources), None)

        return jsonify({
            "success": True,
            "connected": True,
            "status": "connected",
            "subscription": "Azure subscription 1",
            "subscription_id": subscription_id,
            "subscription_state": "Enabled",
        })

    except Exception as error:

        return jsonify({
            "success": False,
            "connected": False,
            "status": "disconnected",
            "error": str(error),
        }), 503


# ============================================================
# AZURE OVERVIEW
# ============================================================

@azure_bp.get("/overview")
def azure_overview():

    try:

        _, subscription_id, resource_client = (
            get_azure_clients()
        )

        resources = []

        for resource in resource_client.resources.list(
            filter=f"resourceGroup eq '{RESOURCE_GROUP}'"
        ):

            resources.append(
                serialize_resource(resource)
            )

        resource_summary = {}

        for resource in resources:

            resource_type = (
                resource.get("type")
                or "Unknown"
            )

            resource_summary[resource_type] = (
                resource_summary.get(resource_type, 0) + 1
            )

        # --------------------------------------------------------
        # GET TENANT ID
        # --------------------------------------------------------

        tenant_id = os.getenv("AZURE_TENANT_ID")

        # If AZURE_TENANT_ID is not configured, obtain it
        # from the currently authenticated Azure CLI account.
        if not tenant_id:

            try:

                result = subprocess.run(
                    [
                        "az",
                        "account",
                        "show",
                        "--query",
                        "tenantId",
                        "-o",
                        "tsv",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=15,
                    check=False,
                )

                if result.returncode == 0:

                    tenant_id = (
                        result.stdout.strip()
                        or None
                    )

            except (
                subprocess.TimeoutExpired,
                FileNotFoundError,
                Exception,
            ):

                tenant_id = None

        tenant_id = tenant_id or "—"

        # --------------------------------------------------------
        # RESPONSE
        # --------------------------------------------------------

        return jsonify({

            "success": True,

            "connected": True,

            "subscription": {
                "name": "Azure subscription 1",
                "id": subscription_id,
                "state": "Enabled",
                "tenant_id": tenant_id,
                "environment": "AzureCloud",
            },

            "resources": {
                "count": len(resources),
                "items": resources,
                "by_type": resource_summary,
            },

        })

    except Exception as error:

        return jsonify({

            "success": False,

            "connected": False,

            "error": str(error),

            "resources": {
                "count": 0,
                "items": [],
                "by_type": {},
            },

        }), 503
# ============================================================
# AZURE RESOURCES
# ============================================================

@azure_bp.get("/resources")
def azure_resources():

    try:

        _, subscription_id, resource_client = (
            get_azure_clients()
        )

        resources = []

        for resource in resource_client.resources.list(
            filter=f"resourceGroup eq '{RESOURCE_GROUP}'"
        ):

            resources.append(
                serialize_resource(resource)
            )

        return jsonify({
            "success": True,
            "count": len(resources),
            "resources": resources,
        })

    except Exception as error:

        return jsonify({
            "success": False,
            "resources": [],
            "error": str(error),
        }), 503