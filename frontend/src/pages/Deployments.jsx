import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ExternalLink,
  Server,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Power,
  Trash2,
  Layers,
  Globe,
  Radio,
  ShieldAlert,
  Play,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  getDeployments,
  getDeploymentStats,
  stopDeployment,
  deleteDeployment,
  startDeployment,
  restartDeployment,
  stopAllDeployments,
  checkDeploymentHealth,
} from "../services/api";
import { formatDateTime } from "../utils/time";
import "./Deployments.css";

const ACTIVE_STATUSES = new Set([
  "pending",
  "queued",
  "building",
  "scanning",
  "pushing",
  "deploying",
]);

function getStageProgressMessage(status) {
  const norm = String(status || "").toLowerCase();
  switch (norm) {
    case "queued":
      return "Queued for execution — Dispatching GitHub Actions workflow...";
    case "building":
      return "Building Docker image on remote GitHub runner...";
    case "scanning":
      return "Running Trivy container security & vulnerability scan...";
    case "pushing":
      return "Pushing verified container image to Amazon ECR...";
    case "deploying":
      return "Deploying service to AWS ECS Fargate & registering task...";
    case "pending":
    default:
      return "Initializing pipeline & deployment checks...";
  }
}

function StatusBadge({ status }) {
  const norm = String(status || "").toLowerCase();
  let badgeClass = "badge-pending";
  let label = "PENDING";

  if (norm === "deployed" || norm === "success" || norm === "running") {
    badgeClass = "badge-deployed";
    label = "RUNNING";
  } else if (norm === "failed") {
    badgeClass = "badge-failed";
    label = "FAILED";
  } else if (norm === "stopped") {
    badgeClass = "badge-stopped";
    label = "STOPPED";
  } else if (norm === "queued") {
    badgeClass = "badge-queued";
    label = "QUEUED";
  } else if (norm === "building") {
    badgeClass = "badge-building";
    label = "BUILDING";
  } else if (norm === "scanning") {
    badgeClass = "badge-scanning";
    label = "SCANNING";
  } else if (norm === "pushing") {
    badgeClass = "badge-pushing";
    label = "PUSHING";
  } else if (norm === "deploying") {
    badgeClass = "badge-deploying";
    label = "DEPLOYING";
  }

  return <span className={`dep-badge ${badgeClass}`}>{label}</span>;
}

function HealthBadge({ status }) {
  const norm = String(status || "").toLowerCase();
  if (norm === "healthy") {
    return (
      <span className="health-badge healthy">
        <span className="health-dot" /> HEALTHY
      </span>
    );
  }
  if (norm === "unhealthy" || norm === "failed") {
    return (
      <span className="health-badge unhealthy">
        <span className="health-dot" /> {norm === "failed" ? "FAILED" : "UNHEALTHY"}
      </span>
    );
  }
  if (norm === "stopped") {
    return (
      <span className="health-badge unknown">
        <span className="health-dot" /> STOPPED
      </span>
    );
  }
  return (
    <span className="health-badge unknown">
      <span className="health-dot" /> {status ? status.toUpperCase() : "UNKNOWN"}
    </span>
  );
}

export default function Deployments() {
  const [deployments, setDeployments] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    running: 0,
    latest: null,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const deploymentsRef = useRef([]);
  const isFetchingRef = useRef(false);

  async function loadData(silent = false) {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!silent) setLoading(true);
    try {
      const [depsData, statsData] = await Promise.all([
        getDeployments(),
        getDeploymentStats(),
      ]);

      if (depsData && depsData.success) {
        const list = depsData.deployments || [];
        setDeployments(list);
        deploymentsRef.current = list;
      }
      if (statsData && statsData.success) {
        setStats(statsData.stats || {});
      }
      setError("");
    } catch (err) {
      if (!silent) setError(err.message || "Failed to load deployments.");
    } finally {
      isFetchingRef.current = false;
      if (!silent) setLoading(false);
    }
  }

  // Smart polling: polls every 5s ONLY while active deployments are progressing
  useEffect(() => {
    loadData(false);
    const interval = setInterval(() => {
      const hasActive = (deploymentsRef.current || []).some((d) =>
        ACTIVE_STATUSES.has(String(d.status || "").toLowerCase())
      );
      if (hasActive && !isFetchingRef.current) {
        loadData(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleStart(id) {
    try {
      setActionLoading(id);
      await startDeployment(id);
      setMessage(`Deployment ${id} started on AWS ECS.`);
      await loadData(true);
    } catch (err) {
      setError(err.message || "Failed to start deployment.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRestart(id) {
    if (!window.confirm("Restart this ECS service tasks?")) return;
    try {
      setActionLoading(id);
      await restartDeployment(id);
      setMessage(`Deployment ${id} restart triggered.`);
      await loadData(true);
    } catch (err) {
      setError(err.message || "Failed to restart deployment.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCheckHealth(id) {
    try {
      setActionLoading(id);
      const res = await checkDeploymentHealth(id);
      if (res.healthy) {
        setMessage(`Health check passed for ${id}: 200 OK (${res.details?.response_time_ms || 0}ms)`);
      } else {
        setError(`Health check failed for ${id}: ${res.details?.error || "Endpoint unreachable"}`);
      }
      await loadData(true);
    } catch (err) {
      setError(err.message || "Health check failed.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStop(id) {
    if (!window.confirm("Are you sure you want to stop this running ECS deployment?")) return;
    try {
      setActionLoading(id);
      await stopDeployment(id);
      setMessage(`Deployment ${id} stopped.`);
      await loadData(true);
    } catch (err) {
      setError(err.message || "Failed to stop deployment.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStopAll() {
    if (!window.confirm("Stop ALL running ECS deployments across the platform to save AWS resources?")) return;
    try {
      setActionLoading("stop-all");
      const res = await stopAllDeployments();
      setMessage(res.message || "All active deployments stopped.");
      await loadData(true);
    } catch (err) {
      setError(err.message || "Failed to stop all deployments.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Remove this deployment record?")) return;
    try {
      setActionLoading(id);
      await deleteDeployment(id);
      setMessage(`Deployment record ${id} removed.`);
      await loadData(true);
    } catch (err) {
      setError(err.message || "Failed to delete deployment.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <DashboardLayout>
      <div className="deployments-page">
        {/* HEADER */}
        <div className="page-header">
          <div>
            <div className="page-eyebrow">AWS ECS FARGATE</div>
            <h1 className="page-title">Deployments & Live Applications</h1>
            <p className="page-subtitle">
              Monitor active container workloads, live application URLs, and health check statuses deployed on AWS.
            </p>
          </div>

          <div className="header-actions" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadData(false)}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              className="btn btn-danger"
              style={{ background: "#dc2626", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}
              onClick={handleStopAll}
              disabled={actionLoading === "stop-all" || deployments.length === 0}
              title="Stop all active ECS tasks to prevent unwanted AWS costs"
            >
              <Power size={15} />
              <span>{actionLoading === "stop-all" ? "Stopping All..." : "Stop All Deployments"}</span>
            </button>
          </div>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="alert alert-error">
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="alert alert-success">
            <CheckCircle2 size={18} />
            <span>{message}</span>
          </div>
        )}

        {/* METRIC CARDS */}
        <div className="dep-metrics-grid">
          <div className="metric-card">
            <span className="metric-label">TOTAL DEPLOYMENTS</span>
            <div className="metric-value">{stats.total ?? 0}</div>
            <span className="metric-sub">Across all projects</span>
          </div>

          <div className="metric-card highlight-green">
            <span className="metric-label">SUCCESSFUL</span>
            <div className="metric-value">{stats.successful ?? 0}</div>
            <span className="metric-sub">Deployed workloads</span>
          </div>

          <div className="metric-card highlight-blue">
            <span className="metric-label">CURRENTLY RUNNING</span>
            <div className="metric-value">{stats.running ?? 0}</div>
            <span className="metric-sub">Healthy containers</span>
          </div>

          <div className="metric-card highlight-red">
            <span className="metric-label">FAILED</span>
            <div className="metric-value">{stats.failed ?? 0}</div>
            <span className="metric-sub">Requires inspection</span>
          </div>
        </div>

        {/* ACTIVE DEPLOYMENTS SECTION */}
        <section className="dep-section">
          <div className="section-title-row">
            <div>
              <h2>Live Applications</h2>
              <p>Active and recent application deployments with public URLs</p>
            </div>
          </div>

          {loading && deployments.length === 0 ? (
            <div className="dep-empty-state">
              <div className="spinner" />
              <p>Loading application deployments...</p>
            </div>
          ) : deployments.length === 0 ? (
            <div className="dep-empty-state">
              <Server size={36} className="dep-empty-icon" />
              <h3>No deployments yet</h3>
              <p>
                Run a pipeline with <strong>Deployment Enabled</strong> to automatically build, push to ECR, and deploy your GitHub application on AWS ECS Fargate.
              </p>
              <Link to="/pipelines" className="btn btn-primary" style={{ marginTop: 12 }}>
                Go to Pipelines
              </Link>
            </div>
          ) : (
            <div className="live-cards-grid">
              {deployments.map((dep) => {
                const isDeployed =
                  (dep.status === "deployed" || dep.status === "running") && dep.app_url;

                return (
                  <div key={dep.id} className={`live-dep-card ${isDeployed ? "card-active" : ""}`}>
                    <div className="card-top-row">
                      <div className="card-title-group">
                        <span className="card-app-icon">
                          <Globe size={18} />
                        </span>
                        <div>
                          <h3 className="card-app-name">
                            {dep.app_name || "Application"}
                          </h3>
                          <span className="card-dep-id">{dep.deployment_id}</span>
                        </div>
                      </div>

                      <div className="card-badges">
                        <StatusBadge status={dep.status} />
                        <HealthBadge status={dep.health_status} />
                      </div>
                    </div>

                    <div className="card-meta-list">
                      <div className="card-meta-item">
                        <span className="meta-label">Repository</span>
                        <a
                          href={dep.repository_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="meta-val meta-link"
                        >
                          {dep.repository_url || "—"}
                        </a>
                      </div>

                      <div className="card-meta-row-duo">
                        <div className="card-meta-item">
                          <span className="meta-label">Platform</span>
                          <span className="meta-val">{dep.platform || "AWS ECS Fargate"}</span>
                        </div>
                        <div className="card-meta-item">
                          <span className="meta-label">Region</span>
                          <span className="meta-val">{dep.region || "ap-south-1"}</span>
                        </div>
                      </div>

                      <div className="card-meta-row-duo">
                        <div className="card-meta-item">
                          <span className="meta-label">Port</span>
                          <span className="meta-val">{dep.container_port || 5000}</span>
                        </div>
                        <div className="card-meta-item">
                          <span className="meta-label">Timestamp</span>
                          <span className="meta-val">
                            {formatDateTime(dep.created_at)}
                          </span>
                        </div>
                      </div>

                      {dep.image_uri && (
                        <div className="card-meta-item">
                          <span className="meta-label">Image URI</span>
                          <span className="meta-val code-val" title={dep.image_uri}>
                            {dep.image_uri.split("/").pop()}
                          </span>
                        </div>
                      )}

                      {dep.github_run_url && (
                        <div className="card-meta-item">
                          <span className="meta-label">GitHub Run</span>
                          <a
                            href={dep.github_run_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="meta-val meta-link"
                          >
                            #{dep.github_run_id || "Actions Run"} ↗
                          </a>
                        </div>
                      )}

                      {dep.error_message && (
                        <div className="card-error-box">
                          <AlertTriangle size={14} />
                          <span>{dep.error_message}</span>
                        </div>
                      )}
                    </div>

                    {/* LIVE URL BANNER */}
                    {dep.app_url ? (
                      <div className="live-url-box">
                        <div className="live-url-header">
                          <Radio size={14} className="live-dot" />
                          <span>Application is Live</span>
                        </div>
                        <div className="live-url-content">
                          <input
                            type="text"
                            readOnly
                            value={dep.app_url}
                            className="live-url-input"
                          />
                          <a
                            href={dep.app_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-live"
                          >
                            <ExternalLink size={15} />
                            <span>Open Live Application</span>
                          </a>
                        </div>
                      </div>
                    ) : dep.status === "failed" ? (
                      <div className="deploy-failed-notice">
                        <AlertTriangle size={16} className="deploy-failed-icon" />
                        <div className="deploy-failed-body">
                          <strong>Deployment Failed</strong>
                          <p>{dep.error_message || "Deployment failed — No live endpoint created."}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="deploy-pending-notice">
                        <div className="spinner-small" />
                        <span>{getStageProgressMessage(dep.status)}</span>
                      </div>
                    )}

                    {/* CARD FOOTER */}
                    <div className="card-footer">
                      {dep.project_id && (
                        <Link
                          to={`/projects/${dep.project_id}`}
                          className="card-footer-link"
                        >
                          View Project Details →
                        </Link>
                      )}

                      <div className="card-action-btns">
                        {dep.status === "stopped" && (
                          <button
                            type="button"
                            className="btn-action btn-action-start"
                            style={{ color: "#10b981", borderColor: "rgba(16, 185, 129, 0.4)" }}
                            onClick={() => handleStart(dep.deployment_id)}
                            disabled={actionLoading === dep.deployment_id}
                            title="Start ECS Application"
                          >
                            <Play size={14} />
                            <span>Start</span>
                          </button>
                        )}
                        {(dep.status === "deployed" || dep.status === "running") && (
                          <>
                            <button
                              type="button"
                              className="btn-action btn-action-restart"
                              onClick={() => handleRestart(dep.deployment_id)}
                              disabled={actionLoading === dep.deployment_id}
                              title="Restart ECS Task"
                            >
                              <RefreshCw size={14} />
                              <span>Restart</span>
                            </button>
                            <button
                              type="button"
                              className="btn-action btn-action-stop"
                              onClick={() => handleStop(dep.deployment_id)}
                              disabled={actionLoading === dep.deployment_id}
                              title="Stop Application"
                            >
                              <Power size={14} />
                              <span>Stop</span>
                            </button>
                          </>
                        )}
                        {dep.app_url && (
                          <button
                            type="button"
                            className="btn-action btn-action-health"
                            style={{ color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)" }}
                            onClick={() => handleCheckHealth(dep.deployment_id)}
                            disabled={actionLoading === dep.deployment_id}
                            title="Run live HTTP health check"
                          >
                            <CheckCircle2 size={14} />
                            <span>Health</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-action btn-action-del"
                          onClick={() => handleDelete(dep.deployment_id)}
                          disabled={actionLoading === dep.deployment_id}
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* DEPLOYMENT HISTORY TABLE */}
        <section className="dep-section table-section">
          <div className="section-title-row">
            <div>
              <h2>Deployment History</h2>
              <p>Complete historical log of all application rollouts</p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="dep-table">
              <thead>
                <tr>
                  <th>Deployment ID</th>
                  <th>Application</th>
                  <th>Status</th>
                  <th>Health Check</th>
                  <th>Platform</th>
                  <th>Live URL</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {deployments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="td-empty">
                      No deployments recorded.
                    </td>
                  </tr>
                ) : (
                  deployments.map((d) => (
                    <tr key={d.id}>
                      <td className="mono">{d.deployment_id}</td>
                      <td>
                        <strong>{d.app_name || "App"}</strong>
                      </td>
                      <td>
                        <StatusBadge status={d.status} />
                      </td>
                      <td>
                        <HealthBadge status={d.health_status} />
                      </td>
                      <td>{d.platform || "AWS ECS Fargate"}</td>
                      <td>
                        {d.app_url ? (
                          <a
                            href={d.app_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="table-live-link"
                          >
                            <ExternalLink size={13} />
                            <span>Open URL</span>
                          </a>
                        ) : (
                          <span className="td-dash">—</span>
                        )}
                      </td>
                      <td>
                        {formatDateTime(d.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
