const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:5000/api";

/* =========================================================
   BASE REQUEST
========================================================= */

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
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
   AZURE
========================================================= */

export async function getAzureHealth() {
  return request("/azure/health");
}

export async function getAzureOverview() {
  return request("/azure/overview");
}

export async function getAzureResources() {
  return request("/azure/resources");
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