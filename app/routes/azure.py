from flask import Blueprint, jsonify
import os

from azure.identity import DefaultAzureCredential
from azure.mgmt.resource.resources import ResourceManagementClient
from azure.mgmt.resource.subscriptions import SubscriptionClient


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


# ============================================================
# AZURE CLIENT
# ============================================================

def get_azure_clients():
    """
    Create Azure SDK clients using Managed Identity.

    Locally, DefaultAzureCredential can use Azure CLI login.
    In Azure Container Apps, it automatically uses the
    Container App's managed identity.
    """

    credential = DefaultAzureCredential()

    subscription_id = os.getenv("AZURE_SUBSCRIPTION_ID")

    if not subscription_id:
        subscription_client = SubscriptionClient(
            credential
        )

        subscriptions = list(
            subscription_client.subscriptions.list()
        )

        if not subscriptions:
            raise RuntimeError(
                "No Azure subscription is available "
                "to the managed identity."
            )

        subscription = subscriptions[0]
        subscription_id = subscription.subscription_id

    resource_client = ResourceManagementClient(
        credential,
        subscription_id,
    )

    return credential, subscription_id, resource_client


# ============================================================
# SERIALIZE AZURE RESOURCE
# ============================================================

def serialize_resource(resource):
    """
    Convert Azure SDK resource object into a JSON-safe
    dictionary for the frontend.
    """

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

        subscription_client = SubscriptionClient(
            credential
        )

        subscription = subscription_client.subscriptions.get(
            subscription_id
        )

        return jsonify({
            "success": True,
            "connected": True,
            "status": "connected",
            "subscription": (
                getattr(subscription, "display_name", None)
                or subscription_id
            ),
            "subscription_id": subscription_id,
            "subscription_state": (
                getattr(subscription, "state", None)
                or "Unknown"
            ),
        })

    except Exception as error:

        return jsonify({
            "success": False,
            "connected": False,
            "status": "disconnected",
            "error": str(error),
        }), 503

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

        credential, subscription_id, resource_client = (
            get_azure_clients()
        )

        subscription_client = SubscriptionClient(
            credential
        )

        subscription = subscription_client.subscriptions.get(
            subscription_id
        )

        resources = []

        for resource in resource_client.resources.list():

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

        return jsonify({
            "success": True,
            "connected": True,

            "subscription": {
                "name": (
                    getattr(
                        subscription,
                        "display_name",
                        None,
                    )
                    or subscription_id
                ),

                "id": subscription_id,

                "state": (
                    getattr(
                        subscription,
                        "state",
                        None,
                    )
                    or "Unknown"
                ),

                "tenant_id": (
                    os.getenv(
                        "AZURE_TENANT_ID"
                    )
                    or "—"
                ),

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

        credential, subscription_id, resource_client = (
            get_azure_clients()
        )

        resources = []

        for resource in resource_client.resources.list():

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