import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProjects } from "../services/api";

function ProjectDetails() {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
      } catch (err) {
        setError(err.message || "Failed to load project.");
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [id]);

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

        <Link to="/projects" className="secondary-button">
          ← Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="project-details-page">

      {/* Header */}
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
            Project details, repository configuration and
            DevSecOps security information.
          </p>
        </div>

        <div className="project-detail-status">
          <span className="status-dot" />
          {project.status || "active"}
        </div>
      </div>

      {/* Overview */}
      <section className="details-section">

        <div className="section-heading">
          <div>
            <h2>Project Overview</h2>
            <p>Basic information about this application.</p>
          </div>
        </div>

        <div className="details-grid">

          <div className="detail-card">
            <span>Project ID</span>
            <strong>#{project.id}</strong>
          </div>

          <div className="detail-card">
            <span>Status</span>

            <strong className="status-value">
              <span className="status-dot" />
              {project.status || "active"}
            </strong>
          </div>

          <div className="detail-card">
            <span>Branch</span>
            <strong>{project.branch || "main"}</strong>
          </div>

          <div className="detail-card">
            <span>Security Score</span>
            <strong>100%</strong>
          </div>

        </div>
      </section>

      {/* Repository */}
      <section className="details-section">

        <div className="section-heading">
          <div>
            <h2>Repository</h2>
            <p>Source code connected to this project.</p>
          </div>
        </div>

        <div className="repository-panel">

          <div className="repository-row">
            <span>Repository URL</span>

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
              <strong>Not configured</strong>
            )}
          </div>

          <div className="repository-row">
            <span>Branch</span>
            <strong>{project.branch || "main"}</strong>
          </div>

        </div>
      </section>

      {/* Description */}
      <section className="details-section">

        <div className="section-heading">
          <div>
            <h2>Description</h2>
            <p>Project information.</p>
          </div>
        </div>

        <div className="description-panel">
          {project.description ||
            "No description has been provided for this project."}
        </div>

      </section>

      {/* Security */}
      <section className="details-section">

        <div className="section-heading">
          <div>
            <h2>Security</h2>
            <p>
              Security analysis for this project.
            </p>
          </div>
        </div>

        <div className="security-grid">

          <div className="security-card">
            <div className="security-icon">🛡️</div>

            <div>
              <span>Security Scans</span>
              <strong>0</strong>
              <small>No scans completed</small>
            </div>
          </div>

          <div className="security-card">
            <div className="security-icon">⚠️</div>

            <div>
              <span>Vulnerabilities</span>
              <strong>0</strong>
              <small>No issues detected</small>
            </div>
          </div>

          <div className="security-card">
            <div className="security-icon">🔒</div>

            <div>
              <span>Security Score</span>
              <strong>100%</strong>
              <small>Current posture</small>
            </div>
          </div>

        </div>
      </section>

      {/* Future DevSecOps */}
      <section className="details-section">

        <div className="section-heading">
          <div>
            <h2>DevSecOps Pipeline</h2>
            <p>
              Automated security checks will appear here.
            </p>
          </div>
        </div>

        <div className="pipeline-placeholder">

          <div className="pipeline-icon">⚡</div>

          <h3>No pipeline configured</h3>

          <p>
            Connect this project to a CI/CD pipeline to
            automatically run security checks.
          </p>

          <button className="primary-button" disabled>
            Configure Pipeline
          </button>

        </div>

      </section>

    </div>
  );
}

export default ProjectDetails;