"""Render API helpers for automatic image-backed application deployments.

The API key and workspace ID belong only in the backend environment. ECR
credentials are refreshed before each deployment because ECR auth tokens expire.
"""
import base64
import hashlib
import os
import re
from urllib.parse import urlsplit

import boto3
import requests


RENDER_API_BASE = "https://api.render.com/v1"
RENDER_ECR_CREDENTIAL_NAME = "devsecops-platform-ecr"
TERMINAL_FAILURES = {
    "build_failed",
    "update_failed",
    "canceled",
    "pre_deploy_failed",
    "deactivated",
}


def _config():
    api_key = os.getenv("RENDER_API_KEY", "").strip()
    owner_id = os.getenv("RENDER_OWNER_ID", "").strip()
    if not api_key:
        raise RuntimeError("Render deployment is not configured: RENDER_API_KEY is missing.")
    if not owner_id:
        raise RuntimeError("Render deployment is not configured: RENDER_OWNER_ID is missing.")
    return api_key, owner_id


def _request(method, path, *, params=None, payload=None):
    api_key, _ = _config()
    try:
        response = requests.request(
            method,
            f"{RENDER_API_BASE}{path}",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            params=params,
            json=payload,
            timeout=30,
        )
    except requests.RequestException as exc:
        raise RuntimeError(f"Render API request failed: {exc.__class__.__name__}.") from exc

    if not response.ok:
        # Avoid including request headers or credentials in logs/errors.
        try:
            body = response.json()
            detail = body.get("message") or body.get("error") or body.get("errors")
            if isinstance(detail, (dict, list)):
                detail = str(detail)
        except ValueError:
            detail = ""
        detail = str(detail or response.reason or "request rejected")[:400]
        raise RuntimeError(f"Render API returned HTTP {response.status_code}: {detail}")

    if response.status_code == 204 or not response.content:
        return None
    try:
        return response.json()
    except ValueError as exc:
        raise RuntimeError("Render API returned an invalid JSON response.") from exc


def _unwrap_service(item):
    if not isinstance(item, dict):
        return {}
    nested = item.get("service")
    return nested if isinstance(nested, dict) else item


def _ecr_password():
    region = os.getenv("AWS_REGION", "ap-south-1").strip()
    registry = os.getenv("CONTAINER_REGISTRY", "").strip()
    if not registry:
        account_id = os.getenv("AWS_ACCOUNT_ID", "").strip()
        if account_id:
            registry = f"{account_id}.dkr.ecr.{region}.amazonaws.com"
    if not registry:
        raise RuntimeError("CONTAINER_REGISTRY must be configured for Render ECR deployments.")

    try:
        client = boto3.client("ecr", region_name=region)
        response = client.get_authorization_token()
        entries = response.get("authorizationData") or []
        if not entries or not entries[0].get("authorizationToken"):
            raise RuntimeError("AWS ECR did not return an authorization token.")
        decoded = base64.b64decode(entries[0]["authorizationToken"]).decode("utf-8")
        username, separator, password = decoded.partition(":")
        if not separator or not username or not password:
            raise RuntimeError("AWS ECR returned an invalid authorization token.")
        return registry, username, password
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(
            "Could not obtain an AWS ECR token. Check the backend's AWS credentials and ECR permissions."
        ) from exc


def _refresh_ecr_registry_credential(owner_id):
    registry_host, username, password = _ecr_password()
    payload = {
        "registry": "AWS_ECR",
        "name": RENDER_ECR_CREDENTIAL_NAME,
        "username": username,
        "authToken": password,
        "ownerId": owner_id,
    }

    response = _request(
        "GET",
        "/registrycredentials",
        params={"ownerId": owner_id, "limit": 100},
    )
    credentials = response if isinstance(response, list) else []
    match = None
    for item in credentials:
        credential = item.get("registryCredential", item) if isinstance(item, dict) else {}
        if (
            credential.get("name") == RENDER_ECR_CREDENTIAL_NAME
            and credential.get("registry") == "AWS_ECR"
        ):
            match = credential
            break

    if match and match.get("id"):
        credential = _request(
            "PATCH",
            f"/registrycredentials/{match['id']}",
            payload={key: payload[key] for key in ("registry", "name", "username", "authToken")},
        )
        credential = credential if isinstance(credential, dict) else match
    else:
        credential = _request("POST", "/registrycredentials", payload=payload)

    credential_id = credential.get("id") if isinstance(credential, dict) else None
    if not credential_id:
        raise RuntimeError("Render did not return an ECR registry credential ID.")
    return credential_id, registry_host


def _service_name(repository_url):
    parsed = urlsplit(str(repository_url or "").strip())
    if parsed.scheme != "https" or parsed.netloc.lower() not in {"github.com", "www.github.com"}:
        raise RuntimeError("Only HTTPS GitHub repository URLs can be deployed.")
    parts = [part for part in parsed.path.strip("/").split("/") if part]
    if len(parts) != 2:
        raise RuntimeError("Repository URL must have the form https://github.com/owner/repository.")
    owner, repository = parts
    repository = repository.removesuffix(".git")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", owner) or not re.fullmatch(r"[A-Za-z0-9_.-]+", repository):
        raise RuntimeError("The GitHub repository URL contains unsupported characters.")
    identity = f"{owner.lower()}/{repository.lower()}"
    suffix = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:7]
    readable = re.sub(r"[^a-z0-9-]+", "-", repository.lower()).strip("-")[:28] or "app"
    return f"dsp-{readable}-{suffix}"


def _find_service(owner_id, name):
    response = _request(
        "GET",
        "/services",
        params={"ownerId": owner_id, "name": name, "limit": 100},
    )
    items = response if isinstance(response, list) else []
    for item in items:
        service = _unwrap_service(item)
        if service.get("name") == name and service.get("id"):
            return service
    return None


def _service_url(service_id, fallback=None):
    try:
        service = _request("GET", f"/services/{service_id}")
        service = _unwrap_service(service)
        details = service.get("serviceDetails") or {}
        return details.get("url") or service.get("url") or fallback
    except RuntimeError:
        return fallback


def start_render_deployment(image_url, repository_url):
    """Create a service for a repository once, then deploy newer image tags to it."""
    api_key, owner_id = _config()
    del api_key  # _request applies the key to each API call.

    image_url = str(image_url or "").strip()
    if not image_url:
        raise RuntimeError("The ECR image URL is missing.")

    expected_repository = (
        os.getenv("CONTAINER_REGISTRY_REPOSITORY")
        or os.getenv("AWS_ECR_REPOSITORY")
        or "devsecops-platform"
    ).strip("/")
    registry_host = os.getenv("CONTAINER_REGISTRY", "").strip()
    if not registry_host:
        region = os.getenv("AWS_REGION", "ap-south-1").strip()
        account_id = os.getenv("AWS_ACCOUNT_ID", "").strip()
        if account_id:
            registry_host = f"{account_id}.dkr.ecr.{region}.amazonaws.com"
    if not registry_host or not image_url.startswith(f"{registry_host}/{expected_repository}:"):
        raise RuntimeError("The image URL does not match the configured ECR repository.")

    credential_id, registry_host = _refresh_ecr_registry_credential(owner_id)
    service_name = _service_name(repository_url)
    service = _find_service(owner_id, service_name)
    created = service is None

    if created:
        image_region = os.getenv("RENDER_REGION", "singapore").strip().lower()
        allowed_regions = {"frankfurt", "oregon", "ohio", "singapore", "virginia"}
        if image_region not in allowed_regions:
            image_region = "singapore"
        plan = os.getenv("RENDER_PLAN", "free").strip().lower() or "free"
        payload = {
            "type": "web_service",
            "name": service_name,
            "ownerId": owner_id,
            "autoDeployTrigger": "off",
            "image": {
                "imagePath": image_url,
                "registryCredentialId": credential_id,
            },
            "serviceDetails": {
                "plan": plan,
                "region": image_region,
            },
        }
        response = _request("POST", "/services", payload=payload)
        service = _unwrap_service(response)
        deploy_id = response.get("deployId") if isinstance(response, dict) else None
    else:
        service_id = service["id"]
        # For image-backed services, Render permits the tag to change while the
        # registry host, repository, and image name remain the same.
        response = _request(
            "POST",
            f"/services/{service_id}/deploys",
            payload={"imageUrl": image_url, "clearCache": "do_not_clear"},
        )
        deploy_id = response.get("id") if isinstance(response, dict) else None

    service_id = service.get("id") if isinstance(service, dict) else None
    if not service_id:
        raise RuntimeError("Render did not return a service ID.")
    if not deploy_id:
        # A newly created image-backed service normally returns deployId.
        # If it doesn't, trigger an explicit deploy of the same image.
        response = _request(
            "POST",
            f"/services/{service_id}/deploys",
            payload={"imageUrl": image_url, "clearCache": "do_not_clear"},
        )
        deploy_id = response.get("id") if isinstance(response, dict) else None
    if not deploy_id:
        raise RuntimeError("Render did not return a deployment ID.")

    return {
        "service_id": service_id,
        "deploy_id": deploy_id,
        "service_name": service_name,
        "service_url": _service_url(service_id),
        "image_url": image_url,
        "created": created,
    }


def get_render_deployment_status(service_id, deploy_id):
    """Return a sanitized status for a specific Render deployment."""
    if not service_id or not deploy_id:
        raise RuntimeError("Render service or deployment ID is missing.")
    deployment = _request(
        "GET",
        f"/services/{service_id}/deploys/{deploy_id}",
    )
    if not isinstance(deployment, dict):
        raise RuntimeError("Render returned an invalid deployment status.")
    status = str(deployment.get("status") or "unknown").lower()
    service_url = _service_url(service_id)
    return {
        "status": status,
        "terminal": status == "live" or status in TERMINAL_FAILURES,
        "success": status == "live",
        "error": (
            deployment.get("status") if status in TERMINAL_FAILURES else None
        ),
        "service_url": service_url,
        "deploy_id": deployment.get("id") or deploy_id,
        "service_id": service_id,
    }
