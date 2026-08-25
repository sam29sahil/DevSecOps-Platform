import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createProject,
  deleteProject,
  getProjects,
} from "../services/api";

function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    repository_url: "",
    branch: "main",
  });

  async function loadProjects() {
    try {
      setLoading(true);
      setError("");

      const data = await getProjects();

      setProjects(data.projects || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Project name is required.");
      return;
    }

    try {
      setError("");

      await createProject(form);

      setForm({
        name: "",
        description: "",
        repository_url: "",
        branch: "main",
      });

      setShowForm(false);

      await loadProjects();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(projectId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this project?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await deleteProject(projectId);

      await loadProjects();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="projects-page">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p>
            Manage applications and repositories connected to
            your DevSecOps pipelines.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowForm(!showForm)}
        >
          + Create Project
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {showForm && (
        <form
          className="project-form"
          onSubmit={handleSubmit}
        >
          <h2>Create Project</h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Project Name</label>

              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="My Application"
              />
            </div>

            <div className="form-group">
              <label>Branch</label>

              <input
                name="branch"
                value={form.branch}
                onChange={handleChange}
                placeholder="main"
              />
            </div>

            <div className="form-group full-width">
              <label>Repository URL</label>

              <input
                name="repository_url"
                value={form.repository_url}
                onChange={handleChange}
                placeholder="https://github.com/user/repository"
              />
            </div>

            <div className="form-group full-width">
              <label>Description</label>

              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe this project..."
                rows="4"
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
            >
              Create Project
            </button>
          </div>
        </form>
      )}

      <div className="projects-summary">
        <strong>{projects.length}</strong>
        <span>
          {projects.length === 1
            ? " project"
            : " projects"}
        </span>
      </div>

      {loading ? (
        <div className="loading-state">
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-projects">
          <div className="empty-icon">◈</div>

          <h2>No projects yet</h2>

          <p>
            Create your first project to start building
            DevSecOps pipelines.
          </p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <div
              className="project-card"
              key={project.id}
            >
              <div className="project-card-header">
                <div>
                  <h2>{project.name}</h2>

                  <span className="project-status">
                    <span className="status-dot" />
                    {project.status}
                  </span>
                </div>

                <span className="project-id">
                  #{project.id}
                </span>
              </div>

              <p className="project-description">
                {project.description ||
                  "No description provided."}
              </p>

              <div className="project-meta">
                <div>
                  <span>Branch</span>
                  <strong>{project.branch}</strong>
                </div>

                <div>
                  <span>Repository</span>

                  <strong className="repository">
                    {project.repository_url ||
                      "Not configured"}
                  </strong>
                </div>
              </div>

              <div className="project-actions">
                <Link
                  to={`/projects/${project.id}`}
                  className="secondary-button"
                >
                  View Project
                </Link>
                <button
                  className="danger-button"
                  onClick={() =>
                    handleDelete(project.id)
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Projects;