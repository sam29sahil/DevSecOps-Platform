import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";

import {
  getProjects,
  getScans,
  getVulnerabilities,
  getPipelines,
} from "../services/api";
import "./Dashboard.css";


function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [scans, setScans] = useState([]);
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [pipelines, setPipelines] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /*
  =========================================================
  LOAD DASHBOARD DATA
  =========================================================
  */

  async function loadDashboard(showLoader = true) {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const results = await Promise.allSettled([
        getProjects(),
        getScans(),
        getVulnerabilities(),
        getPipelines(),
      ]);

      const [
        projectsResult,
        scansResult,
        vulnerabilitiesResult,
        pipelinesResult,
      ] = results;

      /*
      -------------------------------------------------------
      PROJECTS
      -------------------------------------------------------
      */

      if (projectsResult.status === "fulfilled") {
        const data = projectsResult.value;

        setProjects(
          Array.isArray(data?.projects)
            ? data.projects
            : []
        );
      } else {
        setProjects([]);
      }

      /*
      -------------------------------------------------------
      SCANS
      -------------------------------------------------------
      */

      if (scansResult.status === "fulfilled") {
        const data = scansResult.value;

        setScans(
          Array.isArray(data?.scans)
            ? data.scans
            : []
        );
      } else {
        setScans([]);
      }

      /*
      -------------------------------------------------------
      VULNERABILITIES
      -------------------------------------------------------
      */

      if (vulnerabilitiesResult.status === "fulfilled") {
        const data = vulnerabilitiesResult.value;

        setVulnerabilities(
          Array.isArray(data?.vulnerabilities)
            ? data.vulnerabilities
            : Array.isArray(data?.findings)
            ? data.findings
            : []
        );
      } else {
        setVulnerabilities([]);
      }

      /*
      -------------------------------------------------------
      PIPELINES
      -------------------------------------------------------
      */

      if (pipelinesResult.status === "fulfilled") {
        const data = pipelinesResult.value;

        setPipelines(
          Array.isArray(data?.pipelines)
            ? data.pipelines
            : []
        );
      } else {
        setPipelines([]);
      }

      /*
      -------------------------------------------------------
      PARTIAL FAILURE HANDLING
      -------------------------------------------------------
      */

      const failedRequests = results.filter(
        (result) => result.status === "rejected"
      );

      if (failedRequests.length === results.length) {
        setError(
          "Unable to load dashboard data. Check that the Flask API is running."
        );
      }
    } catch (err) {
      console.error("Dashboard loading error:", err);

      setError(
        err?.message ||
          "Failed to load dashboard data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }


  /*
  =========================================================
  INITIAL LOAD
  =========================================================
  */

  useEffect(() => {
    loadDashboard(true);
  }, []);


  /*
  =========================================================
  CALCULATED DASHBOARD VALUES
  =========================================================
  */

  const completedScans = useMemo(() => {
    return scans.filter(
      (scan) =>
        String(scan?.status || "").toLowerCase() ===
        "completed"
    );
  }, [scans]);


  const runningScans = useMemo(() => {
    return scans.filter((scan) => {
      const status = String(
        scan?.status || ""
      ).toLowerCase();

      return (
        status === "running" ||
        status === "pending"
      );
    });
  }, [scans]);


  const failedScans = useMemo(() => {
    return scans.filter(
      (scan) =>
        String(scan?.status || "").toLowerCase() ===
        "failed"
    );
  }, [scans]);


  /*
  ---------------------------------------------------------
  LATEST SCAN
  ---------------------------------------------------------
  */

  const latestScan = useMemo(() => {
    if (!scans.length) {
      return null;
    }

    return [...scans].sort((a, b) => {
      const dateA = new Date(
        a?.completed_at ||
          a?.created_at ||
          a?.started_at ||
          0
      ).getTime();

      const dateB = new Date(
        b?.completed_at ||
          b?.created_at ||
          b?.started_at ||
          0
      ).getTime();

      return dateB - dateA;
    })[0];
  }, [scans]);


  /*
  ---------------------------------------------------------
  SECURITY SCORE
  ---------------------------------------------------------
  */

  const securityScore = useMemo(() => {
    if (!latestScan) {
      return 100;
    }

    const score = Number(
      latestScan.security_score
    );

    if (Number.isNaN(score)) {
      return 100;
    }

    return Math.max(
      0,
      Math.min(100, score)
    );
  }, [latestScan]);


  /*
  ---------------------------------------------------------
  PIPELINE STATUS
  ---------------------------------------------------------
  */

  const pipelineStats = useMemo(() => {
    let successful = 0;
    let running = 0;
    let failed = 0;

    pipelines.forEach((pipeline) => {
      const status = String(
        pipeline?.status || ""
      ).toLowerCase();

      if (
        status === "success" ||
        status === "successful" ||
        status === "completed"
      ) {
        successful++;
      } else if (
        status === "running"
      ) {
        running++;
      } else if (
        status === "failed" ||
        status === "failure" ||
        status === "error"
      ) {
        failed++;
      }
    });

    return {
      total: pipelines.length,
      successful,
      running,
      failed,
    };
  }, [pipelines]);


  /*
  ---------------------------------------------------------
  VULNERABILITY SEVERITIES
  ---------------------------------------------------------
  */

  const severityStats = useMemo(() => {
    const stats = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    vulnerabilities.forEach((item) => {
      const severity = String(
        item?.severity || "LOW"
      ).toLowerCase();

      if (severity === "critical") {
        stats.critical++;
      } else if (severity === "high") {
        stats.high++;
      } else if (severity === "medium") {
        stats.medium++;
      } else {
        stats.low++;
      }
    });

    return stats;
  }, [vulnerabilities]);


  /*
  ---------------------------------------------------------
  SECURITY STATUS
  ---------------------------------------------------------
  */

  const securityStatus = useMemo(() => {
    if (
      severityStats.critical > 0
    ) {
      return {
        label: "Critical Risk",
        description:
          "Critical security vulnerabilities require immediate attention.",
        className: "critical",
      };
    }

    if (
      severityStats.high > 0
    ) {
      return {
        label: "High Risk",
        description:
          "High-severity vulnerabilities require attention.",
        className: "high",
      };
    }

    if (
      severityStats.medium > 0
    ) {
      return {
        label: "Attention Required",
        description:
          "Medium-severity security findings were detected.",
        className: "medium",
      };
    }

    return {
      label: "System Secure",
      description:
        "No active high-risk security issues detected.",
      className: "secure",
    };
  }, [severityStats]);


  /*
  ---------------------------------------------------------
  RECENT SCANS
  ---------------------------------------------------------
  */

  const recentScans = useMemo(() => {
    return [...scans]
      .sort((a, b) => {
        const dateA = new Date(
          a?.created_at ||
            a?.started_at ||
            0
        ).getTime();

        const dateB = new Date(
          b?.created_at ||
            b?.started_at ||
            0
        ).getTime();

        return dateB - dateA;
      })
      .slice(0, 5);
  }, [scans]);


  /*
  ---------------------------------------------------------
  RECENT PIPELINES
  ---------------------------------------------------------
  */

  const recentPipelines = useMemo(() => {
    return [...pipelines]
      .sort((a, b) => {
        const dateA = new Date(
          a?.updated_at ||
            a?.last_run ||
            a?.created_at ||
            0
        ).getTime();

        const dateB = new Date(
          b?.updated_at ||
            b?.last_run ||
            b?.created_at ||
            0
        ).getTime();

        return dateB - dateA;
      })
      .slice(0, 5);
  }, [pipelines]);


  /*
  =========================================================
  HELPERS
  =========================================================
  */

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString();
  }


  function statusClass(status) {
    const normalized = String(
      status || "unknown"
    ).toLowerCase();

    if (
      normalized === "completed" ||
      normalized === "success" ||
      normalized === "successful"
    ) {
      return "status-completed";
    }

    if (
      normalized === "running"
    ) {
      return "status-running";
    }

    if (
      normalized === "failed" ||
      normalized === "failure" ||
      normalized === "error"
    ) {
      return "status-failed";
    }

    return "status-pending";
  }


  function severityClass(severity) {
    return `severity-${String(
      severity || "LOW"
    ).toLowerCase()}`;
  }


  /*
  =========================================================
  LOADING
  =========================================================
  */

  if (loading) {
    return (
      <DashboardLayout>
        <div className="dashboard-page">

          <div className="dashboard-header">
            <div>
              <h1>Security Dashboard</h1>

              <p>
                Loading your DevSecOps security posture...
              </p>
            </div>
          </div>

          <div className="loading-state">
            Loading dashboard...
          </div>

        </div>
      </DashboardLayout>
    );
  }


  /*
  =========================================================
  RENDER
  =========================================================
  */

  return (
    <DashboardLayout>

      <div className="dashboard-page">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="dashboard-header">

          <div>
            <div className="page-eyebrow">
              DEVSECOPS OVERVIEW
            </div>

            <h1>
              Security Dashboard
            </h1>

            <p>
              Monitor your projects, security scans,
              vulnerabilities and CI/CD pipelines.
            </p>
          </div>

          <div className="dashboard-actions">

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                loadDashboard(false)
              }
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>

            <Link
              to="/scan-history"
              className="scan-button"
            >
              + New Security Scan
            </Link>

          </div>

        </div>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="error-message">
            <strong>
              Dashboard warning
            </strong>

            <span>
              {error}
            </span>
          </div>
        )}


        {/* =================================================
            MAIN STATS
        ================================================= */}

        <div className="stats-grid">

          {/* PROJECTS */}

          <Link
            to="/projects"
            className="stat-card stat-card-link"
          >
            <span>
              Projects
            </span>

            <strong>
              {projects.length}
            </strong>

            <small>
              Active projects
            </small>
          </Link>


          {/* SCANS */}

          <Link
            to="/scan-history"
            className="stat-card stat-card-link"
          >
            <span>
              Security Scans
            </span>

            <strong>
              {completedScans.length}
            </strong>

            <small>
              Completed assessments
            </small>
          </Link>


          {/* VULNERABILITIES */}

          <Link
            to="/vulnerabilities"
            className="stat-card stat-card-link"
          >
            <span>
              Vulnerabilities
            </span>

            <strong>
              {vulnerabilities.length}
            </strong>

            <small>
              Security findings
            </small>
          </Link>


          {/* SECURITY SCORE */}

          <div className="stat-card">

            <span>
              Security Score
            </span>

            <strong className="security-score">
              {securityScore}%
            </strong>

            <small>
              Current security posture
            </small>

          </div>

        </div>


        {/* =================================================
            SECONDARY METRICS
        ================================================= */}

        <div className="dashboard-grid">

          {/* SECURITY STATUS */}

          <div className="dashboard-panel">

            <div className="panel-header">

              <div>
                <h2>
                  Security Status
                </h2>

                <p>
                  Current security health
                </p>
              </div>

              <Link
                to="/vulnerabilities"
                className="panel-link"
              >
                View findings →
              </Link>

            </div>


            <div
              className={`security-status security-status-${securityStatus.className}`}
            >

              <div className="status-indicator"></div>

              <div>

                <strong>
                  {securityStatus.label}
                </strong>

                <p>
                  {securityStatus.description}
                </p>

              </div>

            </div>


            <div className="severity-overview">

              <div>
                <span className="severity-dot critical"></span>
                <span>Critical</span>
                <strong>
                  {severityStats.critical}
                </strong>
              </div>

              <div>
                <span className="severity-dot high"></span>
                <span>High</span>
                <strong>
                  {severityStats.high}
                </strong>
              </div>

              <div>
                <span className="severity-dot medium"></span>
                <span>Medium</span>
                <strong>
                  {severityStats.medium}
                </strong>
              </div>

              <div>
                <span className="severity-dot low"></span>
                <span>Low</span>
                <strong>
                  {severityStats.low}
                </strong>
              </div>

            </div>

          </div>


          {/* PIPELINE STATUS */}

          <div className="dashboard-panel">

            <div className="panel-header">

              <div>
                <h2>
                  Pipeline Status
                </h2>

                <p>
                  CI/CD security pipeline overview
                </p>
              </div>

              <Link
                to="/pipelines"
                className="panel-link"
              >
                Manage →
              </Link>

            </div>


            <div className="pipeline-dashboard-stats">

              <div>
                <span>
                  Total
                </span>

                <strong>
                  {pipelineStats.total}
                </strong>
              </div>

              <div>
                <span>
                  Successful
                </span>

                <strong>
                  {pipelineStats.successful}
                </strong>
              </div>

              <div>
                <span>
                  Running
                </span>

                <strong>
                  {pipelineStats.running}
                </strong>
              </div>

              <div>
                <span>
                  Failed
                </span>

                <strong>
                  {pipelineStats.failed}
                </strong>
              </div>

            </div>

          </div>

        </div>


        {/* =================================================
            RECENT SCANS + RECENT PIPELINES
        ================================================= */}

        <div className="dashboard-grid">

          {/* RECENT SCANS */}

          <div className="dashboard-panel">

            <div className="panel-header">

              <div>
                <h2>
                  Recent Security Scans
                </h2>

                <p>
                  Latest security assessments
                </p>
              </div>

              <Link
                to="/scan-history"
                className="panel-link"
              >
                View all →
              </Link>

            </div>


            {recentScans.length === 0 ? (

              <div className="empty-state">

                <div className="empty-icon">
                  ◇
                </div>

                <h3>
                  No scans yet
                </h3>

                <p>
                  Run a security scan to see results here.
                </p>

              </div>

            ) : (

              <div className="dashboard-list">

                {recentScans.map((scan) => (

                  <Link
                    key={scan.id}
                    to={`/scans/${scan.id}`}
                    className="dashboard-list-item"
                  >

                    <div className="dashboard-list-main">

                      <strong>
                        Scan #{scan.id}
                      </strong>

                      <span>
                        {scan.project_name ||
                          `Project #${scan.project_id}`}
                      </span>

                    </div>


                    <div className="dashboard-list-meta">

                      <span
                        className={`status-badge ${statusClass(
                          scan.status
                        )}`}
                      >
                        {scan.status || "unknown"}
                      </span>

                      <strong>
                        {scan.security_score ?? 0}%
                      </strong>

                      <small>
                        {scan.total_findings ?? 0} findings
                      </small>

                    </div>

                  </Link>

                ))}

              </div>

            )}

          </div>


          {/* RECENT PIPELINES */}

          <div className="dashboard-panel">

            <div className="panel-header">

              <div>
                <h2>
                  Recent Pipelines
                </h2>

                <p>
                  Latest CI/CD activity
                </p>
              </div>

              <Link
                to="/pipelines"
                className="panel-link"
              >
                View all →
              </Link>

            </div>


            {recentPipelines.length === 0 ? (

              <div className="empty-state">

                <div className="empty-icon">
                  ⚡
                </div>

                <h3>
                  No pipelines yet
                </h3>

                <p>
                  Connect a repository to start your first
                  DevSecOps pipeline.
                </p>

                <Link
                  to="/pipelines"
                  className="primary-button"
                >
                  Create Pipeline
                </Link>

              </div>

            ) : (

              <div className="dashboard-list">

                {recentPipelines.map(
                  (pipeline) => (

                    <div
                      key={pipeline.id}
                      className="dashboard-list-item"
                    >

                      <div className="dashboard-list-main">

                        <strong>
                          {pipeline.name ||
                            `Pipeline #${pipeline.id}`}
                        </strong>

                        <span>
                          {pipeline.project_name ||
                            `Project #${pipeline.project_id}`}
                        </span>

                      </div>


                      <div className="dashboard-list-meta">

                        <span
                          className={`status-badge ${statusClass(
                            pipeline.status
                          )}`}
                        >
                          {pipeline.status ||
                            "unknown"}
                        </span>

                        <small>
                          {formatDate(
                            pipeline.updated_at ||
                              pipeline.last_run ||
                              pipeline.created_at
                          )}
                        </small>

                      </div>

                    </div>

                  )
                )}

              </div>

            )}

          </div>

        </div>


        {/* =================================================
            LATEST SCAN
        ================================================= */}

        <div className="dashboard-panel latest-scan-panel">

          <div className="panel-header">

            <div>
              <h2>
                Latest Security Assessment
              </h2>

              <p>
                Most recent completed security scan
              </p>
            </div>

            {latestScan && (
              <Link
                to={`/scans/${latestScan.id}`}
                className="panel-link"
              >
                Open scan →
              </Link>
            )}

          </div>


          {!latestScan ? (

            <div className="empty-state">

              <div className="empty-icon">
                ✓
              </div>

              <h3>
                No security assessment available
              </h3>

              <p>
                Run your first scan to establish your
                security baseline.
              </p>

            </div>

          ) : (

            <div className="latest-scan-content">

              <div className="latest-scan-score">

                <span>
                  Security Score
                </span>

                <strong>
                  {securityScore}%
                </strong>

              </div>


              <div className="latest-scan-details">

                <div>
                  <span>
                    Scan
                  </span>

                  <strong>
                    #{latestScan.id}
                  </strong>
                </div>

                <div>
                  <span>
                    Project
                  </span>

                  <strong>
                    {latestScan.project_name ||
                      `Project #${latestScan.project_id}`}
                  </strong>
                </div>

                <div>
                  <span>
                    Files Scanned
                  </span>

                  <strong>
                    {latestScan.files_scanned ?? 0}
                  </strong>
                </div>

                <div>
                  <span>
                    Findings
                  </span>

                  <strong>
                    {latestScan.total_findings ?? 0}
                  </strong>
                </div>

                <div>
                  <span>
                    Status
                  </span>

                  <strong
                    className={`text-status ${statusClass(
                      latestScan.status
                    )}`}
                  >
                    {latestScan.status}
                  </strong>
                </div>

                <div>
                  <span>
                    Completed
                  </span>

                  <strong>
                    {formatDate(
                      latestScan.completed_at
                    )}
                  </strong>
                </div>

              </div>

            </div>

          )}

        </div>


        {/* =================================================
            SYSTEM SUMMARY
        ================================================= */}

        <div className="dashboard-footer-summary">

          <div>
            <span>
              Completed scans
            </span>

            <strong>
              {completedScans.length}
            </strong>
          </div>

          <div>
            <span>
              Running scans
            </span>

            <strong>
              {runningScans.length}
            </strong>
          </div>

          <div>
            <span>
              Failed scans
            </span>

            <strong>
              {failedScans.length}
            </strong>
          </div>

          <div>
            <span>
              Total findings
            </span>

            <strong>
              {vulnerabilities.length}
            </strong>
          </div>

        </div>

      </div>

    </DashboardLayout>
  );
}

export default Dashboard;