import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import { getScans } from "../services/api";

function ScanHistory() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadScans() {
    try {
      setLoading(true);
      setError("");

      const data = await getScans();

      if (!data.success) {
        throw new Error(
          data.error || "Failed to load scan history."
        );
      }

      setScans(data.scans || []);
    } catch (err) {
      console.error("Scan history error:", err);
      setError(
        err.message || "Failed to load scan history."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadScans();
  }, []);

  function getStatusClass(status) {
    return `scan-status scan-${String(
      status || "unknown"
    ).toLowerCase()}`;
  }

  function formatDate(date) {
    if (!date) {
      return "Date unavailable";
    }

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleString();
  }

  return (
    <DashboardLayout>
      <div className="scan-history-page">

        {/* PAGE HEADER */}

        <div className="page-header">
          <div>
            <h1>Scan History</h1>

            <p>
              View and manage previous security
              assessments.
            </p>
          </div>

          <Link
            to="/dashboard"
            className="secondary-button"
          >
            ← Dashboard
          </Link>
        </div>

        {/* ERROR */}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* LOADING */}

        {loading ? (
          <div className="dashboard-panel">
            <div className="loading-state">
              Loading scan history...
            </div>
          </div>
        ) : scans.length === 0 ? (

          /* EMPTY */

          <div className="dashboard-panel">
            <div className="empty-state">

              <div className="empty-icon">
                ✓
              </div>

              <h3>No security scans yet</h3>

              <p>
                Run a security scan to start building
                your security assessment history.
              </p>

              <Link
                to="/dashboard"
                className="primary-button"
              >
                + New Security Scan
              </Link>

            </div>
          </div>

        ) : (

          /* SCANS */

          <div className="dashboard-panel">

            <div className="section-header">
              <div>
                <h2>Security Assessments</h2>

                <p>
                  {scans.length}{" "}
                  {scans.length === 1
                    ? "scan"
                    : "scans"}{" "}
                  recorded.
                </p>
              </div>
            </div>

            <div className="scan-history-list">

              {scans.map((scan) => (
                <div
                  className="scan-history-row"
                  key={scan.id}
                >

                  {/* SCAN ID */}

                  <div className="scan-history-main">

                    <strong>
                      #{scan.id}
                    </strong>

                    <div>
                      <h3>
                        {scan.project_name ||
                          scan.project?.name ||
                          "Security Scan"}
                      </h3>

                      <span>
                        {scan.description ||
                          "Security assessment"}
                      </span>
                    </div>

                  </div>

                  {/* STATUS */}

                  <div className="scan-history-status">

                    <span
                      className={getStatusClass(
                        scan.status
                      )}
                    >
                      {scan.status || "unknown"}
                    </span>

                  </div>

                  {/* SCORE */}

                  <div className="scan-history-score">

                    <span>Score</span>

                    <strong>
                      {scan.security_score ??
                        scan.score ??
                        "—"}
                      {scan.security_score != null ||
                      scan.score != null
                        ? "%"
                        : ""}
                    </strong>

                  </div>

                  {/* FINDINGS */}

                  <div className="scan-history-findings">

                    <span>Findings</span>

                    <strong>
                      {scan.total_findings ??
                        scan.findings_count ??
                        0}
                    </strong>

                  </div>

                  {/* DATE */}

                  <div className="scan-history-date">

                    <span>
                      {formatDate(
                        scan.completed_at ||
                          scan.started_at ||
                          scan.created_at
                      )}
                    </span>

                  </div>

                  {/* ACTION */}

                  <Link
                    to={`/scans/${scan.id}`}
                    className="secondary-button"
                  >
                    View
                  </Link>

                </div>
              ))}

            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

export default ScanHistory;