import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import {
  getProjects,
  getScans,
  getVulnerabilities,
  getPipelines,
} from "../services/api";

import "./Dashboard.css";


function Dashboard() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [scans, setScans] = useState([]);
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [pipelines, setPipelines] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /*
  ============================================================
  LOAD DASHBOARD DATA
  ============================================================
  */

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [
        projectsResponse,
        scansResponse,
        vulnerabilitiesResponse,
        pipelinesResponse,
      ] = await Promise.all([
        getProjects(),
        getScans(),
        getVulnerabilities(),
        getPipelines(),
      ]);

      setProjects(
        Array.isArray(projectsResponse?.projects)
          ? projectsResponse.projects
          : []
      );

      setScans(
        Array.isArray(scansResponse?.scans)
          ? scansResponse.scans
          : []
      );

      setVulnerabilities(
        Array.isArray(vulnerabilitiesResponse?.vulnerabilities)
          ? vulnerabilitiesResponse.vulnerabilities
          : []
      );

      setPipelines(
        Array.isArray(pipelinesResponse?.pipelines)
          ? pipelinesResponse.pipelines
          : []
      );
    } catch (err) {
      console.error("Dashboard loading error:", err);

      setError(
        err?.message ||
          "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);


  /*
  ============================================================
  DASHBOARD CALCULATIONS
  ============================================================
  */

  const completedScans = useMemo(() => {
    return scans.filter(
      (scan) =>
        String(scan.status).toLowerCase() === "completed"
    );
  }, [scans]);


  const activePipelines = useMemo(() => {
    return pipelines.filter((pipeline) => {
      const status = String(
        pipeline.status || ""
      ).toLowerCase();

      return (
        status === "running" ||
        status === "pending" ||
        status === "queued"
      );
    });
  }, [pipelines]);


  const successfulPipelines = useMemo(() => {
    return pipelines.filter((pipeline) => {
      const status = String(
        pipeline.status || ""
      ).toLowerCase();

      return (
        status === "success" ||
        status === "successful" ||
        status === "completed"
      );
    });
  }, [pipelines]);


  const securityScore = useMemo(() => {
    if (!completedScans.length) {
      return 100;
    }

    const scores = completedScans
      .map((scan) => Number(scan.security_score))
      .filter((score) => !Number.isNaN(score));

    if (!scores.length) {
      return 100;
    }

    const total = scores.reduce(
      (sum, score) => sum + score,
      0
    );

    return Math.round(total / scores.length);
  }, [completedScans]);


  const criticalCount = useMemo(() => {
    return vulnerabilities.filter(
      (item) =>
        String(item.severity).toLowerCase() ===
        "critical"
    ).length;
  }, [vulnerabilities]);


  const highCount = useMemo(() => {
    return vulnerabilities.filter(
      (item) =>
        String(item.severity).toLowerCase() ===
        "high"
    ).length;
  }, [vulnerabilities]);


  const mediumCount = useMemo(() => {
    return vulnerabilities.filter(
      (item) =>
        String(item.severity).toLowerCase() ===
        "medium"
    ).length;
  }, [vulnerabilities]);


  const lowCount = useMemo(() => {
    return vulnerabilities.filter(
      (item) =>
        String(item.severity).toLowerCase() ===
        "low"
    ).length;
  }, [vulnerabilities]);


  /*
  ============================================================
  RECENT SCANS
  ============================================================
  */

  const recentScans = useMemo(() => {
    return [...scans]
      .sort((a, b) => {
        const dateA = new Date(
          a.created_at || a.started_at || 0
        ).getTime();

        const dateB = new Date(
          b.created_at || b.started_at || 0
        ).getTime();

        return dateB - dateA;
      })
      .slice(0, 5);
  }, [scans]);


  /*
  ============================================================
  RECENT PIPELINES
  ============================================================
  */

  const recentPipelines = useMemo(() => {
    return [...pipelines]
      .sort((a, b) => {
        const dateA = new Date(
          a.created_at ||
            a.updated_at ||
            a.started_at ||
            0
        ).getTime();

        const dateB = new Date(
          b.created_at ||
            b.updated_at ||
            b.started_at ||
            0
        ).getTime();

        return dateB - dateA;
      })
      .slice(0, 5);
  }, [pipelines]);


  /*
  ============================================================
  HELPERS
  ============================================================
  */

  function formatDate(date) {
    if (!date) {
      return "—";
    }

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "—";
    }

    return parsed.toLocaleString();
  }


  function getPipelineStatusClass(status) {
    const value = String(
      status || "unknown"
    ).toLowerCase();

    if (
      value === "success" ||
      value === "successful" ||
      value === "completed"
    ) {
      return "status-success";
    }

    if (
      value === "failed" ||
      value === "failure" ||
      value === "error"
    ) {
      return "status-danger";
    }

    if (
      value === "running" ||
      value === "pending" ||
      value === "queued"
    ) {
      return "status-warning";
    }

    return "status-neutral";
  }


  function getSeverityClass(severity) {
    return `severity-${String(
      severity || "low"
    ).toLowerCase()}`;
  }


  function getScoreClass(score) {
    if (score >= 90) {
      return "score-good";
    }

    if (score >= 70) {
      return "score-warning";
    }

    return "score-danger";
  }


  /*
  ============================================================
  LOADING STATE
  ============================================================
  */

  if (loading) {
    return (
      <DashboardLayout>
        <div className="dashboard-page">
          <div className="dashboard-loading">
            <div className="loading-spinner"></div>

            <h2>
              Loading security dashboard
            </h2>

            <p>
              Gathering projects, scans,
              vulnerabilities and pipelines...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }


  /*
  ============================================================
  MAIN DASHBOARD
  ============================================================
  */

  return (
    <DashboardLayout>
      <div className="dashboard-page">

        {/* =================================================
            HEADER
        ================================================= */}

        <section className="dashboard-hero">

          <div className="dashboard-hero-content">

            <div className="dashboard-eyebrow">
              DEVSECOPS OVERVIEW
            </div>

            <h1>
              Security Dashboard
            </h1>

            <p>
              Monitor your projects, security scans,
              vulnerabilities and CI/CD pipelines
              from one place.
            </p>

          </div>


          <div className="dashboard-actions">

            <button
              type="button"
              className="dashboard-refresh-button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
            >
              <span className={refreshing ? "spin" : ""}>
                ↻
              </span>

              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>


            <button
              type="button"
              className="dashboard-primary-button"
              onClick={() => navigate("/projects")}
            >
              + New Security Scan
            </button>

          </div>

        </section>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="dashboard-alert">

            <div className="dashboard-alert-icon">
              !
            </div>

            <div>
              <strong>
                Dashboard data could not be fully loaded
              </strong>

              <p>
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadDashboard(true)}
            >
              Retry
            </button>

          </div>
        )}


        {/* =================================================
            STAT CARDS
        ================================================= */}

        <section className="dashboard-stats">

          {/* PROJECTS */}

          <Link
            to="/projects"
            className="dashboard-stat-card"
          >
            <div className="stat-card-top">
              <span className="stat-label">
                Projects
              </span>

              <span className="stat-icon stat-icon-blue">
                ◇
              </span>
            </div>

            <strong className="stat-value">
              {projects.length}
            </strong>

            <span className="stat-description">
              Active projects
            </span>
          </Link>


          {/* SCANS */}

          <Link
            to="/security-scans"
            className="dashboard-stat-card"
          >
            <div className="stat-card-top">
              <span className="stat-label">
                Security Scans
              </span>

              <span className="stat-icon stat-icon-purple">
                ⌁
              </span>
            </div>

            <strong className="stat-value">
              {completedScans.length}
            </strong>

            <span className="stat-description">
              Completed assessments
            </span>
          </Link>


          {/* VULNERABILITIES */}

          <Link
            to="/vulnerabilities"
            className="dashboard-stat-card"
          >
            <div className="stat-card-top">
              <span className="stat-label">
                Vulnerabilities
              </span>

              <span className="stat-icon stat-icon-red">
                !
              </span>
            </div>

            <strong className="stat-value">
              {vulnerabilities.length}
            </strong>

            <span className="stat-description">
              Security findings
            </span>

            <div className="stat-severity-row">

              <span className="mini-critical">
                {criticalCount} critical
              </span>

              <span className="mini-high">
                {highCount} high
              </span>

            </div>
          </Link>


          {/* SCORE */}

          <div className="dashboard-stat-card score-card">

            <div className="stat-card-top">
              <span className="stat-label">
                Security Score
              </span>

              <span className="stat-icon stat-icon-green">
                ✓
              </span>
            </div>

            <div className="score-display">

              <strong
                className={`stat-value ${getScoreClass(
                  securityScore
                )}`}
              >
                {securityScore}%
              </strong>

              <div className="score-bar">
                <div
                  className={`score-bar-fill ${getScoreClass(
                    securityScore
                  )}`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, securityScore)
                    )}%`,
                  }}
                />
              </div>

            </div>

            <span className="stat-description">
              Current security posture
            </span>

          </div>

        </section>


        {/* =================================================
            MAIN GRID
        ================================================= */}

        <section className="dashboard-main-grid">

          {/* =================================================
              SECURITY STATUS
          ================================================= */}

          <div className="dashboard-panel security-panel">

            <div className="panel-header">

              <div>
                <span className="panel-eyebrow">
                  SECURITY HEALTH
                </span>

                <h2>
                  Security Status
                </h2>

                <p>
                  Current security health across
                  your platform.
                </p>
              </div>

              <span
                className={
                  vulnerabilities.length === 0
                    ? "health-badge health-secure"
                    : "health-badge health-warning"
                }
              >
                <span className="health-dot"></span>

                {vulnerabilities.length === 0
                  ? "Secure"
                  : "Attention Required"}
              </span>

            </div>


            <div className="security-overview">

              <div className="security-score-large">

                <div
                  className={`score-circle ${getScoreClass(
                    securityScore
                  )}`}
                >
                  <strong>
                    {securityScore}
                  </strong>

                  <span>
                    / 100
                  </span>
                </div>

                <div>
                  <strong>
                    Overall Security Score
                  </strong>

                  <p>
                    Based on completed security
                    assessments.
                  </p>
                </div>

              </div>


              <div className="severity-breakdown">

                <div className="severity-row">
                  <span>
                    <i className="severity-dot critical"></i>
                    Critical
                  </span>

                  <strong>
                    {criticalCount}
                  </strong>
                </div>

                <div className="severity-row">
                  <span>
                    <i className="severity-dot high"></i>
                    High
                  </span>

                  <strong>
                    {highCount}
                  </strong>
                </div>

                <div className="severity-row">
                  <span>
                    <i className="severity-dot medium"></i>
                    Medium
                  </span>

                  <strong>
                    {mediumCount}
                  </strong>
                </div>

                <div className="severity-row">
                  <span>
                    <i className="severity-dot low"></i>
                    Low
                  </span>

                  <strong>
                    {lowCount}
                  </strong>
                </div>

              </div>

            </div>


            <div className="panel-footer">

              <Link to="/vulnerabilities">
                View all findings →
              </Link>

            </div>

          </div>


          {/* =================================================
              PIPELINE STATUS
          ================================================= */}

          <div className="dashboard-panel pipeline-panel">

            <div className="panel-header">

              <div>
                <span className="panel-eyebrow">
                  CI/CD
                </span>

                <h2>
                  Pipeline Status
                </h2>

                <p>
                  Current CI/CD pipeline overview.
                </p>
              </div>

              <span className="pipeline-count">
                {pipelines.length}
              </span>

            </div>


            <div className="pipeline-summary">

              <div>
                <strong>
                  {successfulPipelines.length}
                </strong>

                <span>
                  Successful
                </span>
              </div>

              <div>
                <strong>
                  {activePipelines.length}
                </strong>

                <span>
                  Active
                </span>
              </div>

            </div>


            <div className="panel-footer">

              <Link to="/pipelines">
                Manage pipelines →
              </Link>

            </div>

          </div>

        </section>


        {/* =================================================
            RECENT SCANS
        ================================================= */}

        <section className="dashboard-panel recent-panel">

          <div className="panel-header">

            <div>
              <span className="panel-eyebrow">
                SECURITY ACTIVITY
              </span>

              <h2>
                Recent Security Scans
              </h2>

              <p>
                Latest security assessments performed
                on your projects.
              </p>
            </div>

            <Link
              to="/security-scans"
              className="panel-action"
            >
              View all →
            </Link>

          </div>


          {recentScans.length === 0 ? (
            <div className="dashboard-empty">

              <div className="empty-icon">
                ⌁
              </div>

              <h3>
                No security scans yet
              </h3>

              <p>
                Run your first security scan to
                start monitoring your security posture.
              </p>

            </div>
          ) : (
            <div className="scan-table">

              <div className="scan-table-header">
                <span>Project</span>
                <span>Status</span>
                <span>Findings</span>
                <span>Score</span>
                <span>Date</span>
              </div>


              {recentScans.map((scan) => (

                <Link
                  key={scan.id}
                  to={`/scans/${scan.id}`}
                  className="scan-table-row"
                >

                  <div className="scan-project">

                    <div className="scan-project-icon">
                      ◇
                    </div>

                    <div>
                      <strong>
                        {scan.project_name ||
                          `Project #${scan.project_id}`}
                      </strong>

                      <span>
                        Scan #{scan.id}
                      </span>
                    </div>

                  </div>


                  <div>
                    <span
                      className={`table-status ${getPipelineStatusClass(
                        scan.status
                      )}`}
                    >
                      {scan.status || "unknown"}
                    </span>
                  </div>


                  <div>
                    <strong>
                      {scan.total_findings ?? 0}
                    </strong>
                  </div>


                  <div>
                    <strong
                      className={getScoreClass(
                        Number(scan.security_score ?? 0)
                      )}
                    >
                      {scan.security_score ?? 0}%
                    </strong>
                  </div>


                  <div className="scan-date">
                    {formatDate(
                      scan.completed_at ||
                        scan.created_at
                    )}
                  </div>

                </Link>

              ))}

            </div>
          )}

        </section>


        {/* =================================================
            RECENT PIPELINES + QUICK ACTIONS
        ================================================= */}

        <section className="dashboard-bottom-grid">

          {/* RECENT PIPELINES */}

          <div className="dashboard-panel">

            <div className="panel-header">

              <div>
                <span className="panel-eyebrow">
                  PIPELINE ACTIVITY
                </span>

                <h2>
                  Recent Pipelines
                </h2>
              </div>

              <Link
                to="/pipelines"
                className="panel-action"
              >
                View all →
              </Link>

            </div>


            {recentPipelines.length === 0 ? (
              <div className="dashboard-empty small">

                <div className="empty-icon">
                  ⚡
                </div>

                <h3>
                  No pipelines yet
                </h3>

                <p>
                  Create a pipeline to start
                  automating security checks.
                </p>

              </div>
            ) : (
              <div className="pipeline-list">

                {recentPipelines.map((pipeline) => (

                  <Link
                    key={pipeline.id}
                    to={`/pipelines/${pipeline.id}`}
                    className="pipeline-item"
                  >

                    <div className="pipeline-icon">
                      ⚡
                    </div>

                    <div className="pipeline-info">

                      <strong>
                        {pipeline.name ||
                          `Pipeline #${pipeline.id}`}
                      </strong>

                      <span>
                        {pipeline.project_name ||
                          "Project"}
                      </span>

                    </div>

                    <span
                      className={`table-status ${getPipelineStatusClass(
                        pipeline.status
                      )}`}
                    >
                      {pipeline.status ||
                        "unknown"}
                    </span>

                  </Link>

                ))}

              </div>
            )}

          </div>


          {/* QUICK ACTIONS */}

          <div className="dashboard-panel">

            <div className="panel-header">

              <div>
                <span className="panel-eyebrow">
                  MANAGEMENT
                </span>

                <h2>
                  Quick Actions
                </h2>

                <p>
                  Common platform operations.
                </p>
              </div>

            </div>


            <div className="quick-actions">

              <Link
                to="/projects"
                className="quick-action"
              >
                <span className="quick-action-icon">
                  ◇
                </span>

                <span>
                  <strong>
                    Manage Projects
                  </strong>

                  <small>
                    View and configure projects
                  </small>
                </span>

                <b>
                  →
                </b>
              </Link>


              <Link
                to="/pipelines"
                className="quick-action"
              >
                <span className="quick-action-icon">
                  ⚡
                </span>

                <span>
                  <strong>
                    Manage Pipelines
                  </strong>

                  <small>
                    Configure CI/CD pipelines
                  </small>
                </span>

                <b>
                  →
                </b>
              </Link>


              <Link
                to="/vulnerabilities"
                className="quick-action"
              >
                <span className="quick-action-icon danger">
                  !
                </span>

                <span>
                  <strong>
                    Review Vulnerabilities
                  </strong>

                  <small>
                    Investigate security findings
                  </small>
                </span>

                <b>
                  →
                </b>
              </Link>

            </div>

          </div>

        </section>

      </div>
    </DashboardLayout>
  );
}


export default Dashboard;