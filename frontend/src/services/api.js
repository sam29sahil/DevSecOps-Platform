const API_BASE_URL = "http://127.0.0.1:5000/api";

/* =========================================================
   HELPER
========================================================= */

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

/* =========================================================
   PROJECTS
========================================================= */

export async function getProjects() {
  return request(`${API_BASE_URL}/projects`);
}

export async function getProject(projectId) {
  return request(`${API_BASE_URL}/projects/${projectId}`);
}

export async function createProject(project) {
  return request(`${API_BASE_URL}/projects`, {
    method: "POST",
    body: JSON.stringify(project),
  });
}

export async function updateProject(projectId, project) {
  return request(`${API_BASE_URL}/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(project),
  });
}

export async function deleteProject(projectId) {
  return request(`${API_BASE_URL}/projects/${projectId}`, {
    method: "DELETE",
  });
}

/* =========================================================
   SCANS
========================================================= */

export async function getScans(projectId = null) {
  let url = `${API_BASE_URL}/scans`;

  if (projectId !== null && projectId !== undefined) {
    url += `?project_id=${encodeURIComponent(projectId)}`;
  }

  return request(url);
}

export async function getScan(scanId) {
  return request(`${API_BASE_URL}/scans/${scanId}`);
}

export async function runSecurityScan(projectId, sourceDirectory) {
  return request(`${API_BASE_URL}/scans`, {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      source_directory: sourceDirectory,
    }),
  });
}

/* =========================================================
   VULNERABILITIES
========================================================= */

/*
  There is currently no /api/vulnerabilities endpoint
  in your Flask backend.

  Therefore we obtain vulnerabilities/findings from scans.
*/

export async function getVulnerabilities(projectId = null) {
  const data = await getScans(projectId);

  const scans = data?.scans || [];

  const allFindings = [];

  for (const scan of scans) {
    try {
      const scanData = await getScan(scan.id);

      const findings = scanData?.findings || [];

      findings.forEach((finding) => {
        allFindings.push({
          ...finding,
          scan_id: scan.id,
          project_id: scan.project_id,
          project_name: scan.project_name,
        });
      });
    } catch (error) {
      console.error(
        `Failed to load findings for scan ${scan.id}:`,
        error
      );
    }
  }

  return {
    success: true,
    count: allFindings.length,
    vulnerabilities: allFindings,
    findings: allFindings,
  };
}

/* =========================================================
   DASHBOARD
========================================================= */

export async function getDashboardData() {
  const [projectsData, scansData] = await Promise.all([
    getProjects(),
    getScans(),
  ]);

  const projects = projectsData?.projects || [];
  const scans = scansData?.scans || [];

  const completedScans = scans.filter(
    (scan) => scan.status === "completed"
  );

  const failedScans = scans.filter(
    (scan) => scan.status === "failed"
  );

  const totalFindings = completedScans.reduce(
    (total, scan) =>
      total + Number(scan.total_findings || 0),
    0
  );

  const scores = completedScans
    .map((scan) => Number(scan.security_score))
    .filter((score) => Number.isFinite(score));

  const averageSecurityScore =
    scores.length > 0
      ? Math.round(
          scores.reduce((sum, score) => sum + score, 0) /
            scores.length
        )
      : 0;

  return {
    success: true,

    projects,
    scans,

    statistics: {
      total_projects: projects.length,
      total_scans: scans.length,
      completed_scans: completedScans.length,
      failed_scans: failedScans.length,
      total_findings: totalFindings,
      average_security_score: averageSecurityScore,
    },

    /*
      Aliases make the data easier for Dashboard.jsx
      to consume without another API endpoint.
    */
    totalProjects: projects.length,
    totalScans: scans.length,
    completedScans: completedScans.length,
    failedScans: failedScans.length,
    totalFindings,
    averageSecurityScore,
  };
}