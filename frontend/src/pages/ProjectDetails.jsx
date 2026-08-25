import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  getProjects,
  getScans,
  getScan,
  runSecurityScan,
} from "../services/api";


function ProjectDetails() {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [scans, setScans] = useState([]);
  const [findings, setFindings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const [error, setError] = useState("");
  const [scanError, setScanError] = useState("");

  const [severityFilter, setSeverityFilter] = useState("ALL");


  async function loadScans() {
    try {
      const data = await getScans(id);

      setScans(data.scans || []);

      if (data.scans && data.scans.length > 0) {
        const latest = await getScan(data.scans[0].id);

        setFindings(latest.findings || []);
      } else {
        setFindings([]);
      }

    } catch (err) {
      setScanError(
        err.message || "Failed to load security scans."
      );
    }
  }


  async function loadProject() {
    try {
      setLoading(true);
      setError("");

      const data = await getProjects();

      const foundProject = (data.projects || []).find(
        (item) => String(item.id) === String(id)
      );

      if (!foundProject) {
        setError("Project not found.");
        return;
      }

      setProject(foundProject);

      await loadScans();

    } catch (err) {
      setError(
        err.message || "Failed to load project."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadProject();
  }, [id]);


  async function handleRunScan() {
    try {
      setScanning(true);
      setScanError("");

      await runSecurityScan(
        Number(id),
        "D:\\Projects\\DevSecOps-Platform"
      );

      await loadScans();

    } catch (err) {
      setScanError(
        err.message || "Security scan failed."
      );
    } finally {
      setScanning(false);
    }
  }


  function getSeverityClass(severity) {
    return `severity-${String(
      severity || "LOW"
    ).toLowerCase()}`;
  }


  const latestScan =
    scans.length > 0 ? scans[0] : null;


  const filteredFindings =
    severityFilter === "ALL"
      ? findings
      : findings.filter(
          (finding) =>
            finding.severity === severityFilter
        );


  const severityCounts = {
    CRITICAL: findings.filter(
      (finding) => finding.severity === "CRITICAL"
    ).length,

    HIGH: findings.filter(
      (finding) => finding.severity === "HIGH"
    ).length,

    MEDIUM: findings.filter(
      (finding) => finding.severity === "MEDIUM"
    ).length,

    LOW: findings.filter(
      (finding) => finding.severity === "LOW"
    ).length,
  };


  if (loading) {
    return (
      <div className="project-details-page">
        <div className="loading-state">
          Loading project...
        </div>
      </div>
    );
  }


  if (error || !project) {
    return (
      <div className="project-details-page">

        <div className="error-message">
          {error || "Project not found."}
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
    <div className="project-details-page">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="page-header">

        <div>

          <Link
            to="/projects"
            className="back-link"
          >
            ← Projects
          </Link>

          <h1>{project.name}</h1>

          <p>
            Project details, security analysis and
            DevSecOps configuration.
          </p>

        </div>


        <div className="project-detail-status">

          <span className="status-dot" />

          {project.status || "active"}

        </div>

      </div>


      {/* ==================================================
          PROJECT OVERVIEW
      ================================================== */}

      <section className="details-section">

        <div className="section-heading">

          <div>

            <h2>
              Project Overview
            </h2>

            <p>
              Basic information about this application.
            </p>

          </div>

        </div>


        <div className="details-grid">

          <div className="detail-card">

            <span>
              Project ID
            </span>

            <strong>
              #{project.id}
            </strong>

          </div>


          <div className="detail-card">

            <span>
              Status
            </span>

            <strong className="status-value">

              <span className="status-dot" />

              {project.status || "active"}

            </strong>

          </div>


          <div className="detail-card">

            <span>
              Branch
            </span>

            <strong>
              {project.branch || "main"}
            </strong>

          </div>


          <div className="detail-card">

            <span>
              Security Score
            </span>

            <strong>
              {latestScan
                ? `${latestScan.security_score}%`
                : "—"}
            </strong>

          </div>

        </div>

      </section>


      {/* ==================================================
          REPOSITORY
      ================================================== */}

      <section className="details-section">

        <div className="section-heading">

          <div>

            <h2>
              Repository
            </h2>

            <p>
              Source code connected to this project.
            </p>

          </div>

        </div>


        <div className="repository-panel">

          <div className="repository-row">

            <span>
              Repository URL
            </span>

            {project.repository_url ? (

              <a
                href={project.repository_url}
                target="_blank"
                rel="noreferrer"
                className="repository-link"
              >
                {project.repository_url}
              </a>

            ) : (

              <strong>
                Not configured
              </strong>

            )}

          </div>


          <div className="repository-row">

            <span>
              Branch
            </span>

            <strong>
              {project.branch || "main"}
            </strong>

          </div>

        </div>

      </section>


      {/* ==================================================
          SECURITY
      ================================================== */}

      <section className="details-section">

        <div className="section-heading">

          <div>

            <h2>
              Security
            </h2>

            <p>
              Security analysis for this project.
            </p>

          </div>


          <button
            className="primary-button"
            onClick={handleRunScan}
            disabled={scanning}
          >

            {scanning
              ? "⏳ Scanning..."
              : "🛡 Run Security Scan"}

          </button>

        </div>


        {scanError && (

          <div className="error-message">
            {scanError}
          </div>

        )}


        {latestScan ? (

          <>

            {/* SECURITY STATISTICS */}

            <div className="security-grid">

              <div className="security-card">

                <div className="security-icon">
                  🛡️
                </div>

                <div>

                  <span>
                    Security Score
                  </span>

                  <strong>
                    {latestScan.security_score}%
                  </strong>

                  <small>
                    Latest scan
                  </small>

                </div>

              </div>


              <div className="security-card">

                <div className="security-icon">
                  ⚠️
                </div>

                <div>

                  <span>
                    Findings
                  </span>

                  <strong>
                    {latestScan.total_findings}
                  </strong>

                  <small>
                    Security issues detected
                  </small>

                </div>

              </div>


              <div className="security-card">

                <div className="security-icon">
                  📄
                </div>

                <div>

                  <span>
                    Files Scanned
                  </span>

                  <strong>
                    {latestScan.files_scanned}
                  </strong>

                  <small>
                    Source files analyzed
                  </small>

                </div>

              </div>

            </div>


            {/* SCAN INFORMATION */}

            <div className="scan-info-panel">

              <div>

                <span>
                  Latest Scan
                </span>

                <strong>
                  Scan #{latestScan.id}
                </strong>

              </div>


              <div>

                <span>
                  Status
                </span>

                <strong className="scan-status">
                  {latestScan.status}
                </strong>

              </div>


              <div>

                <span>
                  Started
                </span>

                <strong>
                  {latestScan.started_at
                    ? new Date(
                        latestScan.started_at
                      ).toLocaleString()
                    : "—"}
                </strong>

              </div>


              <div>

                <span>
                  Completed
                </span>

                <strong>
                  {latestScan.completed_at
                    ? new Date(
                        latestScan.completed_at
                      ).toLocaleString()
                    : "—"}
                </strong>

              </div>

            </div>


            {/* ==================================================
                FINDINGS
            ================================================== */}

            <div className="findings-section">

              <div className="findings-header">

                <div>

                  <h3>
                    Security Findings
                  </h3>

                  <p>
                    Vulnerabilities and security issues
                    discovered during the latest scan.
                  </p>

                </div>

              </div>


              {/* SEVERITY SUMMARY */}

              <div className="severity-summary">

                <button
                  className={
                    severityFilter === "ALL"
                      ? "severity-filter active"
                      : "severity-filter"
                  }
                  onClick={() =>
                    setSeverityFilter("ALL")
                  }
                >

                  <strong>
                    {findings.length}
                  </strong>

                  <span>
                    All
                  </span>

                </button>


                <button
                  className={
                    severityFilter === "CRITICAL"
                      ? "severity-filter critical active"
                      : "severity-filter critical"
                  }
                  onClick={() =>
                    setSeverityFilter("CRITICAL")
                  }
                >

                  <strong>
                    {severityCounts.CRITICAL}
                  </strong>

                  <span>
                    Critical
                  </span>

                </button>


                <button
                  className={
                    severityFilter === "HIGH"
                      ? "severity-filter high active"
                      : "severity-filter high"
                  }
                  onClick={() =>
                    setSeverityFilter("HIGH")
                  }
                >

                  <strong>
                    {severityCounts.HIGH}
                  </strong>

                  <span>
                    High
                  </span>

                </button>


                <button
                  className={
                    severityFilter === "MEDIUM"
                      ? "severity-filter medium active"
                      : "severity-filter medium"
                  }
                  onClick={() =>
                    setSeverityFilter("MEDIUM")
                  }
                >

                  <strong>
                    {severityCounts.MEDIUM}
                  </strong>

                  <span>
                    Medium
                  </span>

                </button>


                <button
                  className={
                    severityFilter === "LOW"
                      ? "severity-filter low active"
                      : "severity-filter low"
                  }
                  onClick={() =>
                    setSeverityFilter("LOW")
                  }
                >

                  <strong>
                    {severityCounts.LOW}
                  </strong>

                  <span>
                    Low
                  </span>

                </button>

              </div>


              {/* FINDINGS LIST */}

              {filteredFindings.length === 0 ? (

                <div className="no-findings">

                  <div className="no-findings-icon">
                    ✓
                  </div>

                  <h4>
                    No findings
                  </h4>

                  <p>
                    No security issues match the
                    selected severity.
                  </p>

                </div>

              ) : (

                <div className="findings-list">

                  {filteredFindings.map(
                    (finding) => (

                      <div
                        className="finding-card"
                        key={finding.id}
                      >

                        <div className="finding-card-top">

                          <div className="finding-title-area">

                            <span
                              className={`severity-badge ${getSeverityClass(
                                finding.severity
                              )}`}
                            >
                              {finding.severity}
                            </span>

                            <div>

                              <h4>
                                {finding.title}
                              </h4>

                              <span className="rule-id">
                                {finding.rule_id}
                              </span>

                            </div>

                          </div>


                          <div className="finding-location">

                            <span>
                              📄
                            </span>

                            <strong>
                              {finding.file_path}
                            </strong>

                            <span>
                              Line {finding.line_number}
                            </span>

                          </div>

                        </div>


                        <div className="finding-description">

                          <p>
                            {finding.description}
                          </p>

                        </div>


                        {finding.evidence && (

                          <div className="finding-block">

                            <span>
                              Evidence
                            </span>

                            <pre>
                              {finding.evidence}
                            </pre>

                          </div>

                        )}


                        {finding.recommendation && (

                          <div className="finding-recommendation">

                            <span>
                              Recommendation
                            </span>

                            <p>
                              {finding.recommendation}
                            </p>

                          </div>

                        )}

                      </div>

                    )
                  )}

                </div>

              )}

            </div>


            {/* SCAN HISTORY */}

            <div className="scan-history">

              <h3>
                Scan History
              </h3>


              {scans.map((scan) => (

                <div
                  className="scan-row"
                  key={scan.id}
                >

                  <div>

                    <strong>
                      Scan #{scan.id}
                    </strong>

                    <span>
                      {scan.status}
                    </span>

                  </div>


                  <div>

                    <strong>
                      {scan.security_score}%
                    </strong>

                    <small>
                      {scan.total_findings} findings
                    </small>

                  </div>

                </div>

              ))}

            </div>

          </>

        ) : (

          <div className="pipeline-placeholder">

            <div className="pipeline-icon">
              🛡️
            </div>

            <h3>
              No security scans yet
            </h3>

            <p>
              Run your first security scan to analyze
              this project's source code.
            </p>

            <button
              className="primary-button"
              onClick={handleRunScan}
              disabled={scanning}
            >
              {scanning
                ? "⏳ Scanning..."
                : "Run First Security Scan"}
            </button>

          </div>

        )}

      </section>


      {/* ==================================================
          DEVSECOPS PIPELINE
      ================================================== */}

      <section className="details-section">

        <div className="section-heading">

          <div>

            <h2>
              DevSecOps Pipeline
            </h2>

            <p>
              Automated security checks will appear here.
            </p>

          </div>

        </div>


        <div className="pipeline-placeholder">

          <div className="pipeline-icon">
            ⚡
          </div>

          <h3>
            Pipeline integration
          </h3>

          <p>
            Connect this project to CI/CD to automatically
            run security checks whenever new code is pushed.
          </p>

          <button
            className="primary-button"
            disabled
          >
            Configure Pipeline
          </button>

        </div>

      </section>

    </div>
  );
}


export default ProjectDetails;