import { useEffect, useState } from "react";
import { getContainers } from "../services/api";
import "./Containers.css";

function Containers() {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState({});

  async function loadContainers() {
    try {
      setLoading(true);
      setError("");

      const data = await getContainers();

      setContainers(data.containers || []);
    } catch (err) {
      setError(err.message || "Failed to load containers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContainers();
  }, []);

  /*
   * Start / Stop container
   *
   * The backend endpoints are called directly here so the
   * existing getContainers() API remains untouched.
   */
  async function handleContainerAction(container, action) {
    const containerId = container.id;

    if (!containerId) {
      setError("Container ID is missing.");
      return;
    }

    const key = `${containerId}-${action}`;

    try {
      setActionLoading((prev) => ({
        ...prev,
        [key]: true,
      }));

      setError("");

      const response = await fetch(
        `http://127.0.0.1:5000/api/containers/${containerId}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(
          data.message ||
            data.error ||
            `Failed to ${action} container.`
        );
      }

      /*
       * Reload container information after the action so
       * state/status/ports are immediately updated.
       */
      await loadContainers();
    } catch (err) {
      setError(
        err.message ||
          `Failed to ${action} container.`
      );
    } finally {
      setActionLoading((prev) => ({
        ...prev,
        [key]: false,
      }));
    }
  }

  const running = containers.filter(
    (container) =>
      String(container.state || "").toLowerCase() === "running"
  ).length;

  const stopped = containers.filter(
    (container) =>
      String(container.state || "").toLowerCase() !== "running"
  ).length;

  const uniqueImages = new Set(
    containers
      .map((container) => container.image)
      .filter(Boolean)
  ).size;

  return (
    <div className="containers-page">

      {/* PAGE HEADER */}
      <div className="containers-page-header">
        <div>
          <div className="section-label">
            CONTAINER SECURITY
          </div>

          <h1>Containers</h1>

          <p>
            Monitor Docker containers and their current
            runtime status across your DevSecOps environment.
          </p>
        </div>

        <button
          className="containers-refresh-button"
          onClick={loadContainers}
          disabled={loading}
        >
          ↻ {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="containers-error">
          <strong>Unable to process container</strong>
          <span>{error}</span>
        </div>
      )}

      {/* SUMMARY */}
      <div className="containers-summary">

        <div className="container-summary-card">
          <div className="summary-icon blue">
            ◇
          </div>

          <div>
            <span>Total Containers</span>
            <strong>{containers.length}</strong>
            <small>Docker containers</small>
          </div>
        </div>

        <div className="container-summary-card">
          <div className="summary-icon green">
            ✓
          </div>

          <div>
            <span>Running</span>
            <strong>{running}</strong>
            <small>Active containers</small>
          </div>
        </div>

        <div className="container-summary-card">
          <div className="summary-icon orange">
            ●
          </div>

          <div>
            <span>Stopped</span>
            <strong>{stopped}</strong>
            <small>Inactive containers</small>
          </div>
        </div>

        <div className="container-summary-card">
          <div className="summary-icon purple">
            ▣
          </div>

          <div>
            <span>Images</span>
            <strong>{uniqueImages}</strong>
            <small>Unique images</small>
          </div>
        </div>

      </div>

      {/* CONTAINER LIST */}
      <div className="containers-panel">

        <div className="containers-panel-header">
          <div>
            <div className="section-label">
              DOCKER ENVIRONMENT
            </div>

            <h2>Container Status</h2>

            <p>
              Current Docker container runtime information.
            </p>
          </div>

          <div className="container-count">
            {containers.length} container
            {containers.length === 1 ? "" : "s"}
          </div>
        </div>

        {loading ? (
          <div className="containers-loading">
            <div className="loading-spinner"></div>
            <span>Loading containers...</span>
          </div>
        ) : containers.length === 0 ? (
          <div className="containers-empty">
            <div className="empty-container-icon">
              ◇
            </div>

            <h3>No containers found</h3>

            <p>
              No Docker containers are currently available
              on the configured Docker environment.
            </p>

            <button
              className="containers-refresh-button"
              onClick={loadContainers}
            >
              ↻ Refresh
            </button>
          </div>
        ) : (
          <div className="container-list">

            {containers.map((container) => {

              const isRunning =
                String(container.state || "").toLowerCase() ===
                "running";

              const startKey = `${container.id}-start`;
              const stopKey = `${container.id}-stop`;

              const starting =
                actionLoading[startKey] === true;

              const stopping =
                actionLoading[stopKey] === true;

              return (
                <div
                  className="container-card"
                  key={container.id || container.name}
                >

                  {/* TOP */}
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

                      <div>
                        <h3>
                          {container.name ||
                            "Unnamed Container"}
                        </h3>

                        <span className="container-id">
                          ID: {container.id || "—"}
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
                          disabled={
                            starting ||
                            stopping
                          }
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
                          disabled={
                            starting ||
                            stopping
                          }
                        >
                          {stopping
                            ? "Stopping..."
                            : "■ Stop"}
                        </button>
                      )}

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

                      <strong>
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

                      <strong>
                        {container.status || "—"}
                      </strong>
                    </div>

                    <div className="container-detail">
                      <span>PORTS</span>

                      <strong>
                        {container.ports || "None"}
                      </strong>
                    </div>

                  </div>

                  {/* COMMAND */}
                  <div className="container-command">

                    <div className="command-label">
                      COMMAND
                    </div>

                    <code>
                      {container.command || "—"}
                    </code>

                  </div>

                  {/* CREATED */}
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

                </div>
              );
            })}

          </div>
        )}

      </div>

    </div>
  );
}

export default Containers;