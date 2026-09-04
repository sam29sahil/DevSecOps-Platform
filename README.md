# DevSecOps Platform

A self-hosted DevSecOps platform that runs a complete security-gated delivery pipeline — source checkout, dependency inspection, secret detection, SAST, a policy quality gate, Docker build, and Trivy container vulnerability scanning — from a single Flask API with a React dashboard.

The platform runs as a container on your own Docker host and drives the host Docker daemon to build and scan images. Every pipeline run is persisted to SQLite with per-stage status, timing, and structured results.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Docker Compose Setup](#docker-compose-setup)
- [Environment Variables](#environment-variables)
- [DevSecOps Pipeline Stages](#devsecops-pipeline-stages)
- [SAST Scanning](#sast-scanning)
- [Trivy Vulnerability Scanning](#trivy-vulnerability-scanning)
- [Health Checks](#health-checks)
- [Security and Secret Handling](#security-and-secret-handling)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

---

## Overview

The platform models three core concepts:

| Concept | Description |
| --- | --- |
| **Project** | A repository and branch to be scanned, plus the source directory used for local SAST scans. |
| **Scan** | A single SAST run against a project's source directory, producing severity-ranked findings and a security score. |
| **Pipeline** | An ordered set of nine stages bound to a project, with a configurable quality gate and opt-in Docker build, registry push, and deployment. |
| **Pipeline run** | An immutable record of one pipeline execution, storing each stage's status, duration, message, and structured details. |

A pipeline run is synchronous: `POST /api/pipelines/<id>/run` executes every stage in order and returns the completed run record. If a stage fails, the run stops there, the failing stage is recorded with its error, and the request returns HTTP 500 with the error message. A fully successful run returns HTTP 201.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  React + Vite dashboard (frontend/)                                │
│  Dashboard · Projects · Scans · Vulnerabilities · Pipelines ·      │
│  Containers · Reports                                             │
└───────────────────────────────┬────────────────────────────────────┘
                                │  REST / JSON  (VITE_API_BASE_URL)
┌───────────────────────────────▼────────────────────────────────────┐
│  Flask API  (gunicorn, port 5000)                                  │
│                                                                    │
│  /api/projects   /api/scans      /api/vulnerabilities              │
│  /api/pipelines  /api/reports    /api/containers                  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Pipeline engine (app/routes/pipelines.py)                   │  │
│  │  checkout → dependencies → secrets → SAST → quality gate     │  │
│  │  → docker build → Trivy scan → registry push → deployment    │  │
│  └───────┬───────────────┬────────────────────┬─────────────────┘  │
│          │               │                    │                    │
│  ┌───────▼──────┐  ┌─────▼───────┐   ┌────────▼─────────┐          │
│  │ CodeScanner  │  │ SQLite      │                              │
│  │ (SAST rules) │  │ data/       │                              │
│  └──────────────┘  │ devsecops.db│   └────────┬─────────┘          │
│                    └─────────────┘            │                    │
└──────────┬────────────────────────────────────┼────────────────────┘
           │ /var/run/docker.sock               │ Service principal
┌──────────▼──────────────┐        ┌────────────▼───────────────────┐
│  Host Docker daemon     │        │  Container Registry            │
│  docker build / tag     │        │  Registry push                 │
│  docker push            │───────▶│                               │
│  trivy image (in-image) │        │                               │
└─────────────────────────┘        └────────────────────────────────┘
```

Two deliberate design decisions are worth calling out:

- **The container drives the host Docker daemon.** `/var/run/docker.sock` is mounted into the platform container, so `docker build`, `docker tag`, and `docker push` execute against the host daemon rather than a nested one. The Docker CLI is installed inside the image; the daemon is not.
- **AWS access uses a service principal, not a CLI profile.** The host AWS credentials profile is deliberately *not* mounted. A Windows CLI profile is unreadable by a Linux container, and an interactive CLI user credential cannot be refreshed non-interactively under Entra security defaults.

---

## Features

- **Nine-stage security pipeline** with per-stage status, duration, message, and structured JSON details persisted per run.
- **Built-in SAST scanner** — dependency-free regex rule engine covering five vulnerability classes across fifteen source file types.
- **Repository secret detection** — five credential patterns scanned across twenty-one file extensions in the checked-out workspace.
- **Dependency manifest discovery** across Python, Node, Java, Go, and Rust ecosystems.
- **Configurable quality gate** — minimum security score, zero-critical enforcement, and an optional fail-on-high policy.
- **Trivy container image scanning** with a persisted vulnerability database cache.
- **Amazon ECR push** authenticated by service principal via `docker login --password-stdin`.
- **AWS ECR integration** via the boto3, returning the new revision name, provisioning state, and public FQDN.
- **Local container management** — list, inspect, start, stop, restart, remove containers, and read logs and stats.
- **AWS resource visibility** — connection health, resource-group overview, and resource listing.
- **React dashboard** covering projects, scan history, vulnerabilities, pipelines, containers, reports, and AWS Activity.

---

## Tech Stack

**Backend**

| Component | Version / Notes |
| --- | --- |
| Python | 3.12 (container base: `python:3.12-slim`) |
| Flask | 3.1.3 |
| flask-cors | 6.0.5 |
| gunicorn | 23.0.0 (1 worker, 960s timeout) |
| SQLite | via the Python standard library `sqlite3` |
| AWS-identity | 1.25.3 |
| AWS-mgmt-resource | 26.0.0 |
| AWS-mgmt-appcontainers | 5.0.0 (unpinned in `requirements.txt`) |
| python-dotenv | 1.2.3 |

> `requirements.txt` also pins Flask-Login, Flask-Migrate, Flask-SQLAlchemy, and SQLAlchemy. The persistence layer in `app/models.py` currently uses raw `sqlite3`, so these are installed but not yet used by the API.

**Frontend**

| Component | Version |
| --- | --- |
| React / React DOM | 19.2.x |
| Vite | 8.2.x |
| react-router-dom | 7.18.x |
| lucide-react | 1.34.x |
| ESLint | 10.x |

**Pipeline tooling (installed in the platform image)**

| Tool | Purpose |
| --- | --- |
| `git` | Repository checkout |
| `docker-cli` | Build, tag, push, and container management against the host daemon |
| `trivy` | Container image vulnerability scanning |
| AWS credentials | Installed in the image; the pipeline itself authenticates through the boto3 |

---

## Project Structure

```
DevSecOps-Platform/
├── app/
│   ├── __init__.py              # Flask app factory, CORS, blueprint registration, /api/health
│   ├── models.py                # SQLite schema + data access (projects, scans, findings,
│   │                            #   pipelines, pipeline_runs) with additive migrations
│   ├── routes/
│   │   ├── __init__.py          # Blueprint exports
│   │   ├── projects.py          # /api/projects        CRUD
│   │   ├── scans.py             # /api/scans           SAST runs + /api/vulnerabilities
│   │   ├── pipelines.py         # /api/pipelines       pipeline CRUD, execution, run history
│   │   ├── reports.py           # /api/reports         severity report from a stored scan
│   │   ├── containers.py        # /api/containers      local Docker container management
│   │   └── AWS.py             # /api/AWS           AWS connectivity and resources
│   ├── scanners/
│   │   └── code_scanner.py      # CodeScanner — the SAST rule engine
│   ├── static/
│   └── templates/
├── frontend/
│   ├── src/
│   │   ├── pages/               # Dashboard, Projects, ProjectDetails, ScanHistory,
│   │   │                        #   ScanDetails, Vulnerabilities, Pipelines, Containers,
│   │   │                        #   Reports, AWSActivity
│   │   ├── components/          # DashboardLayout, Header, Sidebar, StatCard
│   │   ├── layouts/
│   │   ├── services/api.js      # REST client (VITE_API_BASE_URL)
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.js
├── data/
│   ├── devsecops.db             # SQLite database (git-ignored)
│   └── trivy-cache/             # Persisted Trivy vulnerability DB (git-ignored)
├── Dockerfile                   # Platform image: Python + git + docker-cli + trivy + AWS credentials
├── docker-compose.yml           # Service definition, port, env_file, volumes
├── requirements.txt
├── run.py                       # WSGI entrypoint (`run:app`)
├── .env.example                 # Documented, value-free configuration template
├── .gitignore
└── .dockerignore
```

---

## Prerequisites

| Requirement | Notes |
| --- | --- |
| Docker Engine + Docker Compose v2 | Required for the container workflow, and for the build/scan/push stages in any mode. |
| Python 3.12+ | Only needed for running the backend directly on the host. |
| Node.js 20+ | Only needed to run or build the frontend. |
| Git | Required for the checkout stage. |
| Trivy | Bundled in the platform image. Required on the host only if you run the backend outside Docker and want container scanning. |
| An AWS account | Only needed for the registry push and deployment stages. |

**AWS prerequisites (only for push and deploy):**

- An Amazon ECR.
- An ECR repository to deploy to, which must **not** be the Container App hosting this platform.
- A service principal with permission to push to the registry (`AcrPush`) and to update the target Container App (`Microsoft.App/containerApps/write`).

---

## Local Setup

Run the backend directly on the host — useful for development.

```bash
git clone https://github.com/sam29sahil/DevSecOps-Platform.git
cd DevSecOps-Platform

python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env              # then fill in your own values
```

Start the API:

```bash
python run.py
```

The server listens on `0.0.0.0:5000` by default. `PORT` overrides the port, and `FLASK_DEBUG=true` enables Flask debug mode. The SQLite database and its schema are created automatically at `data/devsecops.db` on first start.

Start the frontend in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite serves the dashboard on `http://localhost:5173`, which is one of the origins allowed by the API's CORS policy.

> Running the backend on the host means the pipeline uses the host's `git`, `docker`, and `trivy` binaries. Stages whose tooling is missing are recorded as **skipped** rather than failing the run.

---

## Docker Compose Setup

This is the supported way to run the platform with the full pipeline available.

```bash
cp .env.example .env              # fill in your own values

docker compose build
docker compose up -d
```

Verify the API:

```bash
curl -i http://127.0.0.1:5000/api/health
# HTTP/1.1 200 OK
# {"service":"DevSecOps Platform API","status":"operational","success":true}
```

The Compose service is defined as:

| Setting | Value |
| --- | --- |
| Service / container name | `devsecops-platform` |
| Image | `devsecops-platform` (built from the repository `Dockerfile`) |
| Port | `5000:5000` |
| Restart policy | `unless-stopped` |
| Config | `env_file: .env` |
| Volume | `./data:/app/data` — SQLite database and Trivy DB cache |
| Volume | `/var/run/docker.sock:/var/run/docker.sock` — build, scan, and push on the host daemon |

Useful commands:

```bash
docker compose logs -f                      # follow application logs
docker compose up -d --force-recreate       # apply a rebuilt image
docker compose down                         # stop and remove the container
```

Because the application source is baked into the image with `COPY . .`, **backend code changes require `docker compose build` followed by `docker compose up -d --force-recreate`.**

---

## Environment Variables

Copy `.env.example` to `.env` and fill it in. `.env` and every `.env.*` file except `.env.example` are git-ignored and excluded from the Docker build context.

### Frontend

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | No | Base URL the dashboard calls. Defaults to `http://127.0.0.1:5000/api`. |

### Container registry

| Variable | Required for | Description |
| --- | --- | --- |
| `CONTAINER_REGISTRY` | Registry push | Registry login server, e.g. `<your-registry>.AWScr.io`. If unset, the push stage is skipped. |
| `CONTAINER_REGISTRY_REPOSITORY` | Registry push | Repository name within the registry. Defaults to `devsecops-pipeline`. |

### AWS service principal

| Variable | Required for | Description |
| --- | --- | --- |
| `AWS_TENANT_ID` | Push + deploy | Entra tenant ID of the service principal. |
| `AWS_CLIENT_ID` | Push + deploy | Service principal application (client) ID. Also used as the registry username. |
| `AWS_CLIENT_SECRET` | Push + deploy | Service principal secret. Passed to `docker login` over stdin, never as an argument. |
| `AWS_SUBSCRIPTION_ID` | Deploy | Subscription containing the deployment target. |

If the tenant, client, and secret variables are all present, the deployment stage uses `ClientSecretCredential`. Otherwise it falls back to `DefaultAWSCredential`, so the same code path works from a managed identity.

### ECR target

| Variable | Required for | Description |
| --- | --- | --- |
| `AWS_RESOURCE_GROUP` | Deploy | Resource group containing the target Container App. |
| `AWS_CONTAINER_APP_NAME` | Deploy | Name of the Container App to update. Must not be the app hosting this platform. |

### Backend runtime

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Port for `python run.py`. Defaults to `5000`. Not used under gunicorn, which binds `0.0.0.0:5000`. |
| `FLASK_DEBUG` | No | `true` enables Flask debug mode for `python run.py`. Leave unset in production. |

Never commit real values. `.env.example` documents every variable with empty values and is the only env file tracked by git.

---

## DevSecOps Pipeline Stages

Every pipeline runs the same nine stages in order. Stages 6–9 are gated by per-pipeline flags, and a gated-off stage is recorded as **skipped**.

| # | Stage ID | Name | Behaviour |
| --- | --- | --- | --- |
| 1 | `checkout` | Checkout Repository | Clones the configured repository and branch into a temporary workspace using `git`. |
| 2 | `dependencies` | Dependency Check | Discovers dependency manifests across the workspace and classifies them by ecosystem. Nothing is installed. |
| 3 | `secrets` | Secret Detection | Scans workspace source files for committed credentials. |
| 4 | `sast` | SAST Security Scan | Runs the built-in `CodeScanner`, persists findings as a scan record, and computes a security score. |
| 5 | `quality_gate` | Quality Gate | Applies the pipeline's security policy. A failure stops the run. |
| 6 | `docker_build` | Docker Build | `docker build -t devsecops-pipeline:<pipeline_id>-<run_id> <workspace>`. Requires `docker_enabled` and a `Dockerfile` in the workspace. |
| 7 | `container_scan` | Container Security Scan | Runs Trivy against the freshly built image and stores the full JSON report. |
| 8 | `registry_push` | Registry Push | Tags and pushes the image to `CONTAINER_REGISTRY`. Requires `registry_enabled`. |
| 9 | `deployment` | Deployment | Updates the target ECR repository to the pushed image. Requires `deployment_enabled`. |

**Pipeline configuration flags**

| Field | Default | Effect |
| --- | --- | --- |
| `quality_gate_score` | `70` | Minimum security score required to pass the gate. |
| `fail_on_high` | `true` | Fail the gate when any HIGH severity SAST finding exists. |
| `docker_enabled` | `true` | Enables the Docker Build stage. |
| `registry_enabled` | `false` | Enables the Registry Push stage. |
| `deployment_enabled` | `false` | Enables the Deployment stage. |

**Dependency manifests detected**

`requirements.txt`, `requirements-dev.txt`, `Pipfile`, `Pipfile.lock`, `poetry.lock`, `pyproject.toml`, `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `pom.xml`, `build.gradle`, `build.gradle.kts`, `go.mod`, `Cargo.toml`.

**Quality gate policy**

The gate fails when any of the following holds:

1. The SAST security score is below `quality_gate_score`.
2. One or more CRITICAL findings exist.
3. `fail_on_high` is enabled and one or more HIGH findings exist.

The security score starts at 100 and deducts per finding by severity — CRITICAL 25, HIGH 15, MEDIUM 7, LOW 3 — floored at 0. Every failure reason is recorded in the stage details.

**Stage ordering guarantees**

- The container scan runs only against an image the build stage actually produced.
- The deployment stage deploys only the **registry** image, never a local-only build tag, because AWS pulls the image itself and a local tag would fail at pull time with a far less obvious error.

---

## SAST Scanning

`app/scanners/code_scanner.py` implements a dependency-free regex rule engine. It requires no external service, no network access, and no language toolchain.

**Rules**

| ID | Title | Severity | Detects |
| --- | --- | --- | --- |
| `SEC001` | Hardcoded Password | HIGH | `password = "..."`, `passwd = "..."` |
| `SEC002` | Hardcoded API Key | HIGH | `api_key = "..."`, `secret_key = "..."` |
| `SEC003` | Debug Mode Enabled | MEDIUM | `debug = True`, `DEBUG = True` |
| `SEC004` | Potential Command Injection | HIGH | `os.system(`, `subprocess.Popen(..., shell=True)`, `subprocess.run(..., shell=True)` |
| `SEC005` | SQL Query Construction | HIGH | String-concatenated `SELECT` / `INSERT` / `UPDATE` / `DELETE` |

Each finding records the rule ID, title, severity, description, remediation recommendation, file path, line number, and the matching line as evidence.

**Scanned file types**

`.py` `.js` `.jsx` `.ts` `.tsx` `.java` `.go` `.php` `.rb` `.cs` `.cpp` `.c` `.h` `.html` `.css`

**Ignored directories**

`.git` `.venv` `venv` `node_modules` `__pycache__` `.idea` `.vscode` `dist` `build`

SAST can be run standalone against a project's configured `source_directory` via `POST /api/scans`, or as stage 4 of a pipeline against the freshly checked-out workspace. Either way the result is persisted as a scan with its findings, and is queryable through `/api/scans`, `/api/vulnerabilities`, and `/api/reports/<scan_id>`.

**Secret detection patterns (stage 3)**

| Pattern | Matches |
| --- | --- |
| AWS Access Key | `AKIA` followed by 16 uppercase alphanumerics |
| Private Key | `-----BEGIN [RSA\|EC\|OPENSSH] PRIVATE KEY-----` |
| Generic API Key | `api_key` / `secret_key` assigned a quoted 16+ character value |
| Generic Token | `access_token` / `auth_token` assigned a quoted 16+ character value |
| GitHub Token | `ghp_` / `gho_` / `ghu_` / `ghs_` / `ghr_` followed by 20+ characters |

Secret detection covers 21 extensions including `.py`, `.js`, `.ts`, `.json`, `.yaml`, `.yml`, `.env`, `.ini`, `.conf`, `.toml`, `.sh`, and `.xml`, skipping the same vendored and build directories.

---

## Trivy Vulnerability Scanning

Stage 7 scans the image produced by stage 6:

```bash
trivy image --scanners vuln --format json devsecops-pipeline:<pipeline_id>-<run_id>
```

The complete Trivy JSON report is stored in the run's `container_scan` stage details, so every vulnerability — package, installed version, fixed version, severity, and advisory ID — remains queryable after the run.

**Scan configuration**

| Setting | Value | Reason |
| --- | --- | --- |
| `TRIVY_CACHE_DIR` | `/app/data/trivy-cache` | Set in the Dockerfile. The vulnerability DB lives in the `./data` volume, so recreating the container does not force a cold re-download. |
| `TRIVY_SKIP_JAVA_DB_UPDATE` | `true` | Avoids cold-downloading the ~900 MB Java index for a Python service image. |
| `TRIVY_SKIP_DIRS` | `/usr/share/java` | The only JAR in the base tooling is gettext's `libintl`, not application code. |
| Timeout | 900 seconds | Bounds the stage. |

OS package and language library vulnerabilities are still scanned in full — only the Java index is skipped.

A non-zero Trivy exit code is treated as a **scanner failure**, not as a scan result, and fails the stage. Trivy is invoked without `--exit-code`, so discovered vulnerabilities do not by themselves fail the pipeline; the quality gate at stage 5 is what enforces policy, and it evaluates SAST findings.

The first scan after a fresh checkout of the vulnerability database downloads it and is noticeably slower than subsequent runs. Keep the `./data` volume to avoid repeating that cost.

---

## Amazon ECR Push

Stage 8 tags the local build and pushes it to the configured registry.

**Authentication.** The pipeline authenticates with its service principal:

```bash
docker login <registry> --username $AWS_CLIENT_ID --password-stdin
```

The ECR authorization token is written to the process's standard input and never appears in an argument vector. boto3 obtains that token through the standard AWS credential provider chain, including GitHub Actions OIDC.

**Tagging.** Only the tag portion of the local image is carried over, so the registry repository can be named independently of the local build tag:

```
local:     devsecops-pipeline:<pipeline_id>-<run_id>
registry:  <CONTAINER_REGISTRY>/<CONTAINER_REGISTRY_REPOSITORY>:<pipeline_id>-<run_id>
```

The stage is skipped when `registry_enabled` is false or `CONTAINER_REGISTRY` is unset, and fails when `AWS_CLIENT_ID` or `AWS_CLIENT_SECRET` is missing. The resulting fully-qualified image reference is recorded in the stage details and carried forward to the deployment stage.

---

## AWS ECR integration

Stage 9 updates the Container App named by `AWS_CONTAINER_APP_NAME` in `AWS_RESOURCE_GROUP` to the image that stage 8 pushed.

The stage uses `AWS-mgmt-appcontainers` directly rather than the AWS credentials: the `containerapp` command lives in a CLI extension that is not present in the image and cannot be installed non-interactively at request time.

**How the update is performed**

1. Fetch the live Container App and read its template.
2. Set the first container's image to the pushed registry reference.
3. Submit a **PATCH containing only the template**.

Sending only the template matters. Echoing the whole resource back would resubmit `managedEnvironmentId`, and ARM then re-validates the environment link and requires `Microsoft.App/managedEnvironments/join/action` on the managed environment — a permission a scoped deployment service principal typically does not hold, producing `LinkedAuthorizationFailed`. Because the update is a PATCH, anything omitted keeps its current value, so ingress, registry credentials, and scaling settings are preserved by omission.

On success the stage records the container app name, resource group, deployed image, new revision name, provisioning state, and the public application URL derived from the ingress FQDN.

Deployment is strictly opt-in. It is skipped unless `deployment_enabled` is true, and it fails fast with an explicit message if `AWS_SUBSCRIPTION_ID`, `AWS_RESOURCE_GROUP`, or `AWS_CONTAINER_APP_NAME` is unset.

---

## Health Checks

**Platform API**

```bash
curl -s http://127.0.0.1:5000/api/health
# {"service":"DevSecOps Platform API","status":"operational","success":true}

curl -s http://127.0.0.1:5000/
# {"message":"Backend is running","service":"DevSecOps Platform API","success":true,"version":"1.0.0"}
```

**AWS connectivity**

```bash
curl -s http://127.0.0.1:5000/api/AWS/health
```

Returns `200` with `"connected": true` when the configured credential can list resources in the resource group, or `503` with the error when it cannot.

**Deployed application**

The deployment stage returns the target Container App's public URL in its stage details. Verify the new revision is serving traffic:

```bash
RUN_ID=<run_id>
URL=$(curl -s http://127.0.0.1:5000/api/pipelines/runs/$RUN_ID \
  | python -c "import sys,json;print([s for s in json.load(sys.stdin)['run']['stages'] if s['id']=='deployment'][0]['details']['url'])")

curl -o /dev/null -w "%{http_code}\n" "$URL"
```

A newly created revision may take a few seconds to become ready; retry briefly before treating a non-200 as a failure.

---

## Security and Secret Handling

- **Secrets live only in `.env`.** `.env` and all `.env.*` files except `.env.example` are git-ignored and excluded from the Docker build context, so credentials never enter the image or the repository.
- **`.env.example` is value-free.** It documents every variable with empty values and is the only env file tracked by git.
- **Registry credentials are passed over stdin.** `docker login --password-stdin` keeps the service principal secret out of argument vectors, which are readable by other processes on the host and would otherwise be persisted into stage details.
- **Command output is truncated.** Captured stderr is limited to the last 12,000 characters per command to bound what a failing stage writes into the database.
- **The AWS credentials profile is never mounted.** AWS authentication uses a service principal, or the ambient credential chain when running under a managed identity.
- **The platform never deploys to itself.** The deployment target is a separate, explicitly configured Container App.
- **Least privilege.** The deployment service principal needs only registry push rights and `Microsoft.App/containerApps/write` on the target app. The template-only PATCH is what keeps the broader `managedEnvironments/join` permission unnecessary.

> **Docker socket exposure.** Mounting `/var/run/docker.sock` grants the container full control of the host Docker daemon, which is effectively root-equivalent on the host. This is required for the build, scan, and push stages. Run the platform only on a host you control, and do not expose port 5000 to untrusted networks — the API has no authentication layer.

---

## API Reference

All endpoints return JSON with a `success` boolean.

**Health**

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Service banner and version. |
| `GET` | `/api/health` | Liveness check. |

**Projects**

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/projects` | List projects. |
| `GET` | `/api/projects/<id>` | Project details. |
| `POST` | `/api/projects` | Create a project. |
| `PUT` | `/api/projects/<id>` | Update a project. |
| `DELETE` | `/api/projects/<id>` | Delete a project. |

**Scans and findings**

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/scans` | List scans. |
| `GET` | `/api/scans/<id>` | Scan details with findings. |
| `POST` | `/api/scans` | Run a SAST scan for a project. |
| `GET` | `/api/vulnerabilities` | All findings; filter by `project_id` and `severity`. |
| `GET` | `/api/reports` | Reports index. |
| `GET` | `/api/reports/<scan_id>` | Severity-summarised report for a scan. |

**Pipelines**

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/pipelines` | List pipelines. |
| `GET` | `/api/pipelines/<id>` | Pipeline details, including current stage states. |
| `POST` | `/api/pipelines` | Create a pipeline. |
| `PUT` | `/api/pipelines/<id>` | Update pipeline configuration. |
| `DELETE` | `/api/pipelines/<id>` | Delete a pipeline. |
| `POST` | `/api/pipelines/<id>/run` | Execute the pipeline synchronously. `201` on success, `500` on stage failure. |
| `GET` | `/api/pipelines/<id>/runs` | Run history for a pipeline. |
| `GET` | `/api/pipelines/runs/<run_id>` | Full run record with per-stage details. |

**Containers**

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/containers` | List all local containers. |
| `GET` | `/api/containers/<id>` | Container details. |
| `POST` | `/api/containers/<id>/start` | Start a container. |
| `POST` | `/api/containers/<id>/stop` | Stop a container. |
| `POST` | `/api/containers/<id>/restart` | Restart a container. |
| `DELETE` | `/api/containers/<id>` | Remove a container. |
| `GET` | `/api/containers/<id>/logs` | Container logs. |
| `GET` | `/api/containers/<id>/stats` | Container resource stats. |

**AWS**

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/AWS/health` | AWS connectivity check. |
| `GET` | `/api/AWS/overview` | Resource-group overview. |
| `GET` | `/api/AWS/resources` | Resources in the configured group. |

---

## Usage Examples

### 1. Create a project

```bash
curl -X POST http://127.0.0.1:5000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Project",
    "repository_url": "https://github.com/<owner>/<repo>.git",
    "branch": "main",
    "source_directory": "."
  }'
```

### 2. Run a standalone SAST scan

```bash
curl -X POST http://127.0.0.1:5000/api/scans \
  -H "Content-Type: application/json" \
  -d '{"project_id": 1}'
```

### 3. Create a full pipeline

```bash
curl -X POST http://127.0.0.1:5000/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Project",
    "project_id": 1,
    "branch": "main",
    "quality_gate_score": 70,
    "fail_on_high": true,
    "docker_enabled": true,
    "registry_enabled": true,
    "deployment_enabled": true
  }'
```

### 4. Toggle deployment on an existing pipeline

```bash
curl -X PUT http://127.0.0.1:5000/api/pipelines/1 \
  -H "Content-Type: application/json" \
  -d '{"deployment_enabled": true}'
```

### 5. Run the pipeline end to end

```bash
curl -X POST http://127.0.0.1:5000/api/pipelines/1/run \
  -H "Content-Type: application/json" \
  -d '{}'
```

A successful run returns `201` and a run record whose stages read:

```
checkout         success   Repository checked out successfully.
dependencies     success   Dependency manifests inspected.
secrets          success   No potential secrets detected.
sast             success   SAST scan completed successfully.
quality_gate     success   Quality gate passed.
docker_build     success   Docker image built successfully.
container_scan   success   Container security scan completed.
registry_push    success   Container image pushed to registry.
deployment       success   Deployment completed successfully.
```

### 6. Inspect a run's stage results

```bash
curl -s http://127.0.0.1:5000/api/pipelines/runs/1 \
  | python -c "
import sys, json
run = json.load(sys.stdin)['run']
print(run['status'])
for s in run['stages']:
    print(f\"{s['id']:<16} {s['status']:<9} {s['message']}\")
"
```

### 7. Summarise Trivy findings by severity

```bash
curl -s http://127.0.0.1:5000/api/pipelines/runs/1 \
  | python -c "
import sys, json, collections
run = json.load(sys.stdin)['run']
scan = [s for s in run['stages'] if s['id'] == 'container_scan'][0]['details']['result']
counts = collections.Counter(
    v['Severity']
    for r in (scan.get('Results') or [])
    for v in (r.get('Vulnerabilities') or [])
)
print(dict(counts))
"
```

### 8. Filter findings by severity

```bash
curl -s "http://127.0.0.1:5000/api/vulnerabilities?severity=HIGH&project_id=1"
```

---

## Troubleshooting

**`Docker CLI is not available inside the pipeline runtime` — Docker Build skipped**

The image lacks the Docker client. On Debian 13 (trixie), which is the current `python:3.12-slim` base, the `docker.io` package ships only the daemon; the client moved to a separate `docker-cli` package that is a *Recommends*, so `--no-install-recommends` drops it. The repository `Dockerfile` installs `docker-cli` explicitly. If you hit this, rebuild and confirm:

```bash
docker compose build
docker compose up -d --force-recreate
docker exec devsecops-platform docker --version
```

**`registry_push` fails with a login error**

Confirm `CONTAINER_REGISTRY` is the full login server (`<name>.AWScr.io`, no scheme or trailing slash), that `AWS_CLIENT_ID` and `AWS_CLIENT_SECRET` are set in `.env`, and that the service principal holds `AcrPush` on the registry. Remember that `.env` changes require `docker compose up -d` to take effect.

**`LinkedAuthorizationFailed` on deployment**

ARM reports that the caller may write the Container App but lacks `Microsoft.App/managedEnvironments/join/action` on the managed environment. This occurs when the update payload resubmits `managedEnvironmentId`. The deployment stage sends a template-only PATCH specifically to avoid it. If you see this after modifying the deployment code, check that the PATCH payload still contains only the template.

**`No registry image is available for deployment`**

The deployment stage refuses to deploy a local-only build tag, because AWS pulls the image itself. Enable `registry_enabled` and make sure the push stage succeeds first.

**Deployment stage reports a missing configuration value**

The stage skips with an explicit message naming the missing variable when `AWS_SUBSCRIPTION_ID`, `AWS_RESOURCE_GROUP`, or `AWS_CONTAINER_APP_NAME` is unset. Set it in `.env` and recreate the container.

**Container scan is very slow on the first run**

Trivy is downloading its vulnerability database. It is cached in `/app/data/trivy-cache`, which is backed by the `./data` volume — keep that volume and subsequent scans will be fast. Removing `./data` also deletes the SQLite database.

**`/api/AWS/*` returns 503**

`DefaultAWSCredential` could not authenticate, or the credential cannot list resources in the configured group. Set `AWS_SUBSCRIPTION_ID`, `AWS_TENANT_ID`, `AWS_CLIENT_ID`, and `AWS_CLIENT_SECRET` in `.env` and confirm the service principal has read access to the resource group. Note that `app/routes/AWS.py` falls back to built-in defaults for the subscription, tenant, and resource group when those variables are unset — always set them explicitly for your own environment.

**Backend code changes have no effect**

The application source is copied into the image. Rebuild and recreate:

```bash
docker compose build && docker compose up -d --force-recreate
```

**Frontend cannot reach the API / CORS errors**

The API allows `http://localhost:5173` and the configured production frontend origin. If you serve the dashboard from a different origin, add it to the CORS configuration in `app/__init__.py`, and set `VITE_API_BASE_URL` to the API's base URL including the `/api` suffix.

**Port 5000 already in use**

Change the host side of the mapping in `docker-compose.yml` (for example `5001:5000`), or stop the process holding the port.
