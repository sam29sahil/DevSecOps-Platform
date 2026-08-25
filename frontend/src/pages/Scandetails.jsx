import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getScan } from "../services/api";

function ScanDetails() {
  const { scanId } = useParams();

  const [scan, setScan] = useState(null);
  const [findings, setFindings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadScan() {
    try {
      setLoading(true);
      setError("");

      const data = await getScan(scanId);

      if (!data.success) {
        throw new Error(data.error || "Failed to load scan.");
      }

      setScan(data.scan);
      setFindings(data.findings || []);
    } catch (err) {
      setError(err.message || "Failed to load scan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadScan();
  }, [scanId]);

  function severityClass(severity) {
    return `severity-${String(severity || "LOW").toLowerCase()}`;
  }

  if (loading) {
    return (
      <div className="scan-details-page">
        <div className="loading-state">
          Loading scan...
        </div>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="scan-details-page">
        <div className="error-message">
          {error || "Scan not found."}
        </div>

        <Link
          to="/projects"
          className="secondary-button"
        >
          ← Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="scan-details-page">

      {/* HEADER */}

      <div className="page-header">
        <div>
          <Link
            to={`/projects/${scan.project_id}`}
            className="back-link"
          >
            ← Back to Project
          </Link>

          <h1>
            Security Scan #{scan.id}
          </h1>

          <p>
            {scan.project_name || "Project"} security assessment
          </p>
        </div>

        <div
          className={`scan-status ${
            scan.status === "completed"
              ? "status-completed"
              : scan.status === "failed"
              ? "status-failed"
              : "status-running"
          }`}
        >
          {scan.status}
        </div>
      </div>

      {/* SUMMARY */}

      <div className="scan-summary-grid">

        <div className="summary-card">
          <span>Security Score</span>

          <strong className="security-score">
            {scan.security_score ?? 0}%
          </strong>
        </div>

        <div className="summary-card">
          <span>Files Scanned</span>

          <strong>
            {scan.files_scanned ?? 0}
          </strong>
        </div>

        <div className="summary-card">
          <span>Total Findings</span>

          <strong>
            {scan.total_findings ?? findings.length}
          </strong>
        </div>

        <div className="summary-card">
          <span>Scan Status</span>

          <strong>
            {scan.status}
          </strong>
        </div>

      </div>

      {/* TIMING */}

      <div className="scan-information">

        <div>
          <span>Started</span>

          <strong>
            {scan.started_at
              ? new Date(scan.started_at).toLocaleString()
              : "—"}
          </strong>
        </div>

        <div>
          <span>Completed</span>

          <strong>
            {scan.completed_at
              ? new Date(scan.completed_at).toLocaleString()
              : "—"}
          </strong>
        </div>

      </div>

      {/* FINDINGS */}

      <div className="section-header">
        <div>
          <h2>Security Findings</h2>

          <p>
            Issues discovered during this security scan.
          </p>
        </div>
      </div>

      {findings.length === 0 ? (
        <div className="empty-projects">

          <div className="empty-icon">
            ✓
          </div>

          <h2>
            No vulnerabilities found
          </h2>

          <p>
            This scan did not detect any security issues.
          </p>

        </div>
      ) : (
        <div className="findings-list">

          {findings.map((finding) => (
            <div
              className="finding-card"
              key={finding.id}
            >

              <div className="finding-header">

                <div>
                  <span className="finding-rule">
                    {finding.rule_id}
                  </span>

                  <h3>
                    {finding.title}
                  </h3>
                </div>

                <span
                  className={`severity-badge ${severityClass(
                    finding.severity
                  )}`}
                >
                  {finding.severity}
                </span>

              </div>

              <p className="finding-description">
                {finding.description}
              </p>

              <div className="finding-details">

                <div>
                  <span>File</span>

                  <strong>
                    {finding.file_path || "Unknown"}
                  </strong>
                </div>

                <div>
                  <span>Line</span>

                  <strong>
                    {finding.line_number ?? "—"}
                  </strong>
                </div>

              </div>

              {finding.evidence && (
                <div className="finding-evidence">

                  <span>Evidence</span>

                  <pre>
                    {finding.evidence}
                  </pre>

                </div>
              )}

              {finding.recommendation && (
                <div className="finding-recommendation">

                  <strong>
                    Recommendation
                  </strong>

                  <p>
                    {finding.recommendation}
                  </p>

                </div>
              )}

            </div>
          ))}

        </div>
      )}

    </div>
  );
}

export default ScanDetails;