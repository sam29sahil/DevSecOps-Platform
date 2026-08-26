import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";

import ScanHistory from "./pages/ScanHistory";
import ScanDetails from "./pages/ScanDetails";
import Vulnerabilities from "./pages/Vulnerabilities";
import Pipelines from "./pages/Pipelines";

function App() {
  return (
    <BrowserRouter>
      <Routes>

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

        {/* Scans */}
        <Route
          path="/scan-history"
          element={<ScanHistory />}
        />

        <Route
          path="/scans/:scanId"
          element={<ScanDetails />}
        />

        <Route
          path="/vulnerabilities"
          element={<Vulnerabilities />}
        />

        {/* Pipelines */}
        <Route
          path="/pipelines"
          element={<Pipelines />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;