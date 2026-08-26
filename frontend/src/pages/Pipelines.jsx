import { useEffect, useState } from "react";
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

      setPipelines(
        Array.isArray(data.pipelines)
          ? data.pipelines
          : []
      );
    } catch (err) {
      console.error("Pipeline loading error:", err);

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
    return String(status || "pending")
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  return (
    <DashboardLayout>
      <div className="pipelines-page">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="page-header">
          <div>
            <div className="page-breadcrumb">
              DevSecOps <span>/</span> Pipelines
            </div>

            <h1>Pipelines</h1>

            <p>
              Manage and monitor your DevSecOps CI/CD
              pipelines.
            </p>
          </div>

          <button
            className="primary-button"
            type="button"
          >
            + New Pipeline
          </button>
        </div>

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="pipeline-summary">

          <div className="pipeline-summary-card">
            <span>Total Pipelines</span>

            <strong>
              {pipelines.length}
            </strong>

            <small>
              Configured pipelines
            </small>
          </div>

          <div className="pipeline-summary-card">
            <span>Successful</span>

            <strong>
              {
                pipelines.filter(
                  (pipeline) =>
                    ["success", "successful", "completed"]
                      .includes(
                        String(
                          pipeline.status || ""
                        ).toLowerCase()
                      )
                ).length
              }
            </strong>

            <small>
              Completed successfully
            </small>
          </div>

          <div className="pipeline-summary-card">
            <span>Running</span>

            <strong>
              {
                pipelines.filter(
                  (pipeline) =>
                    String(
                      pipeline.status || ""
                    ).toLowerCase() === "running"
                ).length
              }
            </strong>

            <small>
              Currently executing
            </small>
          </div>

          <div className="pipeline-summary-card">
            <span>Failed</span>

            <strong>
              {
                pipelines.filter(
                  (pipeline) =>
                    String(
                      pipeline.status || ""
                    ).toLowerCase() === "failed"
                ).length
              }
            </strong>

            <small>
              Require attention
            </small>
          </div>

        </div>

        {/* =================================================
            PIPELINES
        ================================================= */}

        <div className="content-card">

          <div className="card-header">
            <div>
              <h2>CI/CD Pipelines</h2>

              <p>
                Monitor pipeline executions and deployment
                activity.
              </p>
            </div>
          </div>

          {/* LOADING */}

          {loading && (
            <div className="empty-state">
              <div className="empty-state-icon">
                ⌁
              </div>

              <h3>
                Loading pipelines...
              </h3>

              <p>
                Fetching pipeline information.
              </p>
            </div>
          )}

          {/* ERROR */}

          {!loading && error && (
            <div className="empty-state">
              <div className="empty-state-icon">
                !
              </div>

              <h3>
                Unable to load pipelines
              </h3>

              <p>
                {error}
              </p>

              <button
                className="secondary-button"
                type="button"
                onClick={loadPipelines}
              >
                Retry
              </button>
            </div>
          )}

          {/* EMPTY */}

          {!loading &&
            !error &&
            pipelines.length === 0 && (
              <div className="empty-state">

                <div className="empty-state-icon">
                  ⚡
                </div>

                <h3>
                  No pipelines yet
                </h3>

                <p>
                  Connect a repository to start your
                  first DevSecOps pipeline.
                </p>

              </div>
            )}

          {/* PIPELINE LIST */}

          {!loading &&
            !error &&
            pipelines.length > 0 && (
              <div className="pipeline-list">

                {pipelines.map((pipeline, index) => (
                  <div
                    className="pipeline-card"
                    key={
                      pipeline.id || index
                    }
                  >

                    <div className="pipeline-main">

                      <div className="pipeline-icon">
                        ⌁
                      </div>

                      <div>
                        <h3>
                          {pipeline.name ||
                            pipeline.pipeline_name ||
                            `Pipeline #${
                              pipeline.id ||
                              index + 1
                            }`}
                        </h3>

                        <p>
                          {pipeline.description ||
                            "DevSecOps CI/CD pipeline"}
                        </p>
                      </div>

                    </div>

                    <div className="pipeline-meta">

                      <span
                        className={`pipeline-status ${getStatusClass(
                          pipeline.status
                        )}`}
                      >
                        {pipeline.status ||
                          "Pending"}
                      </span>

                      <span className="pipeline-branch">
                        {pipeline.branch ||
                          "main"}
                      </span>

                    </div>

                  </div>
                ))}

              </div>
            )}

        </div>

      </div>
    </DashboardLayout>
  );
}

export default Pipelines;