import { useEffect, useMemo, useState } from "react";
import {
  getPipelines,
  createPipeline,
  deletePipeline,
  runPipeline,
} from "../services/api";

function Pipelines() {
  const [pipelines, setPipelines] = useState([]);

  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    repository_url: "",
    branch: "main",
    project_id: "4",
  });

  const [lastRunFindings, setLastRunFindings] = useState([]);
  const [lastRunPipeline, setLastRunPipeline] = useState(null);
  const [lastRunScan, setLastRunScan] = useState(null);

  /* ========================================================
     LOAD PIPELINES
  ======================================================== */

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

  /* ========================================================
     CREATE PIPELINE
  ======================================================== */

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleCreatePipeline(event) {
    event.preventDefault();

    try {
      setError("");
      setSuccess("");

      if (!form.name.trim()) {
        setError("Pipeline name is required.");
        return;
      }

      if (!form.repository_url.trim()) {
        setError("Repository URL is required.");
        return;
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        repository_url: form.repository_url.trim(),
        branch: form.branch.trim() || "main",
        project_id: form.project_id
          ? Number(form.project_id)
          : null,
      };

      const data = await createPipeline(payload);

      if (!data.success) {
        throw new Error(
          data.error || "Failed to create pipeline."
        );
      }

      setSuccess(
        data.message ||
          "Pipeline created successfully."
      );

      setForm({
        name: "",
        description: "",
        repository_url: "",
        branch: "main",
        project_id: "4",
      });

      setShowCreateForm(false);

      await loadPipelines();
    } catch (err) {
      setError(
        err.message || "Failed to create pipeline."
      );
    }
  }

  /* ========================================================
     RUN PIPELINE
  ======================================================== */

  async function handleRunPipeline(pipelineId) {
    try {
      setRunningId(pipelineId);
      setError("");
      setSuccess("");

      setLastRunFindings([]);
      setLastRunPipeline(null);
      setLastRunScan(null);

      const data = await runPipeline(pipelineId);

      if (!data.success) {
        throw new Error(
          data.error || "Pipeline execution failed."
        );
      }

      setLastRunPipeline(data.pipeline || null);
      setLastRunScan(data.scan || null);
      setLastRunFindings(
        Array.isArray(data.findings)
          ? data.findings
          : []
      );

      setSuccess(
        data.message ||
          "Pipeline completed successfully."
      );

      await loadPipelines();
    } catch (err) {
      setError(
        err.message || "Failed to run pipeline."
      );
    } finally {
      setRunningId(null);
    }
  }

  /* ========================================================
     DELETE PIPELINE
  ======================================================== */

  async function handleDeletePipeline(pipelineId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this pipeline?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(pipelineId);
      setError("");
      setSuccess("");

      const data = await deletePipeline(
        pipelineId
      );

      if (!data.success) {
        throw new Error(
          data.error || "Failed to delete pipeline."
        );
      }

      setSuccess(
        data.message ||
          "Pipeline deleted successfully."
      );

      await loadPipelines();
    } catch (err) {
      setError(
        err.message || "Failed to delete pipeline."
      );
    } finally {
      setDeletingId(null);
    }
  }

  /* ========================================================
     STATISTICS
  ======================================================== */

  const statistics = useMemo(() => {
    const total = pipelines.length;

    const successful = pipelines.filter(
      (pipeline) =>
        ["success", "successful", "completed"].includes(
          String(pipeline.status || "").toLowerCase()
        )
    ).length;

    const running = pipelines.filter(
      (pipeline) =>
        String(pipeline.status || "").toLowerCase() ===
        "running"
    ).length;

    const failed = pipelines.filter(
      (pipeline) =>
        ["failed", "failure", "error"].includes(
          String(pipeline.status || "").toLowerCase()
        )
    ).length;

    const pending = pipelines.filter(
      (pipeline) =>
        ["pending", "queued"].includes(
          String(pipeline.status || "").toLowerCase()
        )
    ).length;

    return {
      total,
      successful,
      running,
      failed,
      pending,
    };
  }, [pipelines]);

  /* ========================================================
     STATUS CLASS
  ======================================================== */

  function getStatusClass(status) {
    const value = String(
      status || "pending"
    ).toLowerCase();

    if (
      value === "success" ||
      value === "successful" ||
      value === "completed"
    ) {
      return "pipeline-status success";
    }

    if (value === "running") {
      return "pipeline-status running";
    }

    if (
      value === "failed" ||
      value === "failure" ||
      value === "error"
    ) {
      return "pipeline-status failed";
    }

    return "pipeline-status pending";
  }

  /* ========================================================
     RENDER
  ======================================================== */

  return (
    <div className="pipelines-page">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="page-header">

        <div>
          <h1>CI/CD Pipelines</h1>

          <p>
            Automate security scanning and monitor
            DevSecOps pipeline execution.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          <button
            className="secondary-button"
            onClick={loadPipelines}
            disabled={loading}
          >
            ↻ Refresh
          </button>

          <button
            className="primary-button"
            onClick={() =>
              setShowCreateForm(
                (previous) => !previous
              )
            }
          >
            + Create Pipeline
          </button>
        </div>

      </div>

      {/* ====================================================
          MESSAGES
      ==================================================== */}

      {error && (
        <div className="error-message">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div
          className="success-message"
          style={{
            marginBottom: "20px",
          }}
        >
          {success}
        </div>
      )}

      {/* ====================================================
          CREATE FORM
      ==================================================== */}

      {showCreateForm && (
        <div
          className="dashboard-panel"
          style={{
            marginBottom: "24px",
          }}
        >
          <h2>Create Security Pipeline</h2>

          <p>
            Configure a repository that should be scanned
            by the DevSecOps security engine.
          </p>

          <form
            onSubmit={handleCreatePipeline}
            style={{
              marginTop: "20px",
            }}
          >

            <div className="form-grid">

              <div className="form-group">
                <label>
                  Pipeline Name
                </label>

                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="Security Scan Pipeline"
                />
              </div>

              <div className="form-group">
                <label>
                  Branch
                </label>

                <input
                  type="text"
                  name="branch"
                  value={form.branch}
                  onChange={handleFormChange}
                  placeholder="main"
                />
              </div>

              <div
                className="form-group"
                style={{
                  gridColumn:
                    "1 / -1",
                }}
              >
                <label>
                  Repository URL
                </label>

                <input
                  type="url"
                  name="repository_url"
                  value={
                    form.repository_url
                  }
                  onChange={handleFormChange}
                  placeholder="https://github.com/user/project.git"
                />
              </div>

              <div className="form-group">
                <label>
                  Project ID
                </label>

                <input
                  type="number"
                  name="project_id"
                  value={form.project_id}
                  onChange={handleFormChange}
                  placeholder="4"
                />
              </div>

              <div className="form-group">
                <label>
                  Description
                </label>

                <input
                  type="text"
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Automated security scanning pipeline"
                />
              </div>

            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <button
                type="submit"
                className="primary-button"
              >
                Create Pipeline
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setShowCreateForm(false)
                }
              >
                Cancel
              </button>
            </div>

          </form>
        </div>
      )}

      {/* ====================================================
          SUMMARY
      ==================================================== */}

      <div className="pipeline-summary">

        <div className="pipeline-summary-card">
          <span>Total Pipelines</span>
          <strong>
            {statistics.total}
          </strong>
          <small>
            Configured pipelines
          </small>
        </div>

        <div className="pipeline-summary-card">
          <span>Successful</span>
          <strong>
            {statistics.successful}
          </strong>
          <small>
            Completed successfully
          </small>
        </div>

        <div className="pipeline-summary-card">
          <span>Running</span>
          <strong>
            {statistics.running}
          </strong>
          <small>
            Currently executing
          </small>
        </div>

        <div className="pipeline-summary-card">
          <span>Failed</span>
          <strong>
            {statistics.failed}
          </strong>
          <small>
            Require attention
          </small>
        </div>

        <div className="pipeline-summary-card">
          <span>Pending</span>
          <strong>
            {statistics.pending}
          </strong>
          <small>
            Waiting to run
          </small>
        </div>

      </div>

      {/* ====================================================
          LAST PIPELINE RESULT
      ==================================================== */}

      {lastRunPipeline && (
        <div
          className="dashboard-panel"
          style={{
            marginTop: "24px",
          }}
        >

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "20px",
            }}
          >

            <div>
              <h2>
                Latest Pipeline Result
              </h2>

              <p>
                {lastRunPipeline.name}
              </p>
            </div>

            <span
              className={getStatusClass(
                lastRunPipeline.status
              )}
            >
              {lastRunPipeline.status}
            </span>

          </div>

          {lastRunScan && (
            <div className="pipeline-stats-grid">

              <div className="details-card">
                <span>
                  Security Score
                </span>

                <strong>
                  {lastRunScan.security_score ?? 0}%
                </strong>
              </div>

              <div className="details-card">
                <span>
                  Files Scanned
                </span>

                <strong>
                  {lastRunScan.files_scanned ?? 0}
                </strong>
              </div>

              <div className="details-card">
                <span>
                  Findings
                </span>

                <strong>
                  {lastRunScan.total_findings ??
                    lastRunFindings.length}
                </strong>
              </div>

              <div className="details-card">
                <span>
                  Scan Status
                </span>

                <strong>
                  {lastRunScan.status}
                </strong>
              </div>

            </div>
          )}

          {/* FINDINGS */}

          {lastRunFindings.length > 0 && (
            <div
              style={{
                marginTop: "24px",
              }}
            >

              <h3>
                Findings From This Run
              </h3>

              <div
                className="vulnerability-list"
                style={{
                  marginTop: "15px",
                }}
              >

                {lastRunFindings.map(
                  (finding) => (
                    <div
                      className="vulnerability-card"
                      key={finding.id}
                    >

                      <div className="vulnerability-header">

                        <div>
                          <span
                            className={`severity-badge severity-${String(
                              finding.severity ||
                                "LOW"
                            ).toLowerCase()}`}
                          >
                            {finding.severity}
                          </span>

                          <h3>
                            {finding.title}
                          </h3>
                        </div>

                        <span className="rule-id">
                          {finding.rule_id}
                        </span>

                      </div>

                      <p className="vulnerability-description">
                        {finding.description}
                      </p>

                      <div className="vulnerability-details">

                        <div>
                          <span>
                            File
                          </span>

                          <strong>
                            {finding.file_path ||
                              "Unknown"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Line
                          </span>

                          <strong>
                            {finding.line_number ??
                              "—"}
                          </strong>
                        </div>

                      </div>

                      {finding.evidence && (
                        <div className="finding-section">

                          <span>
                            Evidence
                          </span>

                          <code>
                            {finding.evidence}
                          </code>

                        </div>
                      )}

                      {finding.recommendation && (
                        <div className="finding-section">

                          <span>
                            Recommendation
                          </span>

                          <p>
                            {finding.recommendation}
                          </p>

                        </div>
                      )}

                    </div>
                  )
                )}

              </div>

            </div>
          )}

          {lastRunFindings.length === 0 && (
            <div
              style={{
                marginTop: "20px",
              }}
            >
              ✓ No security findings were
              detected in this pipeline run.
            </div>
          )}

        </div>
      )}

      {/* ====================================================
          PIPELINE LIST
      ==================================================== */}

      <div
        className="dashboard-panel"
        style={{
          marginTop: "24px",
        }}
      >

        <div
          className="panel-header"
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
          }}
        >

          <div>
            <h2>
              Pipelines
            </h2>

            <p>
              {pipelines.length} configured pipeline
              {pipelines.length === 1
                ? ""
                : "s"}
            </p>
          </div>

        </div>

        {loading ? (
          <div className="loading-state">
            Loading pipelines...
          </div>
        ) : pipelines.length === 0 ? (
          <div className="empty-state">

            <h2>
              No pipelines yet
            </h2>

            <p>
              Create your first security pipeline
              to automate repository scanning.
            </p>

            <button
              className="primary-button"
              onClick={() =>
                setShowCreateForm(true)
              }
            >
              + Create Pipeline
            </button>

          </div>
        ) : (
          <div className="pipeline-list">

            {pipelines.map((pipeline) => (
              <div
                className="pipeline-card"
                key={pipeline.id}
              >

                <div className="pipeline-main">

                  <div className="pipeline-icon">
                    ⚙
                  </div>

                  <div>

                    <h3>
                      {pipeline.name}
                    </h3>

                    <p>
                      {pipeline.description ||
                        "Security scanning pipeline"}
                    </p>

                  </div>

                </div>

                <div className="pipeline-meta">

                  <div>
                    <span>
                      Repository
                    </span>

                    <strong>
                      {pipeline.repository_url ||
                        "Not configured"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Branch
                    </span>

                    <strong>
                      {pipeline.branch ||
                        "main"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Project
                    </span>

                    <strong>
                      {pipeline.project_id ??
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Last Run
                    </span>

                    <strong>
                      {pipeline.last_run
                        ? new Date(
                            pipeline.last_run
                          ).toLocaleString()
                        : "Never"}
                    </strong>
                  </div>

                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >

                  <span
                    className={getStatusClass(
                      pipeline.status
                    )}
                  >
                    {pipeline.status}
                  </span>

                  {pipeline.last_security_score !=
                    null && (
                    <span className="pipeline-branch">
                      Score:{" "}
                      {pipeline.last_security_score}%
                    </span>
                  )}

                  {pipeline.last_files_scanned !=
                    null && (
                    <span className="pipeline-branch">
                      Files:{" "}
                      {pipeline.last_files_scanned}
                    </span>
                  )}

                  {pipeline.last_findings !=
                    null && (
                    <span className="pipeline-branch">
                      Findings:{" "}
                      {pipeline.last_findings}
                    </span>
                  )}

                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "16px",
                  }}
                >

                  <button
                    className="primary-button"
                    onClick={() =>
                      handleRunPipeline(
                        pipeline.id
                      )
                    }
                    disabled={
                      runningId ===
                      pipeline.id
                    }
                  >
                    {runningId ===
                    pipeline.id
                      ? "Scanning..."
                      : "▶ Run Security Scan"}
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() =>
                      handleDeletePipeline(
                        pipeline.id
                      )
                    }
                    disabled={
                      deletingId ===
                      pipeline.id
                    }
                  >
                    {deletingId ===
                    pipeline.id
                      ? "Deleting..."
                      : "Delete"}
                  </button>

                </div>

              </div>
            ))}

          </div>
        )}

      </div>

    </div>
  );
}

export default Pipelines;