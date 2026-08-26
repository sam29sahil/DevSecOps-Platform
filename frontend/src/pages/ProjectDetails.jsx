import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import {
  getProject,
  getProjectScans,
} from "../services/api";

function ProjectDetails() {
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [scans, setScans] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* =======================================================
     LOAD PROJECT
  ======================================================= */

  async function loadProject() {
    try {
      setLoading(true);
      setError("");

      const projectData =
        await getProject(projectId);

      if (!projectData.success) {
        throw new Error(
          projectData.error ||
            "Failed to load project."
        );
      }

      setProject(projectData.project);

      /* -----------------------------------------------
         Load project scans separately.

         getProjectScans() contains a fallback to
         /scans if /projects/:id/scans is unavailable.
      ------------------------------------------------ */

      try {
        const scansData =
          await getProjectScans(projectId);

        if (scansData.success) {
          setScans(
            Array.isArray(scansData.scans)
              ? scansData.scans
              : []
          );
        } else {
          setScans([]);
        }
      } catch (scanError) {
        console.error(
          "Project scans error:",
          scanError
        );

        setScans([]);
      }

    } catch (err) {
      console.error(
        "Project details error:",
        err
      );

      setError(
        err.message ||
          "Failed to load project."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProject();
  }, [projectId]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <DashboardLayout>
        <div className="project-details-page">

          <div className="loading-state">
            <div className="loading-spinner"></div>

            <span>
              Loading project...
            </span>
          </div>

        </div>
      </DashboardLayout>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (error || !project) {
    return (
      <DashboardLayout>
        <div className="project-details-page">

          <div className="error-message">
            <strong>
              Failed to load project
            </strong>

            <p>
              {error ||
                "Project not found."}
            </p>
          </div>

          <Link
            to="/projects"
            className="secondary-button"
          >
            ← Back to Projects
          </Link>

        </div>
      </DashboardLayout>
    );
  }

  const status =
    String(
      project.status || "active"
    ).toLowerCase();

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <DashboardLayout>
      <div className="project-details-page">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="project-details-header">

          <div>

            <Link
              to="/projects"
              className="back-link"
            >
              ← Back to Projects
            </Link>

            <div className="breadcrumb">
              DevSecOps <span>/</span>{" "}
              Projects <span>/</span>{" "}
              <strong>
                {project.name}
              </strong>
            </div>

            <div className="project-title-row">

              <div>
                <h1>
                  {project.name}
                </h1>

                <p>
                  {project.description ||
                    "DevSecOps project"}
                </p>
              </div>

              <span
                className={`project-status-large status-${status}`}
              >
                <span className="status-dot"></span>
                {status}
              </span>

            </div>

          </div>

        </div>

        {/* =================================================
            PROJECT SUMMARY
        ================================================= */}

        <div className="details-grid">

          <div className="details-card">

            <span>
              Project ID
            </span>

            <strong>
              #{project.id}
            </strong>

          </div>

          <div className="details-card">

            <span>
              Branch
            </span>

            <strong>
              {project.branch ||
                "main"}
            </strong>

          </div>

          <div className="details-card">

            <span>
              Status
            </span>

            <strong className="capitalize">
              {status}
            </strong>

          </div>

          <div className="details-card">

            <span>
              Security Scans
            </span>

            <strong>
              {scans.length}
            </strong>

          </div>

        </div>

        {/* =================================================
            REPOSITORY
        ================================================= */}

        <section className="dashboard-panel">

          <div className="section-header">

            <div>
              <h2>
                Repository
              </h2>

              <p>
                Source repository connected
                to this project.
              </p>
            </div>

          </div>

          <div className="repository-box">

            <div className="repository-icon">
              ◇
            </div>

            {project.repository_url ? (
              <a
                href={
                  project.repository_url
                }
                target="_blank"
                rel="noreferrer"
                className="repository-url"
              >
                {project.repository_url}
              </a>
            ) : (
              <span className="muted-text">
                No repository connected.
              </span>
            )}

          </div>

        </section>

        {/* =================================================
            SECURITY SCANS
        ================================================= */}

        <section className="dashboard-panel">

          <div className="section-header">

            <div>
              <h2>
                Security Scans
              </h2>

              <p>
                Security assessments
                performed for this project.
              </p>
            </div>

            <Link
              to="/scan-history"
              className="secondary-button"
            >
              View Scan History
            </Link>

          </div>

          {/* NO SCANS */}

          {scans.length === 0 ? (
            <div className="empty-state">

              <div className="empty-icon">
                ✓
              </div>

              <h3>
                No scans yet
              </h3>

              <p>
                Run a security scan to
                analyze this project.
              </p>

            </div>
          ) : (

            /* SCAN LIST */

            <div className="scan-list">

              {scans.map((scan) => {

                const scanStatus =
                  String(
                    scan.status ||
                      "unknown"
                  ).toLowerCase();

                return (
                  <div
                    className="scan-row"
                    key={scan.id}
                  >

                    <div className="scan-row-main">

                      <strong>
                        Security Scan #
                        {scan.id}
                      </strong>

                      <span>
                        {scan.started_at
                          ? new Date(
                              scan.started_at
                            ).toLocaleString()
                          : scan.created_at
                          ? new Date(
                              scan.created_at
                            ).toLocaleString()
                          : "Date unavailable"}
                      </span>

                    </div>

                    <div className="scan-row-right">

                      <span
                        className={`scan-status scan-${scanStatus}`}
                      >
                        {scanStatus}
                      </span>

                      <Link
                        to={`/scans/${scan.id}`}
                        className="secondary-button"
                      >
                        View Scan
                      </Link>

                    </div>

                  </div>
                );
              })}

            </div>
          )}

        </section>

      </div>
    </DashboardLayout>
  );
}

export default ProjectDetails;