import { useEffect, useMemo, useState } from "react";
import { getContainers, startContainer, stopContainer, restartContainer } from "../services/api";
import "./Containers.css";

function Containers() {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");

  async function loadContainers() {
    try {
      setLoading(true);
      setError("");

      const data = await getContainers();

      if (!data.success) {
        throw new Error(data.error || "Failed to load containers.");
      }

      setContainers(Array.isArray(data.containers) ? data.containers : []);
    } catch (err) {
      setError(err.message || "Failed to load containers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContainers();
  }, []);

  const runningCount = useMemo(
    () =>
      containers.filter(
        (container) =>
          String(container.state || "").toLowerCase() === "running"
      ).length,
    [containers]
  );

  const stoppedCount = useMemo(
    () =>
      containers.filter(
        (container) =>
          String(container.state || "").toLowerCase() !== "running"
      ).length,
    [containers]
  );

  const filteredContainers = useMemo(() => {
    if (filter === "ALL") {
      return containers;
    }

    if (filter === "RUNNING") {
      return containers.filter(
        (container) =>
          String(container.state || "").toLowerCase() === "running"
      );
    }

    return containers.filter(
      (container) =>
        String(container.state || "").toLowerCase() !== "running"
    );
  }, [containers, filter]);

  async function handleAction(container, action) {
    const id = container.id;

    try {
      setActionLoading(`${action}-${id}`);
      setError("");

      let response;

      if (action === "start") {
        response = await startContainer(id);
      } else if (action === "stop") {
        response = await stopContainer(id);
      } else {
        response = await restartContainer(id);
      }

      if (!response.success) {
        throw new Error(
          response.error || `Failed to ${action} container.`
        );
      }

      await loadContainers();
    } catch (err) {
      setError(err.message || `Failed to ${action} container.`);
    } finally {
      setActionLoading("");
    }
  }

  function getStateClass(state) {
    return String(state || "unknown").toLowerCase() === "running"
      ? "container-running"
      : "container-stopped";
  }

  function getStateLabel(state) {
    return String(state || "unknown").toLowerCase() === "running"
      ? "Running"
      : "Stopped";
  }

  return (
    <div className="containers-page">

      {/* HEADER */}
      <div className="containers-header">
        <div>
          <h1>Containers</h1>

          <p>
            Monitor and manage Docker containers running
            across your DevSecOps environment.
          </p>
        </div>

        <button
          className="container-refresh-button"
          onClick={loadContainers}
          disabled={loading}
        >
          ↻ {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="container-error">
          <span>⚠</span>
          <p>{error}</p>
        </div>
      )}

      {/* SUMMARY */}
      <div className="container-summary">

        <button
          className={`container-summary-card ${
            filter === "ALL" ? "active" : ""
          }`}
          onClick={() => setFilter("ALL")}
        >
          <span>Total Containers</span>
          <strong>{containers.length}</strong>
          <small>Docker containers</small>
        </button>

        <button
          className={`container-summary-card running ${
            filter === "RUNNING" ? "active" : ""
          }`}
          onClick={() => setFilter("RUNNING")}
        >
          <span>Running</span>
          <strong>{runningCount}</strong>
          <small>Active containers</small>
        </button>

        <button
          className={`container-summary-card stopped ${
            filter === "STOPPED" ? "active" : ""
          }`}
          onClick={() => setFilter("STOPPED")}
        >
          <span>Stopped</span>
          <strong>{stoppedCount}</strong>
          <small>Inactive containers</small>
        </button>

      </div>

      {/* CONTAINER PANEL */}
      <div className="containers-panel">

        <div className="containers-panel-header">
          <div>
            <h2>Docker Containers</h2>

            <p>
              {filteredContainers.length} container
              {filteredContainers.length === 1 ? "" : "s"} displayed
            </p>
          </div>

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="container-filter"
          >
            <option value="ALL">All Containers</option>
            <option value="RUNNING">Running</option>
            <option value="STOPPED">Stopped</option>
          </select>
        </div>

        {loading ? (
          <div className="container-loading">
            <div className="container-spinner"></div>
            <p>Loading Docker containers...</p>
          </div>
        ) : filteredContainers.length === 0 ? (
          <div className="container-empty">
            <div className="container-empty-icon">◫</div>

            <h3>No containers found</h3>

            <p>
              There are no Docker containers matching the
              selected filter.
            </p>
          </div>
        ) : (
          <div className="container-list">

            {filteredContainers.map((container) => {
              const running =
                String(container.state || "").toLowerCase() ===
                "running";

              return (
                <div
                  className="container-card"
                  key={container.id}
                >

                  {/* CARD HEADER */}
                  <div className="container-card-header">

                    <div className="container-title-area">

                      <div className="container-icon">
                        ◈
                      </div>

                      <div>
                        <h3>{container.name || "Unnamed Container"}</h3>

                        <span className="container-id">
                          ID: {container.id || "—"}
                        </span>
                      </div>

                    </div>

                    <span
                      className={`container-state ${getStateClass(
                        container.state
                      )}`}
                    >
                      <span className="state-dot"></span>
                      {getStateLabel(container.state)}
                    </span>

                  </div>

                  {/* DETAILS */}
                  <div className="container-details">

                    <div className="container-detail">
                      <span>IMAGE</span>
                      <strong>
                        {container.image || "Unknown"}
                      </strong>
                    </div>

                    <div className="container-detail">
                      <span>STATUS</span>
                      <strong>
                        {container.status || "Unknown"}
                      </strong>
                    </div>

                    <div className="container-detail">
                      <span>PORTS</span>
                      <strong>
                        {container.ports || "No published ports"}
                      </strong>
                    </div>

                    <div className="container-detail">
                      <span>CREATED</span>
                      <strong>
                        {container.created || "—"}
                      </strong>
                    </div>

                  </div>

                  {/* ACTIONS */}
                  <div className="container-actions">

                    {running ? (
                      <>
                        <button
                          className="container-action stop"
                          disabled={
                            actionLoading ===
                            `stop-${container.id}`
                          }
                          onClick={() =>
                            handleAction(container, "stop")
                          }
                        >
                          {actionLoading ===
                          `stop-${container.id}`
                            ? "Stopping..."
                            : "■ Stop"}
                        </button>

                        <button
                          className="container-action restart"
                          disabled={
                            actionLoading ===
                            `restart-${container.id}`
                          }
                          onClick={() =>
                            handleAction(container, "restart")
                          }
                        >
                          {actionLoading ===
                          `restart-${container.id}`
                            ? "Restarting..."
                            : "↻ Restart"}
                        </button>
                      </>
                    ) : (
                      <button
                        className="container-action start"
                        disabled={
                          actionLoading ===
                          `start-${container.id}`
                        }
                        onClick={() =>
                          handleAction(container, "start")
                        }
                      >
                        {actionLoading ===
                        `start-${container.id}`
                          ? "Starting..."
                          : "▶ Start"}
                      </button>
                    )}

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