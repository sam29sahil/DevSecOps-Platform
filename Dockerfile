FROM python:3.12-slim

WORKDIR /app

# ============================================================
# SYSTEM DEPENDENCIES
# ============================================================

RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    lsb-release \
    git \
    docker.io \
    && rm -rf /var/lib/apt/lists/*


# ============================================================
# INSTALL AZURE CLI
# ============================================================

RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash


# ============================================================
# PYTHON DEPENDENCIES
# ============================================================

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# ============================================================
# INSTALL TRIVY
# ============================================================

RUN apt-get update && apt-get install -y \
    wget \
    && wget -qO- https://aquasecurity.github.io/trivy-repo/deb/public.key \
       | gpg --dearmor \
       > /usr/share/keyrings/trivy.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb generic main" \
       > /etc/apt/sources.list.d/trivy.list \
    && apt-get update \
    && apt-get install -y trivy \
    && rm -rf /var/lib/apt/lists/*
# ============================================================
# APPLICATION
# ============================================================

COPY . .


# ============================================================
# ENVIRONMENT
# ============================================================

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
# Persist Trivy's vulnerability database in the application's data mount so a
# container recreation does not force the next pipeline request to cold-start.
ENV TRIVY_CACHE_DIR=/app/data/trivy-cache
# Avoid the unreliable mirror for the Java index database used by full image
# scans. This is Trivy's supported upstream OCI repository.
ENV TRIVY_JAVA_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-java-db:1


# ============================================================
# PORT
# ============================================================

EXPOSE 5000


# ============================================================
# START APPLICATION
# ============================================================

# The container scan command allows up to 900 seconds for a cold Trivy DB
# download and image scan. Leave a small margin so Gunicorn does not kill the
# worker before the command can return its result.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--timeout", "960", "run:app"]
