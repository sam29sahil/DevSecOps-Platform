import { useEffect, useMemo, useState } from "react";
import { getScans, getReport } from "../services/api";
import DashboardLayout from "../layouts/DashboardLayout";
import "./Reports.css";

function Reports() {
  const [scans, setScans] = useState([]);
  const [selectedScanId, setSelectedScanId] = useState("");
  const [report, setReport] = useState(null);

  const [loadingScans, setLoadingScans] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");

  /* =========================================================
     LOAD COMPLETED SCANS
  ========================================================= */

  async function loadScans() {
    try {
      setLoadingScans(true);
      setError("");

      const data = await getScans();

      const allScans = Array.isArray(data.scans)
        ? data.scans
        : [];

      const completedScans = allScans.filter(
        (scan) =>
          String(scan.status || "").toLowerCase() ===
          "completed"
      );

      setScans(completedScans);

      if (completedScans.length > 0) {
        const currentExists = completedScans.some(
          (scan) =>
            String(scan.id) === String(selectedScanId)
        );

        if (!selectedScanId || !currentExists) {
          setSelectedScanId(String(completedScans[0].id));
        }
      } else {
        setSelectedScanId("");
        setReport(null);
      }
    } catch (err) {
      setError(
        err.message || "Unable to load security scans."
      );
    } finally {
      setLoadingScans(false);
    }
  }

  /* =========================================================
     LOAD REPORT
  ========================================================= */

  async function loadReport(scanId) {
    if (!scanId) {
      setReport(null);
      return;
    }

    try {
      setLoadingReport(true);
      setError("");

      const data = await getReport(scanId);

      setReport(data.report || null);
    } catch (err) {
      setReport(null);
      setError(
        err.message || "Unable to load security report."
      );
    } finally {
      setLoadingReport(false);
    }
  }

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    loadScans();
  }, []);

  useEffect(() => {
    if (selectedScanId) {
      loadReport(selectedScanId);
    }
  }, [selectedScanId]);

  /* =========================================================
     SELECTED SCAN
  ========================================================= */

  const selectedScan = useMemo(() => {
    return scans.find(
      (scan) =>
        String(scan.id) === String(selectedScanId)
    );
  }, [scans, selectedScanId]);

  /* =========================================================
     SUMMARY
  ========================================================= */

  const summary = report?.summary || {};

  const severityCounts = {
    CRITICAL:
      summary.severity_counts?.CRITICAL || 0,

    HIGH:
      summary.severity_counts?.HIGH || 0,

    MEDIUM:
      summary.severity_counts?.MEDIUM || 0,

    LOW:
      summary.severity_counts?.LOW || 0,
  };

  const findings = Array.isArray(report?.findings)
    ? report.findings
    : [];

  const securityScore =
    Number(summary.security_score ?? 0);

  /* =========================================================
     PRINT REPORT
  ========================================================= */

  function printReport() {
    window.print();
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <DashboardLayout>
      <div className="reports-page">

        {/* =====================================================
            PAGE HEADER
        ===================================================== */}

        <div className="reports-header">

          <div className="reports-heading">

            <div className="reports-eyebrow">
              SECURITY REPORTING
            </div>

            <h1>Security Reports</h1>

            <p>
              Generate and review detailed security
              assessments from completed scans.
            </p>

          </div>

          <div className="reports-actions">

            <button
              className="report-button report-button-secondary"
              onClick={loadScans}
              disabled={loadingScans}
            >
              â†» Refresh
            </button>

            <button
              className="report-button report-button-primary"
              onClick={printReport}
              disabled={!report}
            >
              â†“ Print Report
            </button>

          </div>

        </div>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="report-error">
            <span>!</span>
            <div>
              <strong>Unable to load report</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* =====================================================
            SCAN SELECTOR
        ===================================================== */}

        <section className="report-card scan-selector-card">

          <div className="card-section-label">
            REPORT SOURCE
          </div>

          <div className="scan-selector-content">

            <div>
              <h2>Select Security Scan</h2>

              <p>
                Choose an existing completed scan to
                generate its security report.
              </p>
            </div>

            <div className="scan-select-wrapper">

              <label htmlFor="report-scan">
                Scan
              </label>

              {loadingScans ? (
                <div className="scan-loading">
                  Loading scans...
                </div>
              ) : (
                <select
                  id="report-scan"
                  value={selectedScanId}
                  onChange={(event) =>
                    setSelectedScanId(
                      event.target.value
                    )
                  }
                  disabled={scans.length === 0}
                >
                  {scans.length === 0 ? (
                    <option value="">
                      No completed scans
                    </option>
                  ) : (
                    scans.map((scan) => (
                      <option
                        key={scan.id}
                        value={scan.id}
                      >
                        Scan #{scan.id} â€”{" "}
                        {scan.project_name ||
                          `Project #${scan.project_id}`}{" "}
                        â€” completed
                      </option>
                    ))
                  )}
                </select>
              )}

            </div>

          </div>

        </section>

        {/* =====================================================
            NO REPORT
        ===================================================== */}

        {!loadingReport &&
          !report &&
          !loadingScans &&
          scans.length === 0 && (
            <section className="report-card empty-report">

              <div className="empty-report-icon">
                âœ“
              </div>

              <h2>No completed scans</h2>

              <p>
                Complete a security scan before generating
                a security report.
              </p>

            </section>
          )}

        {/* =====================================================
            REPORT
        ===================================================== */}

        {loadingReport ? (
          <section className="report-card report-loading">

            <div className="loading-spinner"></div>

            <h2>Loading Security Report</h2>

            <p>
              Preparing the security assessment...
            </p>

          </section>
        ) : (
          report && (
            <>

              {/* =================================================
                  PROJECT / SCAN HEADER
              ================================================= */}

              <section className="report-card assessment-header">

                <div>

                  <div className="card-section-label">
                    SECURITY ASSESSMENT
                  </div>

                  <h2>
                    {report.scan?.project_name ||
                      selectedScan?.project_name ||
                      "Security Project"}
                  </h2>

                  <p>
                    Scan #{report.scan?.id ||
                      selectedScan?.id}
                  </p>

                </div>

                <div className="completed-badge">
                  <span></span>
                  COMPLETED
                </div>

              </section>

              {/* =================================================
                  SUMMARY CARDS
              ================================================= */}

              <section className="report-summary-grid">

                <div className="summary-card">

                  <div className="summary-label">
                    Security Score
                  </div>

                  <div
                    className={`summary-value score-value ${
                      securityScore >= 80
                        ? "score-good"
                        : securityScore >= 60
                        ? "score-warning"
                        : "score-danger"
                    }`}
                  >
                    {securityScore}%
                  </div>

                  <div className="summary-description">
                    Overall security posture
                  </div>

                </div>

                <div className="summary-card">

                  <div className="summary-label">
                    Files Scanned
                  </div>

                  <div className="summary-value">
                    {summary.files_scanned || 0}
                  </div>

                  <div className="summary-description">
                    Files analyzed
                  </div>

                </div>

                <div className="summary-card">

                  <div className="summary-label">
                    Total Findings
                  </div>

                  <div className="summary-value">
                    {summary.total_findings || 0}
                  </div>

                  <div className="summary-description">
                    Security issues detected
                  </div>

                </div>

                <div className="summary-card">

                  <div className="summary-label">
                    Scan Status
                  </div>

                  <div className="summary-status">
                    Completed
                  </div>

                  <div className="summary-description">
                    Current scan state
                  </div>

                </div>

              </section>

              {/* =================================================
                  SECURITY OVERVIEW
              ================================================= */}

              <section className="report-card">

                <div className="card-section-label">
                  RISK ANALYSIS
                </div>

                <div className="section-title-row">

                  <div>
                    <h2>Severity Distribution</h2>

                    <p>
                      Breakdown of security findings
                      detected during this scan.
                    </p>
                  </div>

                </div>

                <div className="severity-grid">

                  <div className="severity-item severity-critical">
                    <div className="severity-top">
                      <span className="severity-dot"></span>
                      <span>Critical</span>
                    </div>

                    <strong>
                      {severityCounts.CRITICAL}
                    </strong>
                  </div>

                  <div className="severity-item severity-high">
                    <div className="severity-top">
                      <span className="severity-dot"></span>
                      <span>High</span>
                    </div>

                    <strong>
                      {severityCounts.HIGH}
                    </strong>
                  </div>

                  <div className="severity-item severity-medium">
                    <div className="severity-top">
                      <span className="severity-dot"></span>
                      <span>Medium</span>
                    </div>

                    <strong>
                      {severityCounts.MEDIUM}
                    </strong>
                  </div>

                  <div className="severity-item severity-low">
                    <div className="severity-top">
                      <span className="severity-dot"></span>
                      <span>Low</span>
                    </div>

                    <strong>
                      {severityCounts.LOW}
                    </strong>
                  </div>

                </div>

              </section>

              {/* =================================================
                  FINDINGS
              ================================================= */}

              <section className="report-card findings-section">

                <div className="card-section-label">
                  SECURITY FINDINGS
                </div>

                <div className="section-title-row">

                  <div>
                    <h2>Detected Vulnerabilities</h2>

                    <p>
                      Security issues identified during
                      the selected scan.
                    </p>
                  </div>

                  <div className="findings-count">
                    {findings.length} finding
                    {findings.length === 1
                      ? ""
                      : "s"}
                  </div>

                </div>

                {findings.length === 0 ? (
                  <div className="no-findings">

                    <div className="no-findings-icon">
                      âœ“
                    </div>

                    <h3>
                      No security findings
                    </h3>

                    <p>
                      This scan did not identify any
                      security vulnerabilities.
                    </p>

                  </div>
                ) : (
                  <div className="findings-list">

                    {findings.map((finding) => {

                      const severity =
                        String(
                          finding.severity || "LOW"
                        ).toUpperCase();

                      return (
                        <article
                          className="finding-card"
                          key={finding.id}
                        >

                          <div className="finding-header">

                            <div>

                              <span
                                className={`finding-badge finding-${severity.toLowerCase()}`}
                              >
                                {severity}
                              </span>

                              <h3>
                                {finding.title ||
                                  "Security Finding"}
                              </h3>

                            </div>

                            <span className="finding-rule">
                              {finding.rule_id ||
                                "SEC"}
                            </span>

                          </div>

                          {finding.description && (
                            <p className="finding-description">
                              {finding.description}
                            </p>
                          )}

                          <div className="finding-meta">

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
                                {finding.line_number ||
                                  "â€”"}
                              </strong>
                            </div>

                            <div>
                              <span>
                                Project
                              </span>

                              <strong>
                                {report.scan
                                  ?.project_name ||
                                  "Unknown"}
                              </strong>
                            </div>

                          </div>

                          {finding.evidence && (
                            <div className="finding-detail">

                              <span>
                                Evidence
                              </span>

                              <code>
                                {finding.evidence}
                              </code>

                            </div>
                          )}

                          {finding.recommendation && (
                            <div className="finding-detail">

                              <span>
                                Recommendation
                              </span>

                              <p>
                                {finding.recommendation}
                              </p>

                            </div>
                          )}

                        </article>
                      );
                    })}

                  </div>
                )}

              </section>

              {/* =================================================
                  SCAN INFORMATION
              ================================================= */}

              <section className="report-card scan-information">

                <div className="card-section-label">
                  SCAN INFORMATION
                </div>

                <h2>Assessment Details</h2>

                <div className="information-grid">

                  <div>
                    <span>Scan ID</span>
                    <strong>
                      #{report.scan?.id}
                    </strong>
                  </div>

                  <div>
                    <span>Project</span>
                    <strong>
                      {report.scan?.project_name ||
                        "Unknown"}
                    </strong>
                  </div>

                  <div>
                    <span>Files Scanned</span>
                    <strong>
                      {report.scan?.files_scanned ||
                        0}
                    </strong>
                  </div>

                  <div>
                    <span>Findings</span>
                    <strong>
                      {report.scan?.total_findings ||
                        0}
                    </strong>
                  </div>

                  <div>
                    <span>Security Score</span>
                    <strong>
                      {report.scan?.security_score ??
                        0}%
                    </strong>
                  </div>

                  <div>
                    <span>Status</span>
                    <strong className="status-completed">
                      Completed
                    </strong>
                  </div>

                </div>

              </section>

            </>
          )
        )}

      </div>
    </DashboardLayout>
  );
}

export default Reports;
