from flask import Blueprint, jsonify
import subprocess
import json


containers_bp = Blueprint(
    "containers",
    __name__,
    url_prefix="/api/containers",
)


def run_docker_command(args):
    """
    Execute a Docker CLI command and return parsed JSON.
    """

    try:
        result = subprocess.run(
            ["docker"] + args,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )

        if result.returncode != 0:
            return None, result.stderr.strip() or "Docker command failed."

        return result.stdout.strip(), None

    except subprocess.TimeoutExpired:
        return None, "Docker command timed out."

    except FileNotFoundError:
        return None, "Docker CLI was not found."

    except Exception as error:
        return None, str(error)


# ============================================================
# LIST CONTAINERS
# ============================================================

@containers_bp.get("")
def list_containers():
    """
    Return Docker containers, including stopped containers.
    """

    output, error = run_docker_command([
        "ps",
        "-a",
        "--format",
        "{{json .}}",
    ])

    if error:
        return jsonify({
            "success": False,
            "error": error,
            "containers": [],
        }), 500

    containers = []

    if output:
        for line in output.splitlines():

            try:
                item = json.loads(line)

                containers.append({
                    "id": item.get("ID", ""),
                    "name": item.get("Names", ""),
                    "image": item.get("Image", ""),
                    "command": item.get("Command", ""),
                    "created": item.get("CreatedAt", ""),
                    "status": item.get("Status", ""),
                    "ports": item.get("Ports", ""),
                    "state": (
                        "running"
                        if item.get("Status", "").lower().startswith("up")
                        else "stopped"
                    ),
                })

            except json.JSONDecodeError:
                continue

    running = sum(
        1
        for container in containers
        if container["state"] == "running"
    )

    stopped = len(containers) - running

    return jsonify({
        "success": True,
        "count": len(containers),
        "running": running,
        "stopped": stopped,
        "containers": containers,
    })


# ============================================================
# CONTAINER DETAILS
# ============================================================

@containers_bp.get("/<container_id>")
def container_details(container_id):

    output, error = run_docker_command([
        "inspect",
        container_id,
    ])

    if error:
        return jsonify({
            "success": False,
            "error": error,
        }), 404

    try:
        details = json.loads(output)

        if not details:
            return jsonify({
                "success": False,
                "error": "Container not found.",
            }), 404

        return jsonify({
            "success": True,
            "container": details[0],
        })

    except json.JSONDecodeError:
        return jsonify({
            "success": False,
            "error": "Invalid Docker response.",
        }), 500


# ============================================================
# START CONTAINER
# ============================================================

@containers_bp.post("/<container_id>/start")
def start_container(container_id):

    _, error = run_docker_command([
        "start",
        container_id,
    ])

    if error:
        return jsonify({
            "success": False,
            "error": error,
        }), 400

    return jsonify({
        "success": True,
        "message": "Container started successfully.",
        "container_id": container_id,
    })


# ============================================================
# STOP CONTAINER
# ============================================================

@containers_bp.post("/<container_id>/stop")
def stop_container(container_id):

    _, error = run_docker_command([
        "stop",
        container_id,
    ])

    if error:
        return jsonify({
            "success": False,
            "error": error,
        }), 400

    return jsonify({
        "success": True,
        "message": "Container stopped successfully.",
        "container_id": container_id,
    })


# ============================================================
# REMOVE CONTAINER
# ============================================================

@containers_bp.delete("/<container_id>")
def remove_container(container_id):

    _, error = run_docker_command([
        "rm",
        container_id,
    ])

    if error:
        return jsonify({
            "success": False,
            "error": error,
        }), 400

    return jsonify({
        "success": True,
        "message": "Container removed successfully.",
        "container_id": container_id,
    })