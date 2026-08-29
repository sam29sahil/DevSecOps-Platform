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

AZURE_TENANT_ID = os.getenv(
    "AZURE_TENANT_ID",
    "d9771191-1dae-4263-8e20-518671ad0a12",
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
        DefaultAzureCredential can use managed identity.
    """

    credential = DefaultAzureCredential()

    resource_client = ResourceManagementClient(
        credential,
        AZURE_SUBSCRIPTION_ID,
    )

    return (
        credential,
        AZURE_SUBSCRIPTION_ID,
        resource_client,
    )


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

        _, subscription_id, resource_client = (
            get_azure_clients()
        )

        resources = resource_client.resources.list(
            filter=f"resourceGroup eq '{RESOURCE_GROUP}'"
        )

        # Force Azure API request
        next(iter(resources), None)

        return jsonify({
            "success": True,
            "connected": True,
            "status": "connected",

            "subscription": "Azure subscription 1",

            "subscription_id": subscription_id,

            "subscription_state": "Enabled",

            "tenant_id": AZURE_TENANT_ID,
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

        # --------------------------------------------------------
        # RESOURCE SUMMARY
        # --------------------------------------------------------

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
        # RESPONSE
        # --------------------------------------------------------

        return jsonify({

            "success": True,

            "connected": True,

            "subscription": {
                "name": "Azure subscription 1",

                "id": subscription_id,

                "state": "Enabled",

                "tenant_id": AZURE_TENANT_ID,

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