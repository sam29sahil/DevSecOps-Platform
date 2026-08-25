import DashboardLayout from "../layouts/DashboardLayout";

function Dashboard() {
  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <div className="dashboard-header">
          <div>
            <h1>Security Dashboard</h1>
            <p>
              Monitor your DevSecOps security posture, pipelines,
              vulnerabilities and deployments.
            </p>
          </div>

          <button className="scan-button">
            + New Security Scan
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span>Projects</span>
            <strong>0</strong>
            <small>Active projects</small>
          </div>

          <div className="stat-card">
            <span>Security Scans</span>
            <strong>0</strong>
            <small>Scans completed</small>
          </div>

          <div className="stat-card">
            <span>Vulnerabilities</span>
            <strong>0</strong>
            <small>Issues detected</small>
          </div>

          <div className="stat-card">
            <span>Security Score</span>
            <strong>100%</strong>
            <small>Current posture</small>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-panel">
            <h2>Recent Pipelines</h2>
            <div className="empty-state">
              <div className="empty-icon">⚡</div>
              <h3>No pipelines yet</h3>
              <p>
                Connect a repository to start your first
                DevSecOps pipeline.
              </p>
            </div>
          </div>

          <div className="dashboard-panel">
            <h2>Security Status</h2>

            <div className="security-status">
              <div className="status-indicator"></div>

              <div>
                <strong>System Secure</strong>
                <p>No active security issues.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Dashboard;