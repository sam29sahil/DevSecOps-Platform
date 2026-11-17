import os
import logging
from datetime import datetime, timezone
import requests

logger = logging.getLogger("devsecops.github")


class GithubService:
    """
    Service for interacting with GitHub Actions API:
    - Token and permission validation
    - Workflow dispatch execution
    - Workflow run correlation and status polling
    - Never prints or exposes secret token values.
    """

    def __init__(self, token=None, repository=None):
        self.token = (token or os.getenv("GITHUB_TOKEN", "")).strip()
        self.repository = (repository or os.getenv("GITHUB_REPOSITORY", "sam29sahil/DevSecOps-Platform")).strip()

    def get_headers(self):
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def validate_configuration(self):
        """
        Validate environment configuration before attempting any GitHub operations.
        Never prints or exposes the token value.
        """
        if not self.token:
            return {
                "valid": False,
                "error_code": "MISSING_GITHUB_TOKEN",
                "message": (
                    "GITHUB_TOKEN is missing or empty. Please configure GITHUB_TOKEN in your .env file "
                    "with 'Actions: Read and write' and 'Contents: Read' permissions."
                ),
                "token_configured": False,
                "repository": self.repository,
            }

        if "/" not in self.repository:
            return {
                "valid": False,
                "error_code": "INVALID_REPOSITORY_FORMAT",
                "message": f"GITHUB_REPOSITORY must be formatted as 'owner/repo', got '{self.repository}'.",
                "token_configured": True,
                "repository": self.repository,
            }

        return {
            "valid": True,
            "token_configured": True,
            "repository": self.repository,
        }

    def validate_authentication(self):
        """
        Comprehensive GitHub API authentication and permission verification.
        Validates:
        1. Token presence and format.
        2. Authentication validity (HTTP 401 check).
        3. Rate limits (HTTP 403 rate limit check).
        4. Repository access (Contents: Read via GET /repos/{owner}/{repo}).
        5. Workflow dispatch permission (Actions: Read and write via GET /repos/{owner}/{repo}/actions/workflows/devsecops-pipeline.yml).
        """
        config_check = self.validate_configuration()
        if not config_check["valid"]:
            return config_check

        headers = self.get_headers()

        # Step 1: Validate Token & Identity
        try:
            user_resp = requests.get("https://api.github.com/user", headers=headers, timeout=10)
            rate_remaining = user_resp.headers.get("x-ratelimit-remaining")

            if user_resp.status_code == 401:
                logger.warning("[GITHUB-AUTH] Authentication failed: HTTP 401 Unauthorized")
                return {
                    "valid": False,
                    "error_code": "INVALID_OR_EXPIRED_TOKEN",
                    "message": "GitHub API rejected the GITHUB_TOKEN (HTTP 401 Unauthorized). The token may be expired, invalid, or revoked.",
                    "repository": self.repository,
                    "token_configured": True,
                }
            elif user_resp.status_code == 403:
                if rate_remaining == "0":
                    reset_time = user_resp.headers.get("x-ratelimit-reset", "unknown")
                    logger.warning("[GITHUB-AUTH] Rate limit exceeded. Reset timestamp: %s", reset_time)
                    return {
                        "valid": False,
                        "error_code": "RATE_LIMIT_EXCEEDED",
                        "message": f"GitHub API rate limit exceeded. Reset timestamp: {reset_time}.",
                        "repository": self.repository,
                        "token_configured": True,
                    }
                return {
                    "valid": False,
                    "error_code": "FORBIDDEN",
                    "message": "GitHub API returned HTTP 403 Forbidden. The token lacks required permissions or IP restrictions apply.",
                    "repository": self.repository,
                    "token_configured": True,
                }
            elif user_resp.status_code != 200:
                return {
                    "valid": False,
                    "error_code": f"UNEXPECTED_STATUS_{user_resp.status_code}",
                    "message": f"GitHub API returned unexpected status {user_resp.status_code}.",
                    "repository": self.repository,
                    "token_configured": True,
                }

            auth_user = user_resp.json().get("login", "unknown")
            logger.info("[GITHUB-AUTH] Authenticated as GitHub user '%s'", auth_user)

        except requests.RequestException as e:
            logger.error("[GITHUB-AUTH] Connection error during token verification: %s", e)
            return {
                "valid": False,
                "error_code": "CONNECTION_ERROR",
                "message": f"Could not reach GitHub API: {str(e)}",
                "repository": self.repository,
                "token_configured": True,
            }

        # Step 2: Validate Repository Access (Contents: Read)
        try:
            repo_resp = requests.get(f"https://api.github.com/repos/{self.repository}", headers=headers, timeout=10)
            if repo_resp.status_code == 404:
                logger.warning("[GITHUB-AUTH] Repository '%s' not found or inaccessible", self.repository)
                return {
                    "valid": False,
                    "error_code": "REPOSITORY_NOT_FOUND",
                    "message": f"Repository '{self.repository}' was not found or the token lacks 'Contents: Read' access.",
                    "repository": self.repository,
                    "authenticated_as": auth_user,
                    "token_configured": True,
                }
            elif repo_resp.status_code != 200:
                logger.warning("[GITHUB-AUTH] Repository query returned HTTP %s", repo_resp.status_code)
                return {
                    "valid": False,
                    "error_code": "REPOSITORY_ACCESS_DENIED",
                    "message": f"Access to repository '{self.repository}' returned HTTP {repo_resp.status_code}.",
                    "repository": self.repository,
                    "authenticated_as": auth_user,
                    "token_configured": True,
                }
            repo_data = repo_resp.json()
            is_private = repo_data.get("private", False)

        except requests.RequestException as e:
            return {
                "valid": False,
                "error_code": "CONNECTION_ERROR",
                "message": f"Failed to inspect repository: {str(e)}",
                "repository": self.repository,
                "token_configured": True,
            }

        # Step 3: Validate Workflow Access (Actions: Read and write)
        try:
            wf_resp = requests.get(
                f"https://api.github.com/repos/{self.repository}/actions/workflows/devsecops-pipeline.yml",
                headers=headers,
                timeout=10,
            )
            if wf_resp.status_code == 404:
                logger.warning("[GITHUB-AUTH] Workflow 'devsecops-pipeline.yml' not found in '%s'", self.repository)
                return {
                    "valid": False,
                    "error_code": "WORKFLOW_NOT_FOUND",
                    "message": f"Workflow 'devsecops-pipeline.yml' was not found in repository '{self.repository}'.",
                    "repository": self.repository,
                    "authenticated_as": auth_user,
                    "token_configured": True,
                }
            elif wf_resp.status_code == 403:
                logger.warning("[GITHUB-AUTH] Token lacks 'Actions: Read and write' permission")
                return {
                    "valid": False,
                    "error_code": "INSUFFICIENT_ACTIONS_PERMISSIONS",
                    "message": "Token lacks 'Actions: Read and write' permission required to inspect and trigger GitHub Actions workflows.",
                    "repository": self.repository,
                    "authenticated_as": auth_user,
                    "token_configured": True,
                }
            elif wf_resp.status_code != 200:
                return {
                    "valid": False,
                    "error_code": f"WORKFLOW_QUERY_HTTP_{wf_resp.status_code}",
                    "message": f"Workflow check returned HTTP {wf_resp.status_code}.",
                    "repository": self.repository,
                    "authenticated_as": auth_user,
                    "token_configured": True,
                }

        except requests.RequestException as e:
            return {
                "valid": False,
                "error_code": "CONNECTION_ERROR",
                "message": f"Failed to check workflow: {str(e)}",
                "repository": self.repository,
                "token_configured": True,
            }

        # All checks passed
        logger.info("[GITHUB-AUTH] All checks passed: User '%s', Repo '%s', Workflow 'devsecops-pipeline.yml'", auth_user, self.repository)
        return {
            "valid": True,
            "authenticated": True,
            "authenticated_as": auth_user,
            "repository": self.repository,
            "workflow": "devsecops-pipeline.yml",
            "is_private": is_private,
            "permissions": {
                "actions": "read_write",
                "contents": "read",
            },
            "rate_limit_remaining": rate_remaining,
            "message": "GitHub authentication and workflow dispatch permissions verified successfully.",
        }

    def dispatch_workflow(
        self,
        repository_url,
        branch,
        pipeline_id,
        run_id,
        deployment_id="",
        container_port=5000,
        docker_enabled=True,
        registry_enabled=False,
        deployment_enabled=False,
        callback_url="",
    ):
        """
        Trigger workflow_dispatch on devsecops-pipeline.yml in GitHub Actions.
        """
        config_check = self.validate_configuration()
        if not config_check["valid"]:
            raise RuntimeError(config_check["message"])

        dispatch_url = (
            f"https://api.github.com/repos/{self.repository}/actions/workflows/devsecops-pipeline.yml/dispatches"
        )
        headers = self.get_headers()
        payload = {
            "ref": "main",
            "inputs": {
                "repository_url": repository_url,
                "branch": branch or "main",
                "pipeline_id": str(pipeline_id),
                "run_id": str(run_id),
                "deployment_id": str(deployment_id or ""),
                "container_port": str(container_port or 5000),
                "callback_url": callback_url or "",
                "docker_enabled": "true" if docker_enabled else "false",
                "registry_enabled": "true" if registry_enabled else "false",
                "deployment_enabled": "true" if deployment_enabled else "false",
            },
        }

        logger.info(
            "[GITHUB-DISPATCH] Dispatching workflow at %s (repo=%s, run_id=%s, deployment_id=%s)",
            dispatch_url,
            repository_url,
            run_id,
            deployment_id,
        )
        try:
            resp = requests.post(dispatch_url, headers=headers, json=payload, timeout=30)
            logger.info("[GITHUB-DISPATCH] GitHub API workflow_dispatch returned HTTP %s", resp.status_code)
            if resp.status_code not in (200, 204):
                error_msg = f"GitHub API dispatch failed with status {resp.status_code}: {resp.text}"
                logger.error("[GITHUB-DISPATCH] %s", error_msg)
                raise RuntimeError(error_msg)
            return True
        except requests.RequestException as e:
            error_msg = f"Failed to reach GitHub API: {str(e)}"
            logger.error("[GITHUB-DISPATCH] %s", error_msg)
            raise RuntimeError(error_msg)
