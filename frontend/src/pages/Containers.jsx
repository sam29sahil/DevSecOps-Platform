import { useEffect, useState } from "react";

import {
  getContainers,
  getContainer,
  startContainer,
  stopContainer,
  restartContainer,
  removeContainer,
  getContainerLogs,
  getContainerStats,
} from "../services/api";

import "./Containers.css";

function Containers() {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [actionLoading, setActionLoading] = useState({});
  const [selectedContainer, setSelectedContainer] = useState(null);

  const [logs, setLogs] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [showLogs, setShowLogs] = useState(false);
  const [showStats, setShowStats] = useState(false);

  /* =========================================================
     LOAD CONTAINERS
  ========================================================= */

  async function loadContainers() {
    try {
      setLoading(true);
      setError("");

      const data = await getContainers();

      if (!data || data.success === false) {
        throw new Error(
          data?.error || "Failed to load Docker containers."
        );
      }

      setContainers(
        Array.isArray(data.containers)
          ? data.containers
          : []
      );
    } catch (err) {
      console.error("Container loading error:", err);

      setError(
        err.message ||
          "Failed to load Docker containers."
      );

      setContainers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContainers();
  }, []);

  /* =========================================================
     CONTAINER ACTION
  ========================================================= */

  async function getContainerDetails(containerId) {
    try {
      const data = await getContainer(containerId);

      if (!data || data.success === false) {
        throw new Error(
          data?.error ||
            "Failed to load container details."
        );
      }

      return data.container;
    } catch (err) {
      console.error(
        "Container details error:",
        err
      );

      setError(
        err.message ||
          "Failed to load container details."
      );

      return null;
    }
  }
  /* =========================================================
     GET CONTAINER DETAILS
  ========================================================= */

  async function getContainerDetails(
    containerId
  ) {
    try {
      const response = await fetch(
        `${API_BASE}/containers/${containerId}`
      );

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(
          data.error ||
            "Failed to load container details."
        );
      }

      return data.container;
    } catch (err) {
      console.error(
        "Container details error:",
        err
      );

      setError(
        err.message ||
          "Failed to load container details."
      );

      return null;
    }
  }

  /* =========================================================
     OPEN DETAILS
  ========================================================= */

  async function handleViewDetails(container) {
    const details = await getContainerDetails(
      container.id
    );

    if (details) {
      setSelectedContainer({
        ...container,
        ...details,
      });
    }
  }

  /* =========================================================
     LOGS
  ========================================================= */

  async function handleViewStats(container) {
    try {
      setSelectedContainer(container);
      setShowStats(true);
      setShowLogs(false);

      setStatsLoading(true);
      setStats(null);
      setError("");

      const data = await getContainerStats(
        container.id
      );

      if (!data || data.success === false) {
        throw new Error(
          data?.error ||
            "Failed to retrieve container statistics."
        );
      }

      setStats(data.stats || null);
    } catch (err) {
      console.error(
        "Container stats error:",
        err
      );

      setError(
        err.message ||
          "Failed to retrieve container statistics."
      );
    } finally {
      setStatsLoading(false);
    }
  }

  /* =========================================================
     STATS
  ========================================================= */

  async function handleViewStats(container) {
    try {
      setSelectedContainer(container);
      setShowStats(true);
      setShowLogs(false);
      setStatsLoading(true);
      setStats(null);
      setError("");

      const response = await fetch(
        `${API_BASE}/containers/${container.id}/stats`
      );

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(
          data.error ||
            "Failed to retrieve container statistics."
        );
      }

      setStats(data.stats || null);
    } catch (err) {
      console.error(
        "Container stats error:",
        err
      );

      setError(
        err.message ||
          "Failed to retrieve container statistics."
      );
    } finally {
      setStatsLoading(false);
    }
  }

  /* =========================================================
     CLOSE MODAL
  ========================================================= */

  function closeOverlay() {
    setShowLogs(false);
    setShowStats(false);
    setSelectedContainer(null);
    setLogs("");
    setStats(null);
  }

  /* =========================================================
     COUNTERS
  ========================================================= */

  const running = containers.filter(
    (container) =>
      String(container.state || "")
        .toLowerCase() === "running"
  ).length;

  const stopped =
    containers.length - running;

  const uniqueImages = new Set(
    containers
      .map((container) => container.image)
      .filter(Boolean)
  ).size;

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="containers-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="containers-page-header">

        <div className="containers-header-copy">

          <div className="section-label">
            CONTAINER SECURITY
          </div>

          <h1>Containers</h1>

          <p>
            Monitor and manage Docker containers
            running across your DevSecOps
            environment.
          </p>

        </div>

        <button
          type="button"
          className="containers-refresh-button"
          onClick={loadContainers}
          disabled={loading}
        >
          <span className="refresh-icon">
            ↻
          </span>

          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>

      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="containers-error">

          <div className="error-icon">
            !
          </div>

          <div className="error-content">
            <strong>
              Container operation failed
            </strong>

            <span>{error}</span>
          </div>

          <button
            type="button"
            onClick={() => setError("")}
            className="error-close"
          >
            ×
          </button>

        </div>
      )}

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="containers-summary">

        <div className="container-summary-card">

          <div className="summary-icon blue">
            ◇
          </div>

          <div className="summary-content">
            <span>Total Containers</span>

            <strong>
              {containers.length}
            </strong>

            <small>
              Docker containers
            </small>
          </div>

        </div>

        <div className="container-summary-card">

          <div className="summary-icon green">
            ✓
          </div>

          <div className="summary-content">
            <span>Running</span>

            <strong>
              {running}
            </strong>

            <small>
              Active containers
            </small>
          </div>

        </div>

        <div className="container-summary-card">

          <div className="summary-icon orange">
            ●
          </div>

          <div className="summary-content">
            <span>Stopped</span>

            <strong>
              {stopped}
            </strong>

            <small>
              Inactive containers
            </small>
          </div>

        </div>

        <div className="container-summary-card">

          <div className="summary-icon purple">
            ▣
          </div>

          <div className="summary-content">
            <span>Images</span>

            <strong>
              {uniqueImages}
            </strong>

            <small>
              Unique images
            </small>
          </div>

        </div>

      </div>

      {/* =====================================================
          MAIN PANEL
      ===================================================== */}

      <section className="containers-panel">

        <div className="containers-panel-header">

          <div>
            <div className="section-label">
              DOCKER ENVIRONMENT
            </div>

            <h2>
              Container Status
            </h2>

            <p>
              Live Docker runtime information
              from the local Docker Engine.
            </p>
          </div>

          <div className="container-count">
            {containers.length} container
            {containers.length === 1
              ? ""
              : "s"}
          </div>

        </div>

        {/* ===================================================
            LOADING
        =================================================== */}

        {loading ? (

          <div className="containers-loading">

            <div className="loading-spinner"></div>

            <span>
              Connecting to Docker Engine...
            </span>

          </div>

        ) : containers.length === 0 ? (

          /* =================================================
             EMPTY
          ================================================= */

          <div className="containers-empty">

            <div className="empty-container-icon">
              ◇
            </div>

            <h3>
              No containers found
            </h3>

            <p>
              Docker is available, but no
              containers were returned by the
              configured Docker environment.
            </p>

            <button
              type="button"
              className="containers-refresh-button"
              onClick={loadContainers}
            >
              ↻ Refresh
            </button>

          </div>

        ) : (

          /* =================================================
             CONTAINER LIST
          ================================================= */

          <div className="container-list">

            {containers.map((container) => {

              const isRunning =
                String(
                  container.state || ""
                ).toLowerCase() ===
                "running";

              const startKey =
                `${container.id}-start`;

              const stopKey =
                `${container.id}-stop`;

              const restartKey =
                `${container.id}-restart`;

              const starting =
                actionLoading[startKey] === true;

              const stopping =
                actionLoading[stopKey] === true;

              const restarting =
                actionLoading[
                  restartKey
                ] === true;

              const busy =
                starting ||
                stopping ||
                restarting;

              return (
                <article
                  className={`container-card ${
                    isRunning
                      ? "container-running"
                      : "container-stopped"
                  }`}
                  key={
                    container.id ||
                    container.name
                  }
                >

                  {/* CARD HEADER */}

                  <div className="container-card-top">

                    <div className="container-name-area">

                      <div
                        className={`container-icon ${
                          isRunning
                            ? "running"
                            : "stopped"
                        }`}
                      >
                        ◇
                      </div>

                      <div className="container-title-block">

                        <h3>
                          {container.name ||
                            "Unnamed Container"}
                        </h3>

                        <span className="container-id">
                          ID:{" "}
                          {container.id ||
                            "—"}
                        </span>

                      </div>

                    </div>

                    <div className="container-card-actions">

                      {/* START */}

                      {!isRunning && (
                        <button
                          type="button"
                          className="container-action-button start"
                          onClick={() =>
                            handleContainerAction(
                              container,
                              "start"
                            )
                          }
                          disabled={busy}
                        >
                          {starting
                            ? "Starting..."
                            : "▶ Start"}
                        </button>
                      )}

                      {/* STOP */}

                      {isRunning && (
                        <button
                          type="button"
                          className="container-action-button stop"
                          onClick={() =>
                            handleContainerAction(
                              container,
                              "stop"
                            )
                          }
                          disabled={busy}
                        >
                          {stopping
                            ? "Stopping..."
                            : "■ Stop"}
                        </button>
                      )}

                      {/* RESTART */}

                      <button
                        type="button"
                        className="container-action-button restart"
                        onClick={() =>
                          handleContainerAction(
                            container,
                            "restart"
                          )
                        }
                        disabled={busy}
                      >
                        {restarting
                          ? "Restarting..."
                          : "↻ Restart"}
                      </button>

                      {/* DETAILS */}

                      <button
                        type="button"
                        className="container-action-button details"
                        onClick={() =>
                          handleViewDetails(
                            container
                          )
                        }
                        disabled={busy}
                      >
                        View
                      </button>

                      {/* STATUS */}

                      <span
                        className={`container-status ${
                          isRunning
                            ? "status-running"
                            : "status-stopped"
                        }`}
                      >
                        <i></i>

                        {isRunning
                          ? "RUNNING"
                          : "STOPPED"}
                      </span>

                    </div>

                  </div>

                  {/* DETAILS */}

                  <div className="container-details">

                    <div className="container-detail">

                      <span>IMAGE</span>

                      <strong
                        title={
                          container.image ||
                          ""
                        }
                      >
                        {container.image ||
                          "Unknown"}
                      </strong>

                    </div>

                    <div className="container-detail">

                      <span>STATE</span>

                      <strong>
                        {container.state ||
                          "Unknown"}
                      </strong>

                    </div>

                    <div className="container-detail">

                      <span>STATUS</span>

                      <strong
                        title={
                          container.status ||
                          ""
                        }
                      >
                        {container.status ||
                          "—"}
                      </strong>

                    </div>

                    <div className="container-detail">

                      <span>PORTS</span>

                      <strong
                        title={
                          container.ports ||
                          ""
                        }
                      >
                        {container.ports ||
                          "None"}
                      </strong>

                    </div>

                  </div>

                  {/* COMMAND */}

                  <div className="container-command">

                    <div className="command-label">
                      COMMAND
                    </div>

                    <code
                      title={
                        container.command ||
                        ""
                      }
                    >
                      {container.command ||
                        "—"}
                    </code>

                  </div>

                  {/* QUICK TOOLS */}

                  <div className="container-tools">

                    <button
                      type="button"
                      className="container-tool-button"
                      onClick={() =>
                        handleViewLogs(
                          container
                        )
                      }
                    >
                      <span>≡</span>
                      Logs
                    </button>

                    <button
                      type="button"
                      className="container-tool-button"
                      onClick={() =>
                        handleViewStats(
                          container
                        )
                      }
                    >
                      <span>◫</span>
                      Stats
                    </button>

                  </div>

                  {/* FOOTER */}

                  <div className="container-footer">

                    <span>
                      Created{" "}
                      {container.created ||
                        "Unknown"}
                    </span>

                    <span
                      className={
                        isRunning
                          ? "health-good"
                          : "health-warning"
                      }
                    >
                      <i></i>

                      {isRunning
                        ? "Container active"
                        : "Container inactive"}
                    </span>

                  </div>

                </article>
              );
            })}

          </div>
        )}

      </section>

      {/* =====================================================
          LOGS MODAL
      ===================================================== */}

      {showLogs && selectedContainer && (
        <div
          className="container-overlay"
          onClick={closeOverlay}
        >

          <div
            className="container-modal logs-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>
                <span className="modal-label">
                  DOCKER LOGS
                </span>

                <h2>
                  {selectedContainer.name}
                </h2>

                <p>
                  Last 200 log lines
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeOverlay}
              >
                ×
              </button>

            </div>

            <div className="modal-body">

              {logsLoading ? (

                <div className="modal-loading">
                  <div className="loading-spinner"></div>
                  <span>
                    Reading container logs...
                  </span>
                </div>

              ) : (

                <pre className="logs-output">
                  {logs ||
                    "No logs were returned by Docker."}
                </pre>

              )}

            </div>

          </div>

        </div>
      )}

      {/* =====================================================
          STATS MODAL
      ===================================================== */}

      {showStats && selectedContainer && (
        <div
          className="container-overlay"
          onClick={closeOverlay}
        >

          <div
            className="container-modal stats-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>
                <span className="modal-label">
                  DOCKER RUNTIME
                </span>

                <h2>
                  {selectedContainer.name}
                </h2>

                <p>
                  Current container statistics
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeOverlay}
              >
                ×
              </button>

            </div>

            <div className="modal-body">

              {statsLoading ? (

                <div className="modal-loading">
                  <div className="loading-spinner"></div>
                  <span>
                    Reading container statistics...
                  </span>
                </div>

              ) : stats ? (

                <div className="stats-grid">

                  <div className="stat-box">
                    <span>CPU USAGE</span>
                    <strong>
                      {stats.cpu_percent ||
                        "—"}
                    </strong>
                  </div>

                  <div className="stat-box">
                    <span>MEMORY</span>
                    <strong>
                      {stats.memory_usage ||
                        "—"}
                    </strong>
                  </div>

                  <div className="stat-box">
                    <span>MEMORY %</span>
                    <strong>
                      {stats.memory_percent ||
                        "—"}
                    </strong>
                  </div>

                  <div className="stat-box">
                    <span>NETWORK I/O</span>
                    <strong>
                      {stats.network_io ||
                        "—"}
                    </strong>
                  </div>

                  <div className="stat-box">
                    <span>BLOCK I/O</span>
                    <strong>
                      {stats.block_io ||
                        "—"}
                    </strong>
                  </div>

                  <div className="stat-box">
                    <span>PIDS</span>
                    <strong>
                      {stats.pids ||
                        "—"}
                    </strong>
                  </div>

                </div>

              ) : (

                <div className="stats-empty">
                  Statistics unavailable.
                </div>

              )}

            </div>

          </div>

        </div>
      )}

      {/* =====================================================
          DETAILS MODAL
      ===================================================== */}

      {selectedContainer &&
        !showLogs &&
        !showStats && (
          <div
            className="container-overlay"
            onClick={() =>
              setSelectedContainer(null)
            }
          >

            <div
              className="container-modal details-modal"
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              <div className="modal-header">

                <div>
                  <span className="modal-label">
                    CONTAINER DETAILS
                  </span>

                  <h2>
                    {selectedContainer.Name ||
                      selectedContainer.name ||
                      "Container"}
                  </h2>

                  <p>
                    Docker inspect information
                  </p>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={() =>
                    setSelectedContainer(
                      null
                    )
                  }
                >
                  ×
                </button>

              </div>

              <div className="modal-body">

                <div className="details-modal-grid">

                  <div>
                    <span>NAME</span>
                    <strong>
                      {selectedContainer.Name ||
                        selectedContainer.name ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>IMAGE</span>
                    <strong>
                      {selectedContainer.Config
                        ?.Image ||
                        selectedContainer.image ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>STATUS</span>
                    <strong>
                      {selectedContainer.State
                        ?.Status ||
                        selectedContainer.state ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>CREATED</span>
                    <strong>
                      {selectedContainer.Created ||
                        selectedContainer.created ||
                        "—"}
                    </strong>
                  </div>

                </div>

                <div className="inspect-output">

                  <div className="command-label">
                    DOCKER INSPECT
                  </div>

                  <pre>
                    {JSON.stringify(
                      selectedContainer,
                      null,
                      2
                    )}
                  </pre>

                </div>

              </div>

            </div>

          </div>
        )}

    </div>
  );
}

export default Containers;