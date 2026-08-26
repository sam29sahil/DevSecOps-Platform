import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  FolderKanban,
  GitBranch,
  ShieldCheck,
  Bug,
  Container,
  Cloud,
  FileText,
  Settings,
  Activity,
  LogOut,
} from "lucide-react";

const menuItems = [
  {
    section: "MAIN",
    items: [
      {
        name: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        name: "Projects",
        path: "/projects",
        icon: FolderKanban,
      },
      {
        name: "Pipelines",
        path: "/pipelines",
        icon: GitBranch,
      },
    ],
  },

  {
    section: "SECURITY",
    items: [
      {
        name: "Security Scans",
        path: "/scans",
        icon: ShieldCheck,
      },
      {
        name: "Vulnerabilities",
        path: "/vulnerabilities",
        icon: Bug,
      },
      {
        name: "Containers",
        path: "/containers",
        icon: Container,
      },
    ],
  },

  {
    section: "INFRASTRUCTURE",
    items: [
      {
        name: "Azure",
        path: "/azure",
        icon: Cloud,
      },
      {
        name: "Activity",
        path: "/activity",
        icon: Activity,
      },
    ],
  },

  {
    section: "MANAGEMENT",
    items: [
      {
        name: "Reports",
        path: "/reports",
        icon: FileText,
      },
      {
        name: "Settings",
        path: "/settings",
        icon: Settings,
      },
    ],
  },
];

function Sidebar() {
  return (
    <aside className="sidebar">

      {/* BRAND */}

      <div className="brand">

        <div className="brand-icon">
          <ShieldCheck size={22} />
        </div>

        <div>
          <div className="brand-name">
            DevSecOps
          </div>

          <div className="brand-subtitle">
            SECURITY PLATFORM
          </div>
        </div>

      </div>

      {/* NAVIGATION */}

      <div className="sidebar-content">

        {menuItems.map((group) => (
          <div
            className="menu-group"
            key={group.section}
          >

            <div className="menu-section">
              {group.section}
            </div>

            {group.items.map((item) => {

              const Icon = item.icon;

              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    `menu-item ${
                      isActive ? "active" : ""
                    }`
                  }
                >
                  <Icon size={18} />

                  <span>
                    {item.name}
                  </span>
                </NavLink>
              );
            })}

          </div>
        ))}

      </div>

      {/* FOOTER */}

      <div className="sidebar-footer">

        <div className="system-status">

          <span className="status-dot"></span>

          <div>

            <div className="status-title">
              Systems Operational
            </div>

            <div className="status-subtitle">
              All services online
            </div>

          </div>

        </div>

        <button
          type="button"
          className="logout-button"
        >
          <LogOut size={17} />
          <span>Logout</span>
        </button>

      </div>

    </aside>
  );
}

export default Sidebar;