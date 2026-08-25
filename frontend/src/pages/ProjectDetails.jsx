import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  getProject,
  getScans,
  runSecurityScan,
} from "../services/api";

function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [scans, setScans] = useState([]);

  const [loading, setLoading] = useState(true);
  const [scansLoading, setScansLoading] = useState(true);

  const [error, setError] = useState("");
  const [scanError, setScanError] = useState("");

  const [showScanForm, setShowScanForm] = useState(false);
  const [sourceDirectory, setSourceDirectory] = useState("");

  const [scanning, setScanning] = useState(false);

  async function loadProject() {
    try {
      setLoading(true);
      setError("");

      const data = await getProject(projectId);

      if (!data.success || !data.project) {
        throw new Error("Project not found.");
      }

      setProject(data.project);
    } catch (err) {
      setError(err.message || "Failed to load project.");
    } finally {
      setLoading(false);
    }
  }

  async function loadScans() {
    try {
      setScansLoading(true);
      setScanError("");

      const data = await getScans(projectId);

      setScans(data.scans || []);
    } catch (err) {
      setScanError(err.message || "Failed to load scans.");
    } finally {
      setScansLoading(false);
    }
  }

  useEffect(() => {
    loadProject();
    loadScans();
  }, [projectId]);

  async function handleRunScan(event) {
    event.preventDefault();

    if (!sourceDirectory.trim()) {
      setScanError("Source directory is required.");
      return;
    }

    try {
      setScanning(true);
      setScanError("");

      await runSecurityScan(
        Number(projectId),
        sourceDirectory.trim()
      );

      setSourceDirectory("");
      setShowScanForm(false);

      await loadScans();
    } catch (err) {
      setScanError(err.message || "Security scan failed.");
    } finally {
      setScanning(false);
    }
  }

  function getScoreClass(score) {
    if (score >= 90) return "score-good";
    if (score >= 70) return "score-medium";
    return "score-danger";
  }

  function getStatusClass(status) {
    if (status === "completed") {
      return "status-completed";
    }

    if (status === "failed") {
      return "status-failed";
    }

    return "status-running";
  }

  if (loading) {
    return (
      <div className="project-details-page">
        <div className="loading-state">
          Loading project...
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="project-details-page">
        <div className="error-message">
          {error || "Project not found."}
        </div>

        <Link to="/projects" className="secondary-button">
          ← Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="project-details-page">

      {/* HEADER */}

      <div className="page-header">
        <div>
          <Link
            to="/projects"
            className="back-link"
          >
            ← Back to Projects
          </Link>

          <h1>{project.name}</h1>

          <p>
            {project.description ||
              "No project description provided."}
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowScanForm(!showScanForm)}
        >
          + New Security Scan
        </button>
      </div>

      {/* PROJECT INFORMATION */}

      <div className="project-overview-grid">

        <div className="overview-card">
          <span className="overview-label">
            Status
          </span>

          <strong>
            <span className="status-dot" />
            {project.status}
          </strong>
        </div>

        <div className="overview-card">
          <span className="overview-label">
            Branch
          </span>

          <strong>
            {project.branch || "main"}
          </strong>
        </div>

        <div className="overview-card">
          <span className="overview-label">
            Repository
          </span>

          <strong className="repository-text">
            {project.repository_url ||
              "Not configured"}
          </strong>
        </div>

        <div className="overview-card">
          <span className="overview-label">
            Total Scans
          </span>

          <strong>
            {scans.length}
          </strong>
        </div>

      </div>

      {/* SCAN FORM */}

      {showScanForm && (
        <form
          className="scan-form"
          onSubmit={handleRunScan}
        >
          <div className="scan-form-header">
            <div>
              <h2>Run Security Scan</h2>

              <p>
                Scan a local source directory for
                security issues.
              </p>
            </div>
          </div>

          <div className="form-group">
            <label>
              Source Directory
            </label>

            <input
              type="text"
              value={sourceDirectory}
              onChange={(event) =>
                setSourceDirectory(event.target.value)
              }
              placeholder="D:\Projects\MyApplication"
            />
          </div>

          <div className="form-actions">

            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowScanForm(false)}
              disabled={scanning}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={scanning}
            >
              {scanning
                ? "Scanning..."
                : "Run Security Scan"}
            </button>

          </div>
        </form>
      )}

      {/* SCAN ERROR */}

      {scanError && (
        <div className="error-message">
          {scanError}
        </div>
      )}

      {/* SCANS */}

      <div className="section-header">
        <div>
          <h2>Security Scans</h2>

          <p>
            Security assessments performed against
            this project.
          </p>
        </div>
      </div>

      {scansLoading ? (
        <div className="loading-state">
          Loading scans...
        </div>
      ) : scans.length === 0 ? (
        <div className="empty-projects">

          <div className="empty-icon">
            🛡
          </div>

          <h2>
            No scans yet
          </h2>

          <p>
            Run your first security scan to
            analyze this project.
          </p>

          <button
            className="primary-button"
            onClick={() => setShowScanForm(true)}
          >
            + Run Security Scan
          </button>

        </div>
      ) : (
        <div className="scans-list">

          {scans.map((scan) => (
            <div
              className="scan-card"
              key={scan.id}
            >

              <div className="scan-card-main">

                <div className="scan-icon">
                  🛡
                </div>

                <div className="scan-info">

                  <div className="scan-title-row">

                    <h3>
                      Security Scan #{scan.id}
                    </h3>

                    <span
                      className={`scan-status ${getStatusClass(
                        scan.status
                      )}`}
                    >
                      {scan.status}
                    </span>

                  </div>

                  <p>
                    {scan.files_scanned || 0} files scanned
                    {" • "}
                    {scan.total_findings || 0} findings
                  </p>

                  <small>
                    {scan.completed_at
                      ? `Completed: ${new Date(
                          scan.completed_at
                        ).toLocaleString()}`
                      : scan.created_at
                      ? `Started: ${new Date(
                          scan.created_at
                        ).toLocaleString()}`
                      : ""}
                  </small>

                </div>

              </div>

              <div className="scan-score">

                <span>
                  Security Score
                </span>

                <strong
                  className={getScoreClass(
                    scan.security_score ?? 0
                  )}
                >
                  {scan.security_score ?? 0}%
                </strong>

              </div>

              <div className="scan-findings">

                <span>
                  Findings
                </span>

                <strong>
                  {scan.total_findings || 0}
                </strong>

              </div>

              <div className="scan-actions">

                <button
                  className="secondary-button"
                  onClick={() =>
                    navigate(`/scans/${scan.id}`)
                  }
                >
                  View Scan
                </button>

              </div>

            </div>
          ))}

        </div>
      )}

    </div>
  );
}

export default ProjectDetails;