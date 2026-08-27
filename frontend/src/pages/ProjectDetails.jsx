import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import DashboardLayout from "../components/DashboardLayout";

import {
  getProject,
  getProjectScans,
  getVulnerabilities,
  startScan,
  deleteProject,
} from "../services/api";
import "./ProjectDetails.css";


function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  /* =========================================================
     STATE
  ========================================================= */

  const [project, setProject] = useState(null);
  const [scans, setScans] = useState([]);
  const [vulnerabilities, setVulnerabilities] = useState([]);

  const [loading, setLoading] = useState(true);
  const [scanLoading, setScanLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [scanError, setScanError] = useState("");

  const [showScanForm, setShowScanForm] =
    useState(false);

  const [sourceDirectory, setSourceDirectory] =
    useState("");


  /* =========================================================
     LOAD PROJECT
  ========================================================= */

  async function loadProject() {
    try {
      setLoading(true);
      setError("");

      const response =
        await getProject(projectId);

      if (!response.success) {
        throw new Error(
          response.error ||
            "Failed to load project."
        );
      }

      setProject(response.project);

      /*
       * If the project already has a source_directory,
       * use it as the default scan directory.
       */
      if (
        response.project?.source_directory &&
        !sourceDirectory
      ) {
        setSourceDirectory(
          response.project.source_directory
        );
      }

    } catch (err) {
      console.error(
        "Project loading error:",
        err
      );

      setError(
        err.message ||
          "Failed to load project."
      );
    } finally {
      setLoading(false);
    }
  }


  /* =========================================================
     LOAD PROJECT SCANS
  ========================================================= */

  async function loadScans() {
    try {
      const response =
        await getProjectScans(projectId);

      if (!response.success) {
        throw new Error(
          response.error ||
            "Failed to load scans."
        );
      }

      setScans(
        Array.isArray(response.scans)
          ? response.scans
          : []
      );

    } catch (err) {
      console.error(
        "Scan loading error:",
        err
      );

      setScanError(
        err.message ||
          "Failed to load scans."
      );

      setScans([]);
    }
  }


  /* =========================================================
     LOAD VULNERABILITIES
  ========================================================= */

  async function loadVulnerabilities() {
    try {
      const response =
        await getVulnerabilities(
          Number(projectId)
        );

      if (!response.success) {
        throw new Error(
          response.error ||
            "Failed to load vulnerabilities."
        );
      }

      setVulnerabilities(
        Array.isArray(
          response.vulnerabilities
        )
          ? response.vulnerabilities
          : []
      );

    } catch (err) {
      console.error(
        "Vulnerability loading error:",
        err
      );

      /*
       * Do not break the project page if the
       * vulnerability endpoint temporarily fails.
       */
      setVulnerabilities([]);
    }
  }


  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    loadProject();
    loadScans();
    loadVulnerabilities();
  }, [projectId]);


  /* =========================================================
     REFRESH
  ========================================================= */

  async function handleRefresh() {
    await Promise.all([
      loadProject(),
      loadScans(),
      loadVulnerabilities(),
    ]);
  }


  /* =========================================================
     RUN SECURITY SCAN
  ========================================================= */

  async function handleRunScan(event) {
    event.preventDefault();

    if (!sourceDirectory.trim()) {
      setScanError(
        "Source directory is required."
      );
      return;
    }

    try {
      setScanLoading(true);
      setScanError("");

      const response = await startScan({
        project_id: Number(projectId),
        source_directory:
          sourceDirectory.trim(),
      });

      if (!response.success) {
        throw new Error(
          response.error ||
            "Security scan failed."
        );
      }

      setSourceDirectory("");
      setShowScanForm(false);

      /*
       * Reload both scans and vulnerability
       * statistics after a successful scan.
       */
      await Promise.all([
        loadScans(),
        loadVulnerabilities(),
      ]);

    } catch (err) {
      console.error(
        "Scan error:",
        err
      );

      setScanError(
        err.message ||
          "Failed to run security scan."
      );

    } finally {
      setScanLoading(false);
    }
  }


  /* =========================================================
     DELETE PROJECT
  ========================================================= */

  async function handleDeleteProject() {
    if (!project) {
      return;
    }

    const confirmed = window.confirm(
      `Delete project "${project.name}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError("");

      const response =
        await deleteProject(project.id);

      if (!response.success) {
        throw new Error(
          response.error ||
            "Failed to delete project."
        );
      }

      navigate("/projects");

    } catch (err) {
      console.error(
        "Delete project error:",
        err
      );

      setError(
        err.message ||
          "Failed to delete project."
      );

    } finally {
      setDeleting(false);
    }
  }


  /* =========================================================
     SORT SCANS
  ========================================================= */

  const recentScans = useMemo(() => {
    return [...scans].sort((a, b) => {
      const first = new Date(
        b.created_at ||
          b.started_at ||
          0
      ).getTime();

      const second = new Date(
        a.created_at ||
          a.started_at ||
          0
      ).getTime();

      return first - second;
    });
  }, [scans]);


  /* =========================================================
     SCAN STATISTICS
  ========================================================= */

  const statistics = useMemo(() => {
    let totalFindings = 0;

    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    /*
     * Total findings come from the scans.
     */
    scans.forEach((scan) => {
      totalFindings += Number(
        scan.total_findings || 0
      );
    });


    /*
     * Severity counts come from the actual
     * vulnerability/finding records.
     */
    vulnerabilities.forEach((finding) => {
      const severity = String(
        finding.severity || ""
      ).toUpperCase();

      if (severity === "CRITICAL") {
        critical += 1;
      } else if (severity === "HIGH") {
        high += 1;
      } else if (severity === "MEDIUM") {
        medium += 1;
      } else if (severity === "LOW") {
        low += 1;
      }
    });


    /*
     * Get the latest security score from
     * the newest scan.
     */
    let latestScore = null;

    if (recentScans.length > 0) {
      const newestScan = recentScans[0];

      if (
        newestScan.security_score !==
          null &&
        newestScan.security_score !==
          undefined
      ) {
        const score = Number(
          newestScan.security_score
        );

        if (Number.isFinite(score)) {
          latestScore = score;
        }
      }
    }


    return {
      totalScans: scans.length,
      totalFindings,
      critical,
      high,
      medium,
      low,
      latestScore,
    };

  }, [
    scans,
    vulnerabilities,
    recentScans,
  ]);


  /* =========================================================
     HELPERS
  ========================================================= */

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }


  function getStatusClass(status) {
    return String(
      status || "unknown"
    ).toLowerCase();
  }


  function getScoreClass(score) {
    if (
      score === null ||
      score === undefined
    ) {
      return "score-neutral";
    }

    const value = Number(score);

    if (value >= 80) {
      return "score-good";
    }

    if (value >= 60) {
      return "score-medium";
    }

    return "score-danger";
  }


  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <DashboardLayout>
        <div className="project-details-page">

          <div className="loading-state">

            <div className="loading-spinner"></div>

            <span>
              Loading project...
            </span>

          </div>

        </div>
      </DashboardLayout>
    );
  }


  /* =========================================================
     ERROR / NOT FOUND
  ========================================================= */

  if (!project) {
    return (
      <DashboardLayout>
        <div className="project-details-page">

          <div className="error-state">

            <div className="error-icon">
              !
            </div>

            <h2>
              Project unavailable
            </h2>

            <p>
              {error ||
                "The requested project could not be found."}
            </p>

            <Link
              to="/projects"
              className="primary-button"
            >
              Back to Projects
            </Link>

          </div>

        </div>
      </DashboardLayout>
    );
  }


  /* =========================================================
     MAIN PAGE
  ========================================================= */

  return (
    <DashboardLayout>

      <div className="project-details-page">

        {/* =================================================
            PAGE HEADER
        ================================================= */}

        <div className="project-details-header">

          <div className="project-heading">

            <div className="breadcrumb">

              <Link to="/dashboard">
                DevSecOps
              </Link>

              <span>/</span>

              <Link to="/projects">
                Projects
              </Link>

              <span>/</span>

              <strong>
                {project.name}
              </strong>

            </div>


            <div className="project-title-row">

              <div className="project-title-icon">
                ◇
              </div>

              <div>

                <h1>
                  {project.name}
                </h1>

                <p>
                  Project security workspace
                </p>

              </div>


              <span
                className={`project-status status-${getStatusClass(
                  project.status
                )}`}
              >
                {project.status ||
                  "active"}
              </span>

            </div>

          </div>


          <div className="project-header-actions">

            <button
              type="button"
              className="secondary-button"
              onClick={handleRefresh}
            >
              ↻ Refresh
            </button>


            <button
              type="button"
              className="primary-button"
              onClick={() =>
                setShowScanForm(
                  (previous) =>
                    !previous
                )
              }
            >
              {showScanForm
                ? "× Close"
                : "▶ Run Security Scan"}
            </button>

          </div>

        </div>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="error-message">

            <strong>
              Error:
            </strong>{" "}

            {error}

          </div>
        )}


        {/* =================================================
            SCAN ERROR
        ================================================= */}

        {scanError && (
          <div className="error-message">

            <strong>
              Scan:
            </strong>{" "}

            {scanError}

          </div>
        )}


        {/* =================================================
            RUN SCAN PANEL
        ================================================= */}

        {showScanForm && (
          <section className="scan-panel">

            <div className="section-header">

              <div>

                <h2>
                  Run Security Scan
                </h2>

                <p>
                  Scan the project's local
                  source directory for
                  security findings.
                </p>

              </div>

            </div>


            <form
              className="scan-form"
              onSubmit={handleRunScan}
            >

              <div className="form-group">

                <label htmlFor="source_directory">
                  Source Directory
                </label>


                <input
                  id="source_directory"
                  type="text"
                  value={sourceDirectory}
                  onChange={(event) =>
                    setSourceDirectory(
                      event.target.value
                    )
                  }
                  placeholder="D:\Projects\MyApplication"
                  disabled={scanLoading}
                />


                <span className="field-help">
                  Enter the local source
                  directory that the backend
                  scanner can access.
                </span>

              </div>


              <div className="form-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setSourceDirectory(
                      project.source_directory ||
                        ""
                    );

                    setShowScanForm(false);
                  }}
                  disabled={scanLoading}
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="primary-button"
                  disabled={scanLoading}
                >
                  {scanLoading
                    ? "Scanning..."
                    : "Start Scan"}
                </button>

              </div>

            </form>

          </section>
        )}


        {/* =================================================
            PROJECT OVERVIEW
        ================================================= */}

        <section className="project-overview-grid">


          {/* PROJECT INFORMATION */}

          <div className="project-info-card">

            <div className="card-heading">

              <h2>
                Project Overview
              </h2>

            </div>


            <div className="overview-description">

              {project.description ||
                "No description has been provided for this project."}

            </div>


            <div className="overview-details">


              {/* REPOSITORY */}

              <div className="overview-detail">

                <span>
                  Repository
                </span>

                {project.repository_url ? (
                  <a
                    href={
                      project.repository_url
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="repository-link"
                  >
                    {project.repository_url}
                  </a>
                ) : (
                  <strong>
                    Not connected
                  </strong>
                )}

              </div>


              {/* BRANCH */}

              <div className="overview-detail">

                <span>
                  Branch
                </span>

                <strong>
                  {project.branch ||
                    "main"}
                </strong>

              </div>


              {/* SOURCE DIRECTORY */}

              <div className="overview-detail">

                <span>
                  Source Directory
                </span>

                <strong>
                  {project.source_directory ||
                    "Not configured"}
                </strong>

              </div>


              {/* PROJECT ID */}

              <div className="overview-detail">

                <span>
                  Project ID
                </span>

                <strong>
                  #{project.id}
                </strong>

              </div>


              {/* CREATED */}

              <div className="overview-detail">

                <span>
                  Created
                </span>

                <strong>
                  {formatDate(
                    project.created_at
                  )}
                </strong>

              </div>


              {/* LAST UPDATED */}

              <div className="overview-detail">

                <span>
                  Last Updated
                </span>

                <strong>
                  {formatDate(
                    project.updated_at
                  )}
                </strong>

              </div>


            </div>

          </div>


          {/* =================================================
              SECURITY SCORE
          ================================================= */}

          <div className="security-score-card">

            <div className="card-heading">

              <h2>
                Security Score
              </h2>

            </div>


            <div
              className={`security-score ${getScoreClass(
                statistics.latestScore
              )}`}
            >

              <div className="score-number">

                {statistics.latestScore !==
                null
                  ? statistics.latestScore
                  : "—"}

              </div>


              <div className="score-label">

                {statistics.latestScore !==
                null
                  ? "Latest Score"
                  : "No Scan Yet"}

              </div>

            </div>


            <div className="score-description">

              {statistics.latestScore ===
              null
                ? "Run a security scan to calculate the project's security score."
                : statistics.latestScore >=
                  80
                ? "Good security posture. Keep monitoring new findings."
                : statistics.latestScore >=
                  60
                ? "Moderate risk detected. Review the latest findings."
                : "High risk detected. Review and remediate critical findings."}

            </div>

          </div>

        </section>


        {/* =================================================
            STATISTICS
        ================================================= */}

        <section className="project-stat-grid">


          {/* TOTAL SCANS */}

          <div className="project-stat-card">

            <span className="stat-icon">
              ◇
            </span>

            <div>

              <span>
                Total Scans
              </span>

              <strong>
                {statistics.totalScans}
              </strong>

            </div>

          </div>


          {/* TOTAL FINDINGS */}

          <div className="project-stat-card">

            <span className="stat-icon">
              ⚠
            </span>

            <div>

              <span>
                Total Findings
              </span>

              <strong>
                {statistics.totalFindings}
              </strong>

            </div>

          </div>


          {/* CRITICAL */}

          <div className="project-stat-card critical-stat">

            <span className="stat-icon">
              !
            </span>

            <div>

              <span>
                Critical
              </span>

              <strong>
                {statistics.critical}
              </strong>

            </div>

          </div>


          {/* HIGH */}

          <div className="project-stat-card high-stat">

            <span className="stat-icon">
              ↑
            </span>

            <div>

              <span>
                High
              </span>

              <strong>
                {statistics.high}
              </strong>

            </div>

          </div>


          {/* MEDIUM */}

          <div className="project-stat-card medium-stat">

            <span className="stat-icon">
              •
            </span>

            <div>

              <span>
                Medium
              </span>

              <strong>
                {statistics.medium}
              </strong>

            </div>

          </div>


          {/* LOW */}

          <div className="project-stat-card low-stat">

            <span className="stat-icon">
              ↓
            </span>

            <div>

              <span>
                Low
              </span>

              <strong>
                {statistics.low}
              </strong>

            </div>

          </div>

        </section>


        {/* =================================================
            RECENT SCANS
        ================================================= */}

        <section className="recent-scans-section">


          <div className="section-header">

            <div>

              <h2>
                Recent Security Scans
              </h2>

              <p>
                Security assessments
                performed against this
                project.
              </p>

            </div>


            <Link
              to="/scan-history"
              className="secondary-button"
            >
              View All Scans
            </Link>

          </div>


          {recentScans.length === 0 ? (

            /* EMPTY STATE */

            <div className="empty-state">

              <div className="empty-icon">
                ◇
              </div>

              <h3>
                No scans yet
              </h3>

              <p>
                Run your first security
                scan to see results here.
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  setShowScanForm(true)
                }
              >
                Run First Scan
              </button>

            </div>

          ) : (

            /* SCANS TABLE */

            <div className="scans-table-wrapper">

              <table className="scans-table">

                <thead>

                  <tr>

                    <th>
                      Scan
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Files
                    </th>

                    <th>
                      Findings
                    </th>

                    <th>
                      Score
                    </th>

                    <th>
                      Started
                    </th>

                    <th>
                      Action
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {recentScans.map(
                    (scan) => {

                      const score =
                        scan.security_score;

                      return (

                        <tr
                          key={scan.id}
                        >

                          {/* SCAN */}

                          <td>

                            <div className="scan-name">

                              <strong>
                                Scan #{scan.id}
                              </strong>

                              <span>
                                {scan.scan_type ||
                                  "Security Scan"}
                              </span>

                            </div>

                          </td>


                          {/* STATUS */}

                          <td>

                            <span
                              className={`scan-status scan-status-${getStatusClass(
                                scan.status
                              )}`}
                            >
                              {scan.status ||
                                "unknown"}
                            </span>

                          </td>


                          {/* FILES */}

                          <td>

                            {scan.files_scanned ??
                              "—"}

                          </td>


                          {/* FINDINGS */}

                          <td>

                            {scan.total_findings ??
                              "—"}

                          </td>


                          {/* SCORE */}

                          <td>

                            <span
                              className={`table-score ${getScoreClass(
                                score
                              )}`}
                            >

                              {score !==
                                null &&
                              score !==
                                undefined
                                ? score
                                : "—"}

                            </span>

                          </td>


                          {/* STARTED */}

                          <td>

                            {formatDate(
                              scan.created_at ||
                                scan.started_at
                            )}

                          </td>


                          {/* ACTION */}

                          <td>

                            <Link
                              to={`/scans/${scan.id}`}
                              className="table-action"
                            >
                              Details →
                            </Link>

                          </td>

                        </tr>

                      );

                    }
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>


        {/* =================================================
            PROJECT DANGER ZONE
        ================================================= */}

        <section className="danger-zone">

          <div>

            <h2>
              Danger Zone
            </h2>

            <p>
              Permanently delete this
              project and remove it from
              the DevSecOps platform.
            </p>

          </div>


          <button
            type="button"
            className="danger-button"
            onClick={
              handleDeleteProject
            }
            disabled={deleting}
          >
            {deleting
              ? "Deleting..."
              : "Delete Project"}
          </button>

        </section>


      </div>

    </DashboardLayout>
  );
}


export default ProjectDetails;