const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:5000/api";

/* =========================================================
   BASE REQUEST
========================================================= */

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const apiKey = (typeof localStorage !== "undefined" && localStorage.getItem("apiKey")) || import.meta.env.VITE_API_KEY;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-API-Key": apiKey } : {}),
        ...(options.headers || {}),
      },
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  } catch (error) {
    console.error(`API request failed: ${url}`, error);

    throw error;
  }
}

/* =========================================================
   DASHBOARD
========================================================= */

export async function getDashboard() {
  return request("/dashboard");
}

/* =========================================================
   PROJECTS
========================================================= */

export async function getProjects() {
  return request("/projects");
}

export async function getProject(projectId) {
  return request(`/projects/${projectId}`);
}

export async function createProject(projectData) {
  return request("/projects", {
    method: "POST",
    body: JSON.stringify(projectData),
  });
}

export async function updateProject(projectId, projectData) {
  return request(`/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(projectData),
  });
}

export async function deleteProject(projectId) {
  return request(`/projects/${projectId}`, {
    method: "DELETE",
  });
}

export async function deployProject(projectId) {
  return request(`/projects/${projectId}/deploy`, {
    method: "POST",
  });
}

/* =========================================================
   SCANS
========================================================= */

export async function getScans(projectId = null) {
  const endpoint = projectId
    ? `/scans?project_id=${encodeURIComponent(projectId)}`
    : "/scans";

  return request(endpoint);
}

export async function getScan(scanId) {
  return request(`/scans/${scanId}`);
}

export async function startScan(scanData) {
  return request("/scans", {
    method: "POST",
    body: JSON.stringify(scanData),
  });
}

/* =========================================================
   PROJECT SCANS
========================================================= */

export async function getProjectScans(projectId) {
  try {
    return await request(`/projects/${projectId}/scans`);
  } catch (error) {
    console.warn(
      "Project scan endpoint unavailable. Falling back to /scans.",
      error.message
    );

    const data = await getScans(projectId);

    return {
      success: true,
      scans: Array.isArray(data.scans)
        ? data.scans
        : [],
    };
  }
}

/* =========================================================
   VULNERABILITIES
========================================================= */

export async function getVulnerabilities(filters = {}) {
  const params = new URLSearchParams();

  if (filters.project_id) {
    params.append("project_id", filters.project_id);
  }

  if (filters.severity) {
    params.append("severity", filters.severity);
  }

  const query = params.toString();

  return request(
    `/vulnerabilities${query ? `?${query}` : ""}`
  );
}

/* =========================================================
   PIPELINES
========================================================= */

export async function getPipelines() {
  return request("/pipelines");
}

export async function getPipeline(pipelineId) {
  return request(`/pipelines/${pipelineId}`);
}

export async function createPipeline(pipelineData) {
  return request("/pipelines", {
    method: "POST",
    body: JSON.stringify(pipelineData),
  });
}

export async function updatePipeline(
  pipelineId,
  pipelineData
) {
  return request(`/pipelines/${pipelineId}`, {
    method: "PUT",
    body: JSON.stringify(pipelineData),
  });
}

export async function deletePipeline(pipelineId) {
  return request(`/pipelines/${pipelineId}`, {
    method: "DELETE",
  });
}

export async function runPipeline(pipelineId) {
  return request(
    `/pipelines/${pipelineId}/run`,
    {
      method: "POST",
    }
  );
}

export async function getPipelineRuns(pipelineId) {
  const response = await fetch(
    `${API_BASE_URL}/pipelines/${pipelineId}/runs`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Failed to load pipeline runs."
    );
  }

  return data;
}


export async function getPipelineRun(runId) {
  const response = await fetch(
    `${API_BASE_URL}/pipelines/runs/${runId}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Failed to load pipeline run."
    );
  }

  return data;
}
/* =========================================================
   REPORTS
========================================================= */

export async function getReport(scanId) {
  return request(`/reports/${scanId}`);
}
/* =========================================================
   CONTAINERS / DOCKER
========================================================= */

export async function getContainers() {
  return request("/containers");
}

export async function getContainer(containerId) {
  return request(`/containers/${containerId}`);
}

export async function startContainer(containerId) {
  return request(`/containers/${containerId}/start`, {
    method: "POST",
  });
}

export async function stopContainer(containerId) {
  return request(`/containers/${containerId}/stop`, {
    method: "POST",
  });
}

export async function restartContainer(containerId) {
  return request(`/containers/${containerId}/restart`, {
    method: "POST",
  });
}

export async function removeContainer(containerId) {
  return request(`/containers/${containerId}`, {
    method: "DELETE",
  });
}

export async function getContainerLogs(containerId) {
  return request(`/containers/${containerId}/logs`);
}

export async function getContainerStats(containerId) {
  return request(`/containers/${containerId}/stats`);
}

/* =========================================================
   AWS
========================================================= */

export async function getAwsStatus() {
  return request("/aws/status");
}

export async function getAwsEcr() {
  return request("/aws/ecr");
}

export async function getAwsImages() {
  return request("/aws/images");
}

export async function getDockerImages() {
  return request("/containers/images");
}

export async function getAwsOverview() {
  return request("/aws/overview");
}

export async function getAwsEcs() {
  return request("/aws/ecs");
}

export async function getAwsCloudWatch() {
  return request("/aws/cloudwatch");
}
/* =========================================================
   CLOUD
========================================================= */

/* =========================================================
   DEPLOYMENTS
========================================================= */

export async function getDeployments(projectId = null) {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return request(`/deployments${query}`);
}

export async function getDeploymentStats() {
  return request("/deployments/stats");
}

export async function getDeployment(identifier) {
  return request(`/deployments/${identifier}`);
}

export async function stopDeployment(identifier) {
  return request(`/deployments/${identifier}/stop`, {
    method: "POST",
  });
}

export async function deleteDeployment(identifier) {
  return request(`/deployments/${identifier}`, {
    method: "DELETE",
  });
}

export async function startDeployment(identifier) {
  return request(`/deployments/${identifier}/start`, {
    method: "POST",
  });
}

export async function restartDeployment(identifier) {
  return request(`/deployments/${identifier}/restart`, {
    method: "POST",
  });
}

export async function stopAllDeployments() {
  return request("/deployments/stop-all", {
    method: "POST",
  });
}

export async function checkDeploymentHealth(identifier) {
  return request(`/deployments/${identifier}/health`);
}

export async function syncDeployment(identifier) {
  return request(`/deployments/${identifier}/sync`, {
    method: "POST",
  });
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

export async function getNotifications(unreadOnly = false, limit = 50) {
  const params = new URLSearchParams();
  if (unreadOnly) params.append("unread_only", "true");
  if (limit) params.append("limit", limit);
  const query = params.toString();
  return request(`/notifications${query ? `?${query}` : ""}`);
}

export async function markNotificationRead(id) {
  return request(`/notifications/${id}/read`, {
    method: "PUT",
  });
}

export async function markAllNotificationsRead() {
  return request("/notifications/read-all", {
    method: "PUT",
  });
}

export async function clearAllNotifications() {
  return request("/notifications", {
    method: "DELETE",
  });
}

/* =========================================================
   HEALTH
========================================================= */

export async function getHealth() {
  return request("/health");
}

/* =========================================================
   API BASE URL
========================================================= */

/*
  Useful when debugging frontend/backend connection.
*/

export function getApiBaseUrl() {
  return API_BASE_URL;
}