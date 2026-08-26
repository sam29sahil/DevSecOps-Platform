import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import DashboardLayout from "../components/DashboardLayout";
import { getScans } from "../services/api";

import "./ScanHistory.css";

function ScanHistory() {
  const navigate = useNavigate();

  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadScans = useCallback(async (showRefresh = false) => {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await getScans();

      const scanList = Array.isArray(response?.scans)
        ? response.scans
        : [];

      setScans(scanList);
    } catch (err) {
      console.error("Failed to load scan history:", err);
      setError(err.message || "Unable to load scan history.");
      setScans([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadScans();
  }, [loadScans]);

  const filteredScans = useMemo(() => {
    const query = search.trim().toLowerCase();

    return scans.filter((scan) => {
      const status = String(scan.status || "").toLowerCase();

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter.toLowerCase();

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        scan.id,
        scan.project_id,
        scan.project_name,
        scan.status,
        scan.security_score,
        scan.total_findings,
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        );
    });
  }, [scans, search, statusFilter]);

  const statistics = useMemo(() => {
    const completed = scans.filter(
      (scan) =>
        String(scan.status || "").toLowerCase() === "completed"
    ).length;

    const failed = scans.filter(
      (scan) =>
        String(scan.status || "").toLowerCase() === "failed"
    ).length;

    const running = scans.filter((scan) =>
      ["running", "pending", "queued"].includes(
        String(scan.status || "").toLowerCase()
      )
    ).length;

    const findings = scans.reduce(
      (total, scan) =>
        total + Number(scan.total_findings || 0),
      0
    );

    return {
      total: scans.length,
      completed,
      failed,
      running,
      findings,
    };
  }, [scans]);

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getStatusIcon(status) {
    const normalized = String(status || "").toLowerCase();

    if (normalized === "completed") {
      return <CheckCircle2 size={17} />;
    }

    if (normalized === "failed") {
      return <XCircle size={17} />;
    }

    if (
      normalized === "running" ||
      normalized === "pending" ||
      normalized === "queued"
    ) {
      return <Clock3 size={17} />;
    }

    return <AlertCircle size={17} />;
  }

  function getStatusClass(status) {
    const normalized = String(status || "unknown").toLowerCase();

    if (normalized === "completed") {
      return "status-completed";
    }

    if (normalized === "failed") {
      return "status-failed";
    }

    if (
      normalized === "running" ||
      normalized === "pending" ||
      normalized === "queued"
    ) {
      return "status-running";
    }

    return "status-unknown";
  }

  function getScoreClass(score) {
    const value = Number(score);

    if (Number.isNaN(value)) {
      return "score-neutral";
    }

    if (value >= 80) {
      return "score-good";
    }

    if (value >= 60) {
      return "score-medium";
    }

    return "score-danger";
  }

  function openScan(scanId) {
    navigate(`/scans/${scanId}`);
  }

  return (
    <DashboardLayout>
      <div className="scan-history-page">
        {/* =====================================================
            PAGE HEADER
        ====================================================== */}

        <div className="scan-history-header">
          <div>
            <div className="page-kicker">
              SECURITY OPERATIONS
            </div>

            <h1>Scan History</h1>

            <p>
              Review previous security assessments and scan results.
            </p>
          </div>

          <button
            type="button"
            className="refresh-button"
            onClick={() => loadScans(true)}
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
              className={refreshing ? "spin" : ""}
            />

            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* =====================================================
            ERROR
        ====================================================== */}

        {error && (
          <div className="scan-history-error">
            <AlertCircle size={19} />

            <div>
              <strong>Unable to load scan history</strong>
              <span>{error}</span>
            </div>

            <button
              type="button"
              onClick={() => loadScans()}
            >
              Retry
            </button>
          </div>
        )}

        {/* =====================================================
            STATISTICS
        ====================================================== */}

        <div className="scan-history-stats">
          <div className="history-stat-card">
            <div className="history-stat-icon blue">
              <ShieldAlert size={20} />
            </div>

            <div>
              <span>Total Scans</span>
              <strong>{statistics.total}</strong>
            </div>
          </div>

          <div className="history-stat-card">
            <div className="history-stat-icon green">
              <CheckCircle2 size={20} />
            </div>

            <div>
              <span>Completed</span>
              <strong>{statistics.completed}</strong>
            </div>
          </div>

          <div className="history-stat-card">
            <div className="history-stat-icon yellow">
              <Clock3 size={20} />
            </div>

            <div>
              <span>Running</span>
              <strong>{statistics.running}</strong>
            </div>
          </div>

          <div className="history-stat-card">
            <div className="history-stat-icon red">
              <AlertCircle size={20} />
            </div>

            <div>
              <span>Findings</span>
              <strong>{statistics.findings}</strong>
            </div>
          </div>
        </div>

        {/* =====================================================
            FILTER BAR
        ====================================================== */}

        <div className="scan-history-toolbar">
          <div className="history-search">
            <Search size={18} />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search scans..."
            />
          </div>

          <div className="history-filter">
            <label htmlFor="scan-status-filter">
              Status
            </label>

            <select
              id="scan-status-filter"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="running">Running</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* =====================================================
            TABLE
        ====================================================== */}

        <div className="scan-history-card">
          <div className="scan-history-card-header">
            <div>
              <h2>Security Assessments</h2>

              <p>
                {filteredScans.length}{" "}
                {filteredScans.length === 1
                  ? "scan"
                  : "scans"}{" "}
                shown
              </p>
            </div>

            <div className="scan-count-badge">
              {scans.length}
            </div>
          </div>

          {loading ? (
            <div className="history-loading">
              <div className="loading-spinner"></div>
              <span>Loading scan history...</span>
            </div>
          ) : filteredScans.length === 0 ? (
            <div className="history-empty">
              <div className="empty-icon">
                <ShieldAlert size={28} />
              </div>

              <h3>No scans found</h3>

              <p>
                {scans.length === 0
                  ? "Run a security scan from a project to see results here."
                  : "No scans match your current search or filter."}
              </p>

              {scans.length === 0 && (
                <button
                  type="button"
                  onClick={() => navigate("/projects")}
                >
                  Go to Projects
                </button>
              )}
            </div>
          ) : (
            <div className="scan-table-wrapper">
              <table className="scan-history-table">
                <thead>
                  <tr>
                    <th>Scan</th>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Files</th>
                    <th>Findings</th>
                    <th>Security Score</th>
                    <th>Started</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredScans.map((scan) => {
                    const score =
                      scan.security_score !== null &&
                      scan.security_score !== undefined
                        ? Number(scan.security_score)
                        : null;

                    return (
                      <tr key={scan.id}>
                        <td>
                          <div className="scan-id">
                            <span className="scan-id-icon">
                              <ShieldAlert size={16} />
                            </span>

                            <div>
                              <strong>
                                Scan #{scan.id}
                              </strong>

                              <span>
                                Project #{scan.project_id}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="project-cell">
                            {scan.project_name ||
                              `Project #${scan.project_id}`}
                          </div>
                        </td>

                        <td>
                          <span
                            className={`scan-status ${getStatusClass(
                              scan.status
                            )}`}
                          >
                            {getStatusIcon(scan.status)}

                            <span>
                              {scan.status || "Unknown"}
                            </span>
                          </span>
                        </td>

                        <td>
                          <span className="table-number">
                            {scan.files_scanned ?? 0}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              Number(scan.total_findings || 0) > 0
                                ? "findings-warning"
                                : "findings-clean"
                            }
                          >
                            {scan.total_findings ?? 0}
                          </span>
                        </td>

                        <td>
                          {score !== null ? (
                            <div
                              className={`score-value ${getScoreClass(
                                score
                              )}`}
                            >
                              <strong>{score}</strong>
                              <span>/100</span>
                            </div>
                          ) : (
                            <span className="not-available">
                              —
                            </span>
                          )}
                        </td>

                        <td>
                          <span className="date-cell">
                            {formatDate(
                              scan.started_at ||
                                scan.created_at
                            )}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="view-scan-button"
                            onClick={() =>
                              openScan(scan.id)
                            }
                            title="View scan details"
                          >
                            <Eye size={17} />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default ScanHistory;