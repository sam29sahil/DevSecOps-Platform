import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";

import ScanHistory from "./pages/ScanHistory";
import ScanDetails from "./pages/ScanDetails";
import Vulnerabilities from "./pages/Vulnerabilities";
import Pipelines from "./pages/Pipelines";
import Reports from "./pages/Reports";
import Containers from "./pages/Containers";
import AwsActivity from "./pages/AwsActivity";
import Deployments from "./pages/Deployments";
import Settings from "./pages/Settings";

function App() {
  return (
    <Routes>
      {/* Root */}
      <Route
        path="/"
        element={<Navigate to="/dashboard" replace />}
      />

      {/* Dashboard */}
      <Route
        path="/dashboard"
        element={<Dashboard />}
      />

      {/* Projects */}
      <Route
        path="/projects"
        element={<Projects />}
      />

      <Route
        path="/projects/:projectId"
        element={<ProjectDetails />}
      />

      {/* Security Scans */}
      <Route
        path="/scans"
        element={<ScanHistory />}
      />

      <Route
        path="/scan-history"
        element={<ScanHistory />}
      />

      <Route
        path="/scans/:scanId"
        element={<ScanDetails />}
      />

      {/* Vulnerabilities */}
      <Route
        path="/vulnerabilities"
        element={<Vulnerabilities />}
      />

      {/* Pipelines */}
      <Route
        path="/pipelines"
        element={<Pipelines />}
      />

      {/* Deployments */}
      <Route
        path="/deployments"
        element={<Deployments />}
      />

      {/* Docker Images & Workloads */}
      <Route
        path="/containers"
        element={<Containers />}
      />

      {/* AWS Infrastructure */}
      <Route
        path="/aws"
        element={<AwsActivity />}
      />

      {/* Reports */}
      <Route
        path="/reports"
        element={<Reports />}
      />

      {/* Settings */}
      <Route
        path="/settings"
        element={<Settings />}
      />

      {/* Fallback */}
      <Route
        path="*"
        element={<Navigate to="/dashboard" replace />}
      />
    </Routes>
  );
}

export default App;