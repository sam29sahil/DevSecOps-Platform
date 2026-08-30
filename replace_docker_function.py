import pathlib

path = pathlib.Path("app/routes/pipelines.py")
text = path.read_text(encoding="utf-8")

start = text.index("def build_docker_image(")
end = text.index("\n\n# ============================================================\n# CONTAINER SCAN", start)

new_function = '''def build_docker_image(
    workspace,
    pipeline_id,
    run_id,
):
    workspace_path = Path(workspace)

    # ------------------------------------------------------------
    # Detect Docker build configuration
    # ------------------------------------------------------------

    dockerfile = workspace_path / "Dockerfile"

    compose_file = None

    for candidate in (
        "docker-compose.yml",
        "docker-compose.yaml",
        "compose.yml",
        "compose.yaml",
    ):
        candidate_path = workspace_path / candidate
        if candidate_path.exists():
            compose_file = candidate_path
            break

    if not dockerfile.exists() and compose_file is None:
        return {
            "status": "skipped",
            "message": (
                "No Dockerfile or Docker Compose file found."
            ),
        }

    # ------------------------------------------------------------
    # Check Docker CLI
    # ------------------------------------------------------------

    if not is_docker_available():
        return {
            "status": "skipped",
            "message": (
                "Docker CLI is not available "
                "inside the pipeline runtime."
            ),
        }

    image_tag = (
        f"devsecops-pipeline:"
        f"{pipeline_id}-{run_id}"
    )

    # ------------------------------------------------------------
    # Standard Dockerfile build
    # ------------------------------------------------------------

    if dockerfile.exists():

        result = run_command(
            [
                "docker",
                "build",
                "-t",
                image_tag,
                workspace,
            ],
            timeout=900,
        )

        if result["returncode"] != 0:
            raise RuntimeError(
                result["stderr"]
                or result["stdout"]
                or "Docker build failed."
            )

        return {
            "status": "success",
            "image": image_tag,
            "build_type": "dockerfile",
            "stdout": result["stdout"],
        }

    # ------------------------------------------------------------
    # Docker Compose build
    # ------------------------------------------------------------

    result = run_command(
        [
            "docker",
            "compose",
            "-f",
            str(compose_file),
            "build",
        ],
        timeout=900,
    )

    if result["returncode"] != 0:
        raise RuntimeError(
            result["stderr"]
            or result["stdout"]
            or "Docker Compose build failed."
        )

    # ------------------------------------------------------------
    # Find the image produced by Compose
    # ------------------------------------------------------------

    images_result = run_command(
        [
            "docker",
            "compose",
            "-f",
            str(compose_file),
            "images",
            "-q",
        ],
        timeout=120,
    )

    if images_result["returncode"] != 0:
        raise RuntimeError(
            images_result["stderr"]
            or images_result["stdout"]
            or "Unable to determine Compose-built image."
        )

    image_ids = [
        line.strip()
        for line in images_result["stdout"].splitlines()
        if line.strip()
    ]

    if not image_ids:
        raise RuntimeError(
            "Docker Compose build completed, "
            "but no image was produced."
        )

    source_image = image_ids[0]

    # ------------------------------------------------------------
    # Tag Compose image using the pipeline image name
    # ------------------------------------------------------------

    tag_result = run_command(
        [
            "docker",
            "tag",
            source_image,
            image_tag,
        ],
        timeout=120,
    )

    if tag_result["returncode"] != 0:
        raise RuntimeError(
            tag_result["stderr"]
            or tag_result["stdout"]
            or "Unable to tag Compose-built image."
        )

    return {
        "status": "success",
        "image": image_tag,
        "build_type": "docker-compose",
        "compose_file": compose_file.name,
        "source_image": source_image,
        "stdout": result["stdout"],
    }
'''

path.write_text(
    text[:start] + new_function + text[end:],
    encoding="utf-8",
)

print("build_docker_image() replaced successfully.")
