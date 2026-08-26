import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import { getPipelines } from "../services/api";

function Pipelines() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPipelines() {
    try {
      setLoading(true);
      setError("");

      const data = await getPipelines();

      if (!data.success) {
        throw new Error(
          data.error || "Failed to load pipelines."
        );
      }

      setPipelines(data.pipelines || []);
    } catch (err) {
      console.error("Pipelines error:", err);
      setError(
        err.message || "Failed to load pipelines."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPipelines();
  }, []);

  function getStatusClass(status) {
    return `pipeline-status pipeline-${String(
      status || "unknown"
    ).toLowerCase()}`;
  }

  function formatDate(date) {
    if (!date) {
      return "Date unavailable";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Date unavailable";
    }

    return parsedDate.toLocaleString();
  }

  return (
    <DashboardLayout>
      <div className="pipelines-page">

        {/* PAGE HEADER */}
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              DevSecOps <span>/</span> Pipelines
            </div>

            <h1>Pipelines</h1>

            <p>
              Monitor CI/CD pipelines, security stages,
              builds and deployment activity.
            </p>
          </div>

          <button
            className="primary-button"
            onClick={loadPipelines}
          >
            ↻ Refresh Pipelines
          </button>
        </div>

        {/* SUMMARY */}
        <div className="pipeline-stats-grid">

          <div className="details-card">
            <span>Total Pipelines</span>
            <strong>{pipelines.length}</strong>
            <small>Configured pipelines</small>
          </div>

          <div className="details-card">
            <span>Running</span>
            <strong>
              {
                pipelines.filter(
                  (pipeline) =>
                    String(pipeline.status).toLowerCase() ===
                    "running"
                ).length
              }
            </strong>
            <small>Currently running</small>
          </div>

          <div className="details-card">
            <span>Successful</span>
            <strong>
              {
                pipelines.filter(
                  (pipeline) =>
                    ["success", "successful", "completed"].includes(
                      String(pipeline.status).toLowerCase()
                    )
                ).length
              }
            </strong>
            <small>Successful runs</small>
          </div>

          <div className="details-card">
            <span>Failed</span>
            <strong>
              {
                pipelines.filter(
                  (pipeline) =>
                    ["failed", "failure", "error"].includes(
                      String(pipeline.status).toLowerCase()
                    )
                ).length
              }
            </strong>
            <small>Failed runs</small>
          </div>

        </div>

        {/* PIPELINES */}
        <div className="dashboard-panel">

          <div className="section-header">
            <div>
              <h2>Pipeline Activity</h2>

              <p>
                Recent CI/CD and DevSecOps pipeline executions.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              Loading pipelines...
            </div>
          ) : error ? (
            <div className="pipeline-error">
              <strong>Unable to load pipelines</strong>

              <p>{error}</p>

              <button
                className="secondary-button"
                onClick={loadPipelines}
              >
                Try Again
              </button>
            </div>
          ) : pipelines.length === 0 ? (
            <div className="empty-state">

              <div className="empty-icon">
                ⚡
              </div>

              <h3>No pipelines yet</h3>

              <p>
                Connect a project repository to create
                your first DevSecOps pipeline.
              </p>

              <Link
                to="/projects"
                className="primary-button"
              >
                View Projects
              </Link>

            </div>
          ) : (
            <div className="pipeline-list">

              {pipelines.map((pipeline) => (
                <div
                  className="pipeline-row"
                  key={pipeline.id}
                >

                  <div className="pipeline-main">

                    <div className="pipeline-icon">
                      ⚡
                    </div>

                    <div>
                      <strong>
                        {pipeline.name ||
                          `Pipeline #${pipeline.id}`}
                      </strong>

                      <span>
                        {pipeline.project_name ||
                          pipeline.project?.name ||
                          "Project unavailable"}
                      </span>
                    </div>

                  </div>

                  <div className="pipeline-meta">

                    <div>
                      <span>Branch</span>
                      <strong>
                        {pipeline.branch || "main"}
                      </strong>
                    </div>

                    <div>
                      <span>Last Run</span>
                      <strong>
                        {formatDate(
                          pipeline.updated_at ||
                            pipeline.completed_at ||
                            pipeline.started_at
                        )}
                      </strong>
                    </div>

                    <span
                      className={getStatusClass(
                        pipeline.status
                      )}
                    >
                      {pipeline.status || "unknown"}
                    </span>

                    {pipeline.id && (
                      <Link
                        to={`/pipelines/${pipeline.id}`}
                        className="secondary-button"
                      >
                        View
                      </Link>
                    )}

                  </div>

                </div>
              ))}

            </div>
          )}

        </div>

        {/* DEVSECOPS PIPELINE FLOW */}
        <div className="dashboard-panel">

          <div className="section-header">
            <div>
              <h2>DevSecOps Pipeline</h2>

              <p>
                Security controls integrated throughout
                the software delivery lifecycle.
              </p>
            </div>
          </div>

          <div className="pipeline-flow">

            <div className="pipeline-stage">
              <div className="pipeline-stage-icon">
                01
              </div>

              <strong>Source</strong>

              <span>
                Repository
              </span>
            </div>

            <div className="pipeline-connector">
              →
            </div>

            <div className="pipeline-stage">
              <div className="pipeline-stage-icon">
                02
              </div>

              <strong>Build</strong>

              <span>
                Application
              </span>
            </div>

            <div className="pipeline-connector">
              →
            </div>

            <div className="pipeline-stage">
              <div className="pipeline-stage-icon">
                03
              </div>

              <strong>Security</strong>

              <span>
                SAST / Scan
              </span>
            </div>

            <div className="pipeline-connector">
              →
            </div>

            <div className="pipeline-stage">
              <div className="pipeline-stage-icon">
                04
              </div>

              <strong>Container</strong>

              <span>
                Image Scan
              </span>
            </div>

            <div className="pipeline-connector">
              →
            </div>

            <div className="pipeline-stage">
              <div className="pipeline-stage-icon">
                05
              </div>

              <strong>Deploy</strong>

              <span>
                Production
              </span>
            </div>

          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}

export default Pipelines;