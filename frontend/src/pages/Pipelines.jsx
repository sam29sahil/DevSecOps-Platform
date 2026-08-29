import React, { useEffect, useMemo, useState } from "react";
import "./Pipelines.css";

import {
  getPipelines,
  getProjects,
  createPipeline,
  updatePipeline,
  deletePipeline as apiDeletePipeline,
  runPipeline as apiRunPipeline,
  getPipelineRuns,
} from "../services/api";

/* =========================================================
   STATUS
========================================================= */

const STATUS = {
  IDLE: "idle",
  RUNNING: "running",
  SUCCESS: "success",
  FAILED: "failed",
};

/* =========================================================
   DEFAULT FORM
========================================================= */

const DEFAULT_FORM = {
  name: "",
  description: "",
  repository_url: "",
  branch: "main",
  project_id: "",
  quality_gate_score: 70,
  fail_on_high: true,
  docker_enabled: true,
  registry_enabled: false,
  deployment_enabled: false,
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();

  if (
    value === "running" ||
    value === "success" ||
    value === "failed"
  ) {
    return value;
  }

  return "idle";
}

function formatDate(value) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function getRepository(pipeline) {
  return (
    pipeline?.repository_url ||
    pipeline?.repository ||
    ""
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status);

  const labels = {
    idle: "Idle",
    running: "Running",
    success: "Success",
    failed: "Failed",
  };

  return (
    <span className={`pipeline-status status-${normalized}`}>
      <span className="status-dot" />
      {labels[normalized]}
    </span>
  );
}

/* =========================================================
   STAGE
========================================================= */

function StageItem({ icon, title, enabled }) {
  return (
    <div className={`stage-item ${enabled ? "enabled" : "disabled"}`}>
      <span className="stage-icon">{icon}</span>

      <div className="stage-content">
        <strong>{title}</strong>
        <span>{enabled ? "Enabled" : "Disabled"}</span>
      </div>

      <span className={`stage-check ${enabled ? "on" : ""}`}>
        {enabled ? "✓" : "—"}
      </span>
    </div>
  );
}

/* =========================================================
   MAIN
========================================================= */

export default function Pipelines() {
  const [pipelines, setPipelines] = useState([]);
  const [projects, setProjects] = useState([]);

  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState(null);

  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);

  const [form, setForm] = useState({
    ...DEFAULT_FORM,
  });

  /* =========================================================
     LOAD PROJECTS
  ========================================================= */

  async function loadProjects() {
    try {
      setProjectsLoading(true);

      const data = await getProjects();

      if (!data?.success) {
        throw new Error(
          data?.error || "Failed to load projects."
        );
      }

      setProjects(
        Array.isArray(data.projects)
          ? data.projects
          : []
      );
    } catch (err) {
      console.error("Project loading error:", err);

      setError(
        err.message || "Failed to load projects."
      );
    } finally {
      setProjectsLoading(false);
    }
  }

  /* =========================================================
     LOAD PIPELINES
  ========================================================= */

  async function loadPipelines() {
    try {
      setLoading(true);
      setError("");

      const data = await getPipelines();

      if (!data?.success) {
        throw new Error(
          data?.error || "Failed to load pipelines."
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
    loadProjects();
  }, []);

  /* =========================================================
     OPEN CREATE
  ========================================================= */

  function openCreateModal() {
    setEditingPipeline(null);

    setForm({
      ...DEFAULT_FORM,
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  }

  /* =========================================================
     OPEN EDIT
  ========================================================= */

  function openEditModal(pipeline) {
    if (!pipeline) return;

    setEditingPipeline(pipeline);

    setForm({
      name: pipeline.name || "",
      description: pipeline.description || "",
      repository_url: getRepository(pipeline),
      branch: pipeline.branch || "main",

      project_id:
        pipeline.project_id !== null &&
        pipeline.project_id !== undefined
          ? String(pipeline.project_id)
          : "",

      quality_gate_score:
        pipeline.quality_gate_score ?? 70,

      fail_on_high:
        pipeline.fail_on_high !== undefined
          ? Boolean(pipeline.fail_on_high)
          : true,

      docker_enabled:
        pipeline.docker_enabled !== undefined
          ? Boolean(pipeline.docker_enabled)
          : true,

      registry_enabled:
        pipeline.registry_enabled !== undefined
          ? Boolean(pipeline.registry_enabled)
          : false,

      deployment_enabled:
        pipeline.deployment_enabled !== undefined
          ? Boolean(pipeline.deployment_enabled)
          : false,
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  }

  /* =========================================================
     CLOSE MODAL
  ========================================================= */

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingPipeline(null);

    setForm({
      ...DEFAULT_FORM,
    });
  }

  /* =========================================================
     FORM CHANGE
  ========================================================= */

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  }

  /* =========================================================
     SAVE / CREATE PIPELINE
  ========================================================= */

  async function savePipeline(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const name = form.name.trim();
    const repositoryUrl =
      form.repository_url.trim();

    if (!name) {
      setError("Pipeline name is required.");
      return;
    }

    if (!repositoryUrl) {
      setError("Repository URL is required.");
      return;
    }

    try {
      setSaving(true);

      /*
       * IMPORTANT:
       * Backend expects repository_url,
       * NOT repository.
       */

      const payload = {
        name,
        description: form.description.trim(),

        repository_url: repositoryUrl,

        branch:
          form.branch.trim() || "main",

        project_id: form.project_id
          ? Number(form.project_id)
          : null,

        quality_gate_score: Number(
          form.quality_gate_score
        ),

        fail_on_high:
          Boolean(form.fail_on_high),

        docker_enabled:
          Boolean(form.docker_enabled),

        registry_enabled:
          Boolean(form.registry_enabled),

        deployment_enabled:
          Boolean(form.deployment_enabled),
      };

      let response;

      if (editingPipeline?.id) {
        response = await updatePipeline(
          editingPipeline.id,
          payload
        );
      } else {
        response = await createPipeline(payload);
      }

      if (!response?.success) {
        throw new Error(
          response?.error ||
            "Unable to save pipeline."
        );
      }

      /*
       * Update local state immediately.
       */

      if (editingPipeline?.id) {
        const updated =
          response.pipeline;

        setPipelines((previous) =>
          previous.map((item) =>
            item.id === editingPipeline.id
              ? {
                  ...item,
                  ...(updated || payload),
                }
              : item
          )
        );

        setSuccess(
          response.message ||
            "Pipeline updated successfully."
        );
      } else {
        if (response.pipeline) {
          setPipelines((previous) => [
            ...previous,
            response.pipeline,
          ]);
        }

        setSuccess(
          response.message ||
            "Pipeline created successfully."
        );
      }

      setShowModal(false);
      setEditingPipeline(null);

      /*
       * Reload from backend so UI reflects
       * the actual saved object.
       */

      await loadPipelines();
    } catch (err) {
      console.error(
        "Pipeline save error:",
        err
      );

      setError(
        err.message ||
          "Unable to save pipeline."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     RUN PIPELINE
  ========================================================= */

  async function handleRunPipeline(pipeline) {
    if (!pipeline?.id) {
      setError("Pipeline ID is missing.");
      return;
    }

    setError("");
    setSuccess("");

    try {
      setRunningId(pipeline.id);

      /*
       * Show running immediately.
       */

      setPipelines((previous) =>
        previous.map((item) =>
          item.id === pipeline.id
            ? {
                ...item,
                status: STATUS.RUNNING,
              }
            : item
        )
      );

      const response =
        await apiRunPipeline(
          pipeline.id
        );

      if (!response?.success) {
        throw new Error(
          response?.error ||
            "Pipeline execution failed."
        );
      }

      const finalStatus =
        response.status ||
        response.pipeline?.status ||
        response.result ||
        STATUS.SUCCESS;

      /*
       * Update returned pipeline.
       */

      if (response.pipeline) {
        setPipelines((previous) =>
          previous.map((item) =>
            item.id === pipeline.id
              ? {
                  ...item,
                  ...response.pipeline,
                  status: finalStatus,
                }
              : item
          )
        );
      }

      setSuccess(
        response.message ||
          "Pipeline completed successfully."
      );

      /*
       * Refresh backend state.
       */

      await loadPipelines();

      /*
       * If this pipeline is currently selected,
       * refresh its run history.
       */

      if (
        selectedPipeline?.id ===
        pipeline.id
      ) {
        await loadRuns(pipeline.id);
      }
    } catch (err) {
      console.error(
        "Pipeline execution error:",
        err
      );

      setError(
        err.message ||
          "Pipeline execution failed."
      );

      setPipelines((previous) =>
        previous.map((item) =>
          item.id === pipeline.id
            ? {
                ...item,
                status: STATUS.FAILED,
              }
            : item
        )
      );
    } finally {
      setRunningId(null);
    }
  }

  /* =========================================================
     DELETE PIPELINE
  ========================================================= */

  async function handleDeletePipeline(pipeline) {
    if (!pipeline?.id) return;

    const confirmed =
      window.confirm(
        `Delete pipeline "${pipeline.name}"?`
      );

    if (!confirmed) return;

    try {
      setDeletingId(pipeline.id);
      setError("");
      setSuccess("");

      const response =
        await apiDeletePipeline(
          pipeline.id
        );

      if (!response?.success) {
        throw new Error(
          response?.error ||
            "Failed to delete pipeline."
        );
      }

      setPipelines((previous) =>
        previous.filter(
          (item) =>
            item.id !== pipeline.id
        )
      );

      if (
        selectedPipeline?.id ===
        pipeline.id
      ) {
        setSelectedPipeline(null);
        setRuns([]);
      }

      setSuccess(
        response.message ||
          "Pipeline deleted successfully."
      );

      await loadPipelines();
    } catch (err) {
      console.error(
        "Pipeline deletion error:",
        err
      );

      setError(
        err.message ||
          "Failed to delete pipeline."
      );
    } finally {
      setDeletingId(null);
    }
  }

  /* =========================================================
     LOAD RUN HISTORY
  ========================================================= */

  async function loadRuns(pipelineId) {
    if (!pipelineId) return;

    try {
      setRunsLoading(true);

      const response =
        await getPipelineRuns(
          pipelineId
        );

      if (!response?.success) {
        throw new Error(
          response?.error ||
            "Failed to load pipeline runs."
        );
      }

      setRuns(
        Array.isArray(response.runs)
          ? response.runs
          : []
      );
    } catch (err) {
      console.error(
        "Run history error:",
        err
      );

      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }

  /* =========================================================
     SELECT PIPELINE
  ========================================================= */

  async function selectPipeline(pipeline) {
    setSelectedPipeline(pipeline);
    await loadRuns(pipeline.id);
  }

  /* =========================================================
     STATISTICS
  ========================================================= */

  const stats = useMemo(() => {
    const total = pipelines.length;

    const running =
      pipelines.filter(
        (pipeline) =>
          normalizeStatus(
            pipeline.status
          ) === STATUS.RUNNING
      ).length;

    const successful =
      pipelines.filter(
        (pipeline) =>
          normalizeStatus(
            pipeline.status
          ) === STATUS.SUCCESS
      ).length;

    const failed =
      pipelines.filter(
        (pipeline) =>
          normalizeStatus(
            pipeline.status
          ) === STATUS.FAILED
      ).length;

    return {
      total,
      running,
      successful,
      failed,
    };
  }, [pipelines]);

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="pipelines-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="pipelines-header">
        <div>
          <div className="page-eyebrow">
            CI / CD
          </div>

          <h1>Pipeline Management</h1>

          <p>
            Configure, execute and monitor
            your DevSecOps pipelines.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateModal}
        >
          <span>＋</span>
          Create Pipeline
        </button>
      </div>

      {/* =====================================================
          ALERTS
      ===================================================== */}

      {error && (
        <div className="pipeline-alert error">
          <span>!</span>
          <div>
            <strong>Error</strong>
            <p>{error}</p>
          </div>

          <button
            type="button"
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="pipeline-alert success">
          <span>✓</span>

          <div>
            <strong>Success</strong>
            <p>{success}</p>
          </div>

          <button
            type="button"
            onClick={() =>
              setSuccess("")
            }
          >
            ×
          </button>
        </div>
      )}

      {/* =====================================================
          STATS
      ===================================================== */}

      <div className="pipeline-stats">

        <div className="stat-card">
          <span className="stat-label">
            TOTAL PIPELINES
          </span>

          <strong>{stats.total}</strong>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            RUNNING
          </span>

          <strong>{stats.running}</strong>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            SUCCESSFUL
          </span>

          <strong>{stats.successful}</strong>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            FAILED
          </span>

          <strong>{stats.failed}</strong>
        </div>

      </div>

      {/* =====================================================
          PIPELINES
      ===================================================== */}

      <section className="pipeline-section">

        <div className="section-header">
          <div>
            <h2>Your Pipelines</h2>

            <p>
              {pipelines.length} pipeline
              {pipelines.length === 1
                ? ""
                : "s"} configured
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadPipelines}
            disabled={loading}
          >
            {loading
              ? "Refreshing..."
              : "↻ Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="loading-spinner" />
            <p>Loading pipelines...</p>
          </div>
        ) : pipelines.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              ⟐
            </div>

            <h3>No pipelines yet</h3>

            <p>
              Create your first CI/CD pipeline
              to start automated security
              scanning.
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateModal}
            >
              Create Pipeline
            </button>
          </div>
        ) : (
          <div className="pipeline-grid">

            {pipelines.map((pipeline) => {
              const status =
                normalizeStatus(
                  pipeline.status
                );

              const isRunning =
                runningId ===
                pipeline.id;

              return (
                <article
                  className={`pipeline-card ${
                    selectedPipeline?.id ===
                    pipeline.id
                      ? "selected"
                      : ""
                  }`}
                  key={pipeline.id}
                  onClick={() =>
                    selectPipeline(
                      pipeline
                    )
                  }
                >

                  <div className="pipeline-card-top">

                    <div className="pipeline-title">
                      <div className="pipeline-logo">
                        ⛓
                      </div>

                      <div>
                        <h3>
                          {pipeline.name}
                        </h3>

                        <span className="pipeline-id">
                          Pipeline #
                          {pipeline.id}
                        </span>
                      </div>
                    </div>

                    <StatusBadge
                      status={status}
                    />

                  </div>

                  <p className="pipeline-description">
                    {pipeline.description ||
                      "No description provided."}
                  </p>

                  <div className="pipeline-meta">

                    <div>
                      <span>Repository</span>

                      <strong
                        title={getRepository(
                          pipeline
                        )}
                      >
                        {getRepository(
                          pipeline
                        ) || "Not configured"}
                      </strong>
                    </div>

                    <div>
                      <span>Branch</span>

                      <strong>
                        {pipeline.branch ||
                          "main"}
                      </strong>
                    </div>

                  </div>

                  <div className="pipeline-divider" />

                  <div className="pipeline-info-row">

                    <div>
                      <span>
                        Last Run
                      </span>

                      <strong>
                        {formatDate(
                          pipeline.last_run
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Files Scanned
                      </span>

                      <strong>
                        {pipeline.last_files_scanned ??
                          0}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Findings
                      </span>

                      <strong>
                        {pipeline.last_findings ??
                          0}
                      </strong>
                    </div>

                  </div>

                  <div className="pipeline-stages">

                    <StageItem
                      icon="⇩"
                      title="Checkout"
                      enabled
                    />

                    <StageItem
                      icon="⚙"
                      title="Security Scan"
                      enabled
                    />

                    <StageItem
                      icon="◇"
                      title="Docker"
                      enabled={
                        pipeline.docker_enabled !==
                        false
                      }
                    />

                    <StageItem
                      icon="⇧"
                      title="Deploy"
                      enabled={
                        pipeline.deployment_enabled ===
                        true
                      }
                    />

                  </div>

                  <div
                    className="pipeline-actions"
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                  >

                    <button
                      type="button"
                      className="btn btn-run"
                      disabled={
                        isRunning ||
                        runningId !== null
                      }
                      onClick={() =>
                        handleRunPipeline(
                          pipeline
                        )
                      }
                    >
                      {isRunning
                        ? "Running..."
                        : "▶ Run"}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() =>
                        openEditModal(
                          pipeline
                        )
                      }
                    >
                      ✎ Edit
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={
                        deletingId ===
                        pipeline.id
                      }
                      onClick={() =>
                        handleDeletePipeline(
                          pipeline
                        )
                      }
                    >
                      {deletingId ===
                      pipeline.id
                        ? "..."
                        : "Delete"}
                    </button>

                  </div>

                </article>
              );
            })}

          </div>
        )}

      </section>

      {/* =====================================================
          RUN HISTORY
      ===================================================== */}

      {selectedPipeline && (
        <section className="pipeline-section run-history-section">

          <div className="section-header">
            <div>
              <h2>
                Run History
              </h2>

              <p>
                {selectedPipeline.name}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                loadRuns(
                  selectedPipeline.id
                )
              }
            >
              ↻ Refresh
            </button>
          </div>

          {runsLoading ? (
            <div className="history-loading">
              Loading run history...
            </div>
          ) : runs.length === 0 ? (
            <div className="history-empty">
              No pipeline runs found.
            </div>
          ) : (
            <div className="runs-table-wrapper">

              <table className="runs-table">

                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Scan</th>
                    <th>Findings</th>
                  </tr>
                </thead>

                <tbody>

                  {runs.map((run) => (
                    <tr key={run.id}>

                      <td>
                        #{run.id}
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            run.status
                          }
                        />
                      </td>

                      <td>
                        {formatDate(
                          run.started_at ||
                            run.created_at
                        )}
                      </td>

                      <td>
                        {run.scan_id ??
                          "—"}
                      </td>

                      <td>
                        {run.findings ??
                          run.last_findings ??
                          0}
                      </td>

                    </tr>
                  ))}

                </tbody>

              </table>

            </div>
          )}

        </section>
      )}

      {/* =====================================================
          CREATE / EDIT MODAL
      ===================================================== */}

      {showModal && (
        <div
          className="pipeline-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >

          <div
            className="pipeline-modal"
            role="dialog"
            aria-modal="true"
          >

            <div className="modal-header">

              <div>
                <span className="modal-eyebrow">
                  CI / CD PIPELINE
                </span>

                <h2>
                  {editingPipeline
                    ? "Edit Pipeline"
                    : "Create Pipeline"}
                </h2>

                <p>
                  Configure your repository,
                  security checks and deployment.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>

            </div>

            <form
              className="pipeline-form"
              onSubmit={savePipeline}
            >

              {/* BASIC INFORMATION */}

              <div className="form-section">

                <h3>
                  Basic Information
                </h3>

                <div className="form-grid">

                  <div className="form-field full">
                    <label>
                      Pipeline Name
                    </label>

                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="My Production Pipeline"
                      required
                    />
                  </div>

                  <div className="form-field full">
                    <label>
                      Description
                    </label>

                    <textarea
                      name="description"
                      value={
                        form.description
                      }
                      onChange={handleChange}
                      placeholder="Describe what this pipeline does..."
                      rows="3"
                    />
                  </div>

                </div>

              </div>

              {/* REPOSITORY */}

              <div className="form-section">

                <h3>
                  Repository
                </h3>

                <div className="form-grid">

                  <div className="form-field full">
                    <label>
                      Repository URL
                    </label>

                    <input
                      type="url"
                      name="repository_url"
                      value={
                        form.repository_url
                      }
                      onChange={handleChange}
                      placeholder="https://github.com/user/project.git"
                      required
                    />

                    <small>
                      Git repository used by
                      the pipeline.
                    </small>
                  </div>

                  <div className="form-field">

                    <label>
                      Branch
                    </label>

                    <input
                      type="text"
                      name="branch"
                      value={form.branch}
                      onChange={handleChange}
                      placeholder="main"
                    />

                  </div>

                  <div className="form-field">

                    <label>
                      Project
                    </label>

                    <select
                      name="project_id"
                      value={
                        form.project_id
                      }
                      onChange={handleChange}
                      disabled={
                        projectsLoading
                      }
                    >

                      <option value="">
                        No project
                      </option>

                      {projects.map(
                        (project) => (
                          <option
                            key={
                              project.id
                            }
                            value={
                              project.id
                            }
                          >
                            {project.name}
                          </option>
                        )
                      )}

                    </select>

                  </div>

                </div>

              </div>

              {/* SECURITY */}

              <div className="form-section">

                <h3>
                  Security Policy
                </h3>

                <div className="form-grid">

                  <div className="form-field">

                    <label>
                      Quality Gate Score
                    </label>

                    <input
                      type="number"
                      name="quality_gate_score"
                      value={
                        form.quality_gate_score
                      }
                      onChange={handleChange}
                      min="0"
                      max="100"
                    />

                    <small>
                      Pipeline passes when the
                      security score meets this
                      threshold.
                    </small>

                  </div>

                  <label className="switch-field">

                    <input
                      type="checkbox"
                      name="fail_on_high"
                      checked={
                        form.fail_on_high
                      }
                      onChange={handleChange}
                    />

                    <span className="switch" />

                    <span>
                      <strong>
                        Fail on High
                      </strong>
                      <small>
                        Stop pipeline when
                        high severity findings
                        exist.
                      </small>
                    </span>

                  </label>

                </div>

              </div>

              {/* PIPELINE OPTIONS */}

              <div className="form-section">

                <h3>
                  Pipeline Options
                </h3>

                <div className="option-grid">

                  <label className="option-card">

                    <input
                      type="checkbox"
                      name="docker_enabled"
                      checked={
                        form.docker_enabled
                      }
                      onChange={handleChange}
                    />

                    <div>
                      <strong>
                        Docker Build
                      </strong>

                      <span>
                        Build the application
                        container.
                      </span>
                    </div>

                  </label>

                  <label className="option-card">

                    <input
                      type="checkbox"
                      name="registry_enabled"
                      checked={
                        form.registry_enabled
                      }
                      onChange={handleChange}
                    />

                    <div>
                      <strong>
                        Container Registry
                      </strong>

                      <span>
                        Push the image to a
                        configured registry.
                      </span>
                    </div>

                  </label>

                  <label className="option-card">

                    <input
                      type="checkbox"
                      name="deployment_enabled"
                      checked={
                        form.deployment_enabled
                      }
                      onChange={handleChange}
                    />

                    <div>
                      <strong>
                        Automatic Deployment
                      </strong>

                      <span>
                        Deploy after a successful
                        pipeline.
                      </span>
                    </div>

                  </label>

                </div>

              </div>

              {/* ERROR */}

              {error && (
                <div className="modal-error">
                  {error}
                </div>
              )}

              {/* FOOTER */}

              <div className="modal-footer">

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary save-button"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="button-spinner" />
                      Saving...
                    </>
                  ) : editingPipeline ? (
                    <>
                      ✓ Save Changes
                    </>
                  ) : (
                    <>
                      ＋ Create Pipeline
                    </>
                  )}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}