import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";

import {
  getProjects,
  createProject,
  deleteProject,
} from "../services/api";

function Projects() {
  const [projects, setProjects] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);

  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  /* =========================================================
     SEARCH / FILTER
  ========================================================= */

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  /* =========================================================
     FORM
  ========================================================= */

  const [formData, setFormData] = useState({
    name: "",
    branch: "main",
    repository_url: "",
    description: "",
  });

  /* =========================================================
     LOAD PROJECTS
  ========================================================= */

  async function loadProjects() {
    try {
      setLoading(true);
      setError("");

      const data = await getProjects();

      if (!data.success) {
        throw new Error(
          data.error || "Failed to load projects."
        );
      }

      setProjects(
        Array.isArray(data.projects)
          ? data.projects
          : []
      );
    } catch (err) {
      console.error(
        "Projects loading error:",
        err
      );

      setError(
        err.message ||
          "Failed to load projects."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  /* =========================================================
     FORM HANDLING
  ========================================================= */

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function resetForm() {
    setFormData({
      name: "",
      branch: "main",
      repository_url: "",
      description: "",
    });
  }

  function closeCreateForm() {
    if (creating) {
      return;
    }

    resetForm();
    setShowCreateForm(false);
  }

  /* =========================================================
     CREATE PROJECT
  ========================================================= */

  async function handleCreateProject(event) {
    event.preventDefault();

    if (!formData.name.trim()) {
      setError("Project name is required.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const data = await createProject({
        name: formData.name.trim(),

        branch:
          formData.branch.trim() ||
          "main",

        repository_url:
          formData.repository_url.trim(),

        description:
          formData.description.trim(),
      });

      if (!data.success) {
        throw new Error(
          data.error ||
            "Failed to create project."
        );
      }

      await loadProjects();

      resetForm();
      setShowCreateForm(false);
    } catch (err) {
      console.error(
        "Create project error:",
        err
      );

      setError(
        err.message ||
          "Failed to create project."
      );
    } finally {
      setCreating(false);
    }
  }

  /* =========================================================
     DELETE PROJECT
  ========================================================= */

  async function handleDeleteProject(
    projectId
  ) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this project?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(projectId);
      setError("");

      const data =
        await deleteProject(projectId);

      if (!data.success) {
        throw new Error(
          data.error ||
            "Failed to delete project."
        );
      }

      setProjects((previous) =>
        previous.filter(
          (project) =>
            Number(project.id) !==
            Number(projectId)
        )
      );
    } catch (err) {
      console.error(
        "Delete project error:",
        err
      );

      setError(
        err.message ||
          "Failed to delete project."
      );
    } finally {
      setDeletingId(null);
    }
  }

  /* =========================================================
     FILTER PROJECTS
  ========================================================= */

  const filteredProjects = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase();

    return projects.filter((project) => {
      const name = String(
        project.name || ""
      ).toLowerCase();

      const description = String(
        project.description || ""
      ).toLowerCase();

      const repository = String(
        project.repository_url || ""
      ).toLowerCase();

      const branch = String(
        project.branch || ""
      ).toLowerCase();

      const matchesSearch =
        !query ||
        name.includes(query) ||
        description.includes(query) ||
        repository.includes(query) ||
        branch.includes(query);

      const projectStatus = String(
        project.status || "active"
      ).toLowerCase();

      const matchesStatus =
        statusFilter === "all" ||
        projectStatus === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    projects,
    searchQuery,
    statusFilter,
  ]);

  /* =========================================================
     CLEAR FILTERS
  ========================================================= */

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
  }

  /* =========================================================
     LOADING STATE
  ========================================================= */

  if (loading) {
    return (
      <DashboardLayout>
        <div className="projects-page">

          <div className="page-header">

            <div>
              <div className="breadcrumb">
                DevSecOps
                <span>/</span>
                Projects
              </div>

              <h1>Projects</h1>

              <p>
                Manage applications and
                repositories connected to
                your DevSecOps pipelines.
              </p>
            </div>

          </div>

          <div className="loading-state">
            <div className="loading-spinner"></div>

            <span>
              Loading projects...
            </span>
          </div>

        </div>
      </DashboardLayout>
    );
  }

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <DashboardLayout>

      <div className="projects-page">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="page-header projects-header">

          <div>

            <div className="breadcrumb">
              DevSecOps
              <span>/</span>
              <strong>Projects</strong>
            </div>

            <h1>Projects</h1>

            <p>
              Manage applications and
              repositories connected to
              your DevSecOps pipelines.
            </p>

          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              setShowCreateForm(
                (previous) => !previous
              )
            }
          >
            {showCreateForm
              ? "× Close"
              : "+ Create Project"}
          </button>

        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="error-message">

            <strong>Error:</strong>{" "}
            {error}

          </div>
        )}

        {/* =================================================
            CREATE PROJECT FORM
        ================================================= */}

        {showCreateForm && (
          <div className="create-project-panel">

            <div className="section-header">

              <div>

                <h2>
                  Create Project
                </h2>

                <p>
                  Connect an application
                  repository to your
                  DevSecOps platform.
                </p>

              </div>

            </div>

            <form
              className="project-form"
              onSubmit={
                handleCreateProject
              }
            >

              <div className="form-grid">

                {/* PROJECT NAME */}

                <div className="form-group">

                  <label htmlFor="name">
                    Project Name
                  </label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={
                      handleChange
                    }
                    placeholder="My Application"
                    required
                  />

                </div>

                {/* BRANCH */}

                <div className="form-group">

                  <label htmlFor="branch">
                    Branch
                  </label>

                  <input
                    id="branch"
                    name="branch"
                    type="text"
                    value={
                      formData.branch
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="main"
                  />

                </div>

              </div>

              {/* REPOSITORY */}

              <div className="form-group">

                <label htmlFor="repository_url">
                  Repository URL
                </label>

                <input
                  id="repository_url"
                  name="repository_url"
                  type="url"
                  value={
                    formData.repository_url
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="https://github.com/user/repository"
                />

              </div>

              {/* DESCRIPTION */}

              <div className="form-group">

                <label htmlFor="description">
                  Description
                </label>

                <textarea
                  id="description"
                  name="description"
                  rows="4"
                  value={
                    formData.description
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Describe this project..."
                />

              </div>

              {/* FORM ACTIONS */}

              <div className="form-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    closeCreateForm
                  }
                  disabled={creating}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={creating}
                >
                  {creating
                    ? "Creating..."
                    : "Create Project"}
                </button>

              </div>

            </form>

          </div>
        )}

        {/* =================================================
            SEARCH + FILTER TOOLBAR
        ================================================= */}

        {projects.length > 0 && (
          <div className="projects-toolbar">

            <div className="projects-count">

              <strong>
                {filteredProjects.length}
              </strong>{" "}

              {filteredProjects.length === 1
                ? "project"
                : "projects"}

              {filteredProjects.length !==
                projects.length && (
                <span className="filter-count">
                  {" "}
                  of {projects.length}
                </span>
              )}

            </div>

            <div className="projects-filters">

              {/* SEARCH */}

              <div className="project-search">

                <span className="search-icon">
                  ⌕
                </span>

                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(
                      event.target.value
                    )
                  }
                />

                {searchQuery && (
                  <button
                    type="button"
                    className="clear-search"
                    onClick={() =>
                      setSearchQuery("")
                    }
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}

              </div>

              {/* STATUS FILTER */}

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="status-filter"
                aria-label="Filter by status"
              >
                <option value="all">
                  All Status
                </option>

                <option value="active">
                  Active
                </option>

                <option value="pending">
                  Pending
                </option>

                <option value="inactive">
                  Inactive
                </option>

                <option value="failed">
                  Failed
                </option>

              </select>

            </div>

          </div>
        )}

        {/* =================================================
            NO PROJECTS
        ================================================= */}

        {projects.length === 0 && (
          <div className="empty-state large-empty-state">

            <div className="empty-icon">
              ◇
            </div>

            <h2>
              No projects yet
            </h2>

            <p>
              Create your first project
              and connect its repository
              to begin security scanning.
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                setShowCreateForm(true)
              }
            >
              + Create Project
            </button>

          </div>
        )}

        {/* =================================================
            NO FILTER RESULTS
        ================================================= */}

        {projects.length > 0 &&
          filteredProjects.length === 0 && (
            <div className="empty-state large-empty-state">

              <div className="empty-icon">
                ⌕
              </div>

              <h2>
                No matching projects
              </h2>

              <p>
                No projects match your
                current search or status
                filter.
              </p>

              <button
                type="button"
                className="secondary-button"
                onClick={clearFilters}
              >
                Clear Filters
              </button>

            </div>
          )}

        {/* =================================================
            PROJECT GRID
        ================================================= */}

        {filteredProjects.length > 0 && (
          <div className="projects-grid">

            {filteredProjects.map(
              (project) => {

                const projectStatus =
                  String(
                    project.status ||
                      "active"
                  ).toLowerCase();

                return (
                  <article
                    className="project-card"
                    key={project.id}
                  >

                    {/* CARD HEADER */}

                    <div className="project-card-header">

                      <div>

                        <h2>
                          {project.name ||
                            "Unnamed Project"}
                        </h2>

                        <span className="project-id">
                          #{project.id}
                        </span>

                      </div>

                      <span
                        className={`project-status status-${projectStatus}`}
                      >
                        {projectStatus}
                      </span>

                    </div>

                    {/* DESCRIPTION */}

                    <p className="project-description">

                      {project.description ||
                        "No project description provided."}

                    </p>

                    {/* META */}

                    <div className="project-meta">

                      {/* BRANCH */}

                      <div className="meta-item">

                        <span>
                          Branch
                        </span>

                        <strong>
                          {project.branch ||
                            "main"}
                        </strong>

                      </div>

                      {/* REPOSITORY */}

                      <div className="meta-item">

                        <span>
                          Repository
                        </span>

                        {project.repository_url ? (
                          <a
                            href={
                              project.repository_url
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="repository-link"
                            title={
                              project.repository_url
                            }
                          >
                            {
                              project.repository_url
                            }
                          </a>
                        ) : (
                          <strong>
                            Not connected
                          </strong>
                        )}

                      </div>

                    </div>

                    {/* CARD ACTIONS */}

                    <div className="project-card-actions">

                      <Link
                        to={`/projects/${project.id}`}
                        className="secondary-button"
                      >
                        View Project
                      </Link>

                      <button
                        type="button"
                        className="danger-button"
                        onClick={() =>
                          handleDeleteProject(
                            project.id
                          )
                        }
                        disabled={
                          deletingId ===
                          project.id
                        }
                      >
                        {deletingId ===
                        project.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>

                    </div>

                  </article>
                );
              }
            )}

          </div>
        )}

      </div>

    </DashboardLayout>
  );
}

export default Projects;