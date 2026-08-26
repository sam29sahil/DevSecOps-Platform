import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  getPipelines,
  createPipeline,
} from "../services/api";

function Pipelines() {
  const [pipelines, setPipelines] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    repository_url: "",
    branch: "main",
    project_id: "",
  });

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

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm({
      name: "",
      description: "",
      repository_url: "",
      branch: "main",
      project_id: "",
    });
  }

  async function handleCreatePipeline(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Pipeline name is required.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        repository_url: form.repository_url.trim(),
        branch: form.branch.trim() || "main",
      };

      if (form.project_id.trim()) {
        payload.project_id = Number(form.project_id);
      }

      const data = await createPipeline(payload);

      if (!data.success) {
        throw new Error(
          data.error || "Failed to create pipeline."
        );
      }

      resetForm();
      setShowCreateForm(false);

      await loadPipelines();
    } catch (err) {
      console.error("Create pipeline error:", err);

      setError(
        err.message || "Failed to create pipeline."
      );
    } finally {
      setCreating(false);
    }
  }

  function getStatusClass(status) {
    return String(status || "pending")
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  const successfulCount = pipelines.filter((pipeline) =>
    ["success", "successful", "completed"].includes(
      String(pipeline.status || "").toLowerCase()
    )
  ).length;

  const runningCount = pipelines.filter(
    (pipeline) =>
      String(pipeline.status || "").toLowerCase() ===
      "running"
  ).length;

  const failedCount = pipelines.filter(
    (pipeline) =>
      String(pipeline.status || "").toLowerCase() ===
      "failed"
  ).length;

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
            onClick={() => {
              setError("");
              setShowCreateForm(true);
            }}
          >
            + New Pipeline
          </button>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="pipeline-error">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>
        )}

        {/* =================================================
            CREATE PIPELINE
        ================================================= */}

        {showCreateForm && (
          <div className="content-card pipeline-create-card">

            <div className="card-header">
              <div>
                <h2>Create Pipeline</h2>

                <p>
                  Configure a new CI/CD pipeline.
                </p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                  setError("");
                }}
              >
                ×
              </button>
            </div>

            <form
              className="pipeline-form"
              onSubmit={handleCreatePipeline}
            >

              <div className="form-grid">

                {/* NAME */}

                <div className="form-group">
                  <label htmlFor="pipeline-name">
                    Pipeline Name
                  </label>

                  <input
                    id="pipeline-name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Production CI/CD"
                    required
                  />
                </div>

                {/* PROJECT ID */}

                <div className="form-group">
                  <label htmlFor="pipeline-project">
                    Project ID
                  </label>

                  <input
                    id="pipeline-project"
                    name="project_id"
                    type="number"
                    min="1"
                    value={form.project_id}
                    onChange={handleChange}
                    placeholder="1"
                  />
                </div>

                {/* REPOSITORY */}

                <div className="form-group form-group-full">
                  <label htmlFor="pipeline-repository">
                    Repository URL
                  </label>

                  <input
                    id="pipeline-repository"
                    name="repository_url"
                    type="url"
                    value={form.repository_url}
                    onChange={handleChange}
                    placeholder="https://github.com/username/repository"
                  />
                </div>

                {/* BRANCH */}

                <div className="form-group">
                  <label htmlFor="pipeline-branch">
                    Branch
                  </label>

                  <input
                    id="pipeline-branch"
                    name="branch"
                    type="text"
                    value={form.branch}
                    onChange={handleChange}
                    placeholder="main"
                  />
                </div>

                {/* DESCRIPTION */}

                <div className="form-group form-group-full">
                  <label htmlFor="pipeline-description">
                    Description
                  </label>

                  <textarea
                    id="pipeline-description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe what this pipeline does..."
                    rows="4"
                  />
                </div>

              </div>

              <div className="pipeline-form-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                    setError("");
                  }}
                  disabled={creating}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={creating}
                >
                  {creating
                    ? "Creating..."
                    : "Create Pipeline"}
                </button>

              </div>

            </form>
          </div>
        )}

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="pipeline-summary">

          <div className="pipeline-summary-card">
            <span>Total Pipelines</span>

            <strong>{pipelines.length}</strong>

            <small>
              Configured pipelines
            </small>
          </div>

          <div className="pipeline-summary-card">
            <span>Successful</span>

            <strong>{successfulCount}</strong>

            <small>
              Completed successfully
            </small>
          </div>

          <div className="pipeline-summary-card">
            <span>Running</span>

            <strong>{runningCount}</strong>

            <small>
              Currently executing
            </small>
          </div>

          <div className="pipeline-summary-card">
            <span>Failed</span>

            <strong>{failedCount}</strong>

            <small>
              Require attention
            </small>
          </div>

        </div>

        {/* =================================================
            PIPELINES LIST
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
                  Create your first DevSecOps CI/CD
                  pipeline to get started.
                </p>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setError("");
                    setShowCreateForm(true);
                  }}
                >
                  Create Pipeline
                </button>

              </div>
            )}

          {/* PIPELINE LIST */}

          {!loading &&
            !error &&
            pipelines.length > 0 && (
              <div className="pipeline-list">

                {pipelines.map((pipeline) => (
                  <div
                    className="pipeline-card"
                    key={pipeline.id}
                  >

                    <div className="pipeline-main">

                      <div className="pipeline-icon">
                        ⌁
                      </div>

                      <div>
                        <h3>
                          {pipeline.name ||
                            `Pipeline #${pipeline.id}`}
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
                          "pending"}
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