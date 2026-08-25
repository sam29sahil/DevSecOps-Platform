const API_BASE_URL = "http://127.0.0.1:5000/api";

export async function getProjects() {
  const response = await fetch(`${API_BASE_URL}/projects`);

  if (!response.ok) {
    throw new Error("Failed to fetch projects");
  }

  return response.json();
}

export async function getProject(projectId) {
  const response = await fetch(
    `${API_BASE_URL}/projects/${projectId}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch project");
  }

  return response.json();
}

export async function createProject(project) {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(project),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create project");
  }

  return response.json();
}

export async function deleteProject(projectId) {
  const response = await fetch(
    `${API_BASE_URL}/projects/${projectId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to delete project");
  }

  return response.json();
}


/* =========================================================
   SECURITY SCANS
========================================================= */

export async function getScans(projectId = null) {
  const url = projectId
    ? `${API_BASE_URL}/scans?project_id=${projectId}`
    : `${API_BASE_URL}/scans`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch security scans");
  }

  return response.json();
}

export async function getScan(scanId) {
  const response = await fetch(
    `${API_BASE_URL}/scans/${scanId}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    throw new Error(
      error.error || "Failed to fetch security scan"
    );
  }

  return response.json();
}

export async function runSecurityScan(projectId) {
  const response = await fetch(`${API_BASE_URL}/scans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      project_id: projectId,
    }),
  });

  if (!response.ok) {
    let errorMessage = "Failed to start security scan";

    try {
      const error = await response.json();
      errorMessage = error.error || error.message || errorMessage;
    } catch {
      // Keep default error message
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

export async function getVulnerabilities() {
  const response = await fetch(
    `${API_BASE_URL}/vulnerabilities`
  );

  if (!response.ok) {
    let errorMessage = "Failed to fetch vulnerabilities";

    try {
      const error = await response.json();
      errorMessage =
        error.error ||
        error.message ||
        errorMessage;
    } catch {
      // Keep default error message
    }

    throw new Error(errorMessage);
  }

  return response.json();
}