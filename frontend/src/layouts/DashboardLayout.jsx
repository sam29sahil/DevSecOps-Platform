import { NavLink } from "react-router-dom";

function DashboardLayout({ children }) {
  return (
    <div className="app-layout">

      <aside className="sidebar">

        <div className="sidebar-brand">
          <div className="brand-icon">
            ♢
          </div>

          <div>
            <h2>DevSecOps</h2>
            <span>Security Platform</span>
          </div>
        </div>

        <div className="sidebar-divider" />

        <nav className="sidebar-nav">

          <div className="nav-section">
            <span className="nav-section-title">
              MAIN
            </span>

            <NavLink to="/dashboard" className="nav-link">
              <span className="nav-icon">▦</span>
              Dashboard
            </NavLink>

            <NavLink to="/projects" className="nav-link">
              <span className="nav-icon">□</span>
              Projects
            </NavLink>

            <NavLink to="/pipelines" className="nav-link">
              <span className="nav-icon">⌁</span>
              Pipelines
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">
              SECURITY
            </span>

            <NavLink
              to="/scan-history"
              className="nav-link"
            >
              <span className="nav-icon">◇</span>
              Security Scans
            </NavLink>

            <NavLink
              to="/vulnerabilities"
              className="nav-link"
            >
              <span className="nav-icon">◇</span>
              Vulnerabilities
            </NavLink>

            <NavLink
              to="/containers"
              className="nav-link"
            >
              <span className="nav-icon">⬡</span>
              Containers
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">
              INFRASTRUCTURE
            </span>

            <NavLink
              to="/azure"
              className="nav-link"
            >
              <span className="nav-icon">☁</span>
              Azure Activity
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">
              MANAGEMENT
            </span>

            <NavLink
              to="/reports"
              className="nav-link"
            >
              <span className="nav-icon">▤</span>
              Reports
            </NavLink>

            <NavLink
              to="/settings"
              className="nav-link"
            >
              <span className="nav-icon">⚙</span>
              Settings
            </NavLink>
          </div>

        </nav>

        <div className="sidebar-footer">
          <div className="system-status">
            <span className="status-dot" />
            <div>
              <strong>Systems Operational</strong>
              <span>All services online</span>
            </div>
          </div>

          <button className="logout-button">
            ↪ Logout
          </button>
        </div>

      </aside>

      <div className="main-area">

        <header className="topbar">

          <div className="breadcrumb">
            <span>DevSecOps</span>
            <span>/</span>
            <strong>Dashboard</strong>
          </div>

          <div className="topbar-right">

            <div className="search-box">
              <span>⌕</span>
              <input
                type="text"
                placeholder="Search..."
              />
              <kbd>Ctrl K</kbd>
            </div>

            <button className="topbar-icon">
              ◇
            </button>

            <div className="user-profile">

              <div className="avatar">
                SA
              </div>

              <div>
                <strong>Security Admin</strong>
                <span>Administrator</span>
              </div>

            </div>

          </div>

        </header>

        <main className="main-content">
          {children}
        </main>

      </div>

    </div>
  );
}

export default DashboardLayout;