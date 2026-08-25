import { useEffect, useMemo, useState } from "react";
import { getVulnerabilities } from "../services/api";

function Vulnerabilities() {
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [severity, setSeverity] = useState("ALL");

  async function loadVulnerabilities() {
    try {
      setLoading(true);
      setError("");

      const data = await getVulnerabilities();

      setVulnerabilities(data.vulnerabilities || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVulnerabilities();
  }, []);

  const filteredVulnerabilities = useMemo(() => {
    if (severity === "ALL") {
      return vulnerabilities;
    }

    return vulnerabilities.filter(
      (item) =>
        String(item.severity || "").toUpperCase() ===
        severity
    );
  }, [vulnerabilities, severity]);

  const counts = {
    critical: vulnerabilities.filter(
      (v) => v.severity?.toUpperCase() === "CRITICAL"
    ).length,

    high: vulnerabilities.filter(
      (v) => v.severity?.toUpperCase() === "HIGH"
    ).length,

    medium: vulnerabilities.filter(
      (v) => v.severity?.toUpperCase() === "MEDIUM"
    ).length,

    low: vulnerabilities.filter(
      (v) => v.severity?.toUpperCase() === "LOW"
    ).length,
  };

  return (
    <div className="vulnerabilities-page">

      <div className="page-header">
        <div>
          <h1>Vulnerabilities</h1>

          <p>
            Review security findings discovered across
            your DevSecOps projects and scans.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={loadVulnerabilities}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="vulnerability-summary">

        <button
          className={`severity-card ${
            severity === "ALL" ? "selected" : ""
          }`}
          onClick={() => setSeverity("ALL")}
        >
          <span>Total</span>
          <strong>{vulnerabilities.length}</strong>
        </button>

        <button
          className={`severity-card ${
            severity === "CRITICAL" ? "selected" : ""
          }`}
          onClick={() => setSeverity("CRITICAL")}
        >
          <span>Critical</span>
          <strong>{counts.critical}</strong>
        </button>

        <button
          className={`severity-card ${
            severity === "HIGH" ? "selected" : ""
          }`}
          onClick={() => setSeverity("HIGH")}
        >
          <span>High</span>
          <strong>{counts.high}</strong>
        </button>

        <button
          className={`severity-card ${
            severity === "MEDIUM" ? "selected" : ""
          }`}
          onClick={() => setSeverity("MEDIUM")}
        >
          <span>Medium</span>
          <strong>{counts.medium}</strong>
        </button>

        <button
          className={`severity-card ${
            severity === "LOW" ? "selected" : ""
          }`}
          onClick={() => setSeverity("LOW")}
        >
          <span>Low</span>
          <strong>{counts.low}</strong>
        </button>

      </div>

      <div className="vulnerabilities-panel">

        <div className="panel-header">
          <div>
            <h2>Security Findings</h2>

            <p>
              {filteredVulnerabilities.length} finding
              {filteredVulnerabilities.length === 1
                ? ""
                : "s"}
            </p>
          </div>

          <select
            value={severity}
            onChange={(event) =>
              setSeverity(event.target.value)
            }
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-state">
            Loading vulnerabilities...
          </div>
        ) : filteredVulnerabilities.length === 0 ? (
          <div className="empty-projects">
            <div className="empty-icon">✓</div>

            <h2>No vulnerabilities found</h2>

            <p>
              No security findings match the selected
              severity.
            </p>
          </div>
        ) : (
          <div className="vulnerability-list">

            {filteredVulnerabilities.map((vulnerability) => (
              <div
                className="vulnerability-card"
                key={vulnerability.id}
              >

                <div className="vulnerability-header">

                  <div>
                    <span
                      className={`severity-badge severity-${String(
                        vulnerability.severity || "LOW"
                      ).toLowerCase()}`}
                    >
                      {vulnerability.severity}
                    </span>

                    <h3>
                      {vulnerability.title}
                    </h3>
                  </div>

                  <span className="rule-id">
                    {vulnerability.rule_id}
                  </span>

                </div>

                <p className="vulnerability-description">
                  {vulnerability.description}
                </p>

                <div className="vulnerability-details">

                  <div>
                    <span>Project</span>
                    <strong>
                      {vulnerability.project_name ||
                        `Project #${vulnerability.project_id}`}
                    </strong>
                  </div>

                  <div>
                    <span>File</span>
                    <strong>
                      {vulnerability.file_path ||
                        "Unknown"}
                    </strong>
                  </div>

                  <div>
                    <span>Line</span>
                    <strong>
                      {vulnerability.line_number ||
                        "—"}
                    </strong>
                  </div>

                </div>

                {vulnerability.evidence && (
                  <div className="finding-section">
                    <span>Evidence</span>

                    <code>
                      {vulnerability.evidence}
                    </code>
                  </div>
                )}

                {vulnerability.recommendation && (
                  <div className="finding-section">
                    <span>Recommendation</span>

                    <p>
                      {vulnerability.recommendation}
                    </p>
                  </div>
                )}

              </div>
            ))}

          </div>
        )}

      </div>

    </div>
  );
}

export default Vulnerabilities;