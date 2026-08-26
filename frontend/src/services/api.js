const API_BASE_URL = "http://127.0.0.1:5000/api";

/* =========================================================
   BASE REQUEST
========================================================= */

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
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

export async function deleteProject(projectId) {
  return request(`/projects/${projectId}`, {
    method: "DELETE",
  });
}

/* =========================================================
   SCANS
========================================================= */

export async function getScans() {
  return request("/scans");
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

    const data = await getScans();

    const allScans = Array.isArray(data.scans)
      ? data.scans
      : [];

    const projectScans = allScans.filter(
      (scan) =>
        Number(scan.project_id) === Number(projectId)
    );

    return {
      success: true,
      scans: projectScans,
    };
  }
}

/* =========================================================
   HEALTH
========================================================= */

export async function getHealth() {
  return request("/health");
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

/* =========================================================
   VULNERABILITIES
========================================================= */

export async function getVulnerabilities() {
  return request("/vulnerabilities");
}