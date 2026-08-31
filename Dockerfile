FROM python:3.12-slim

WORKDIR /app

# ============================================================
# SYSTEM DEPENDENCIES
# ============================================================

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    docker.io \
    docker-cli \
    git \
    gnupg \
    lsb-release \
    wget \
    && curl -sL https://aka.ms/InstallAzureCLIDeb | bash \
    && rm -rf /var/lib/apt/lists/*

# ============================================================
# PYTHON DEPENDENCIES
# ============================================================

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# ============================================================
# INSTALL TRIVY
# ============================================================

RUN wget -qO- https://aquasecurity.github.io/trivy-repo/deb/public.key \
    | gpg --dearmor > /usr/share/keyrings/trivy.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb generic main" \
    > /etc/apt/sources.list.d/trivy.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends trivy \
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

# ============================================================
# PORT
# ============================================================

EXPOSE 5000

# ============================================================
# START APPLICATION
# ============================================================

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--timeout", "960", "run:app"]
