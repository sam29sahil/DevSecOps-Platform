import "./DashboardLayout.css";

import Header from "./Header";
import Sidebar from "./Sidebar";

function DashboardLayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main-area">
        <Header />

        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;