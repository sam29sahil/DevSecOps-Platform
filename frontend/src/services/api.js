const API_BASE_URL = "http://127.0.0.1:5000/api";

/* =========================================================
   BASE REQUEST
========================================================= */

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
      data.error ||
        data.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
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
    return await request(
      `/projects/${projectId}/scans`
    );
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

export async function updatePipeline(pipelineId, pipelineData) {
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

/* =========================================================
   HEALTH
========================================================= */

export async function getHealth() {
  return request("/health");
}