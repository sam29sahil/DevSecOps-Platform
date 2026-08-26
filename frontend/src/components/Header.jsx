import {
  Search,
  Bell,
  ChevronDown,
  Shield,
} from "lucide-react";

function Header() {
  return (
    <header className="top-header">

      <div className="header-left">

        <div className="breadcrumb">

          <span>
            DevSecOps
          </span>

          <span className="breadcrumb-separator">
            /
          </span>

          <strong>
            Dashboard
          </strong>

        </div>

      </div>


      <div className="header-right">

        <div className="search-box">

          <Search size={17} />

          <input
            type="text"
            placeholder="Search..."
            aria-label="Search"
          />

          <span className="search-shortcut">
            ⌘ K
          </span>

        </div>


        <button
          type="button"
          className="icon-button notification-button"
          aria-label="Notifications"
        >

          <Bell size={19} />

          <span className="notification-dot" />

        </button>


        <div className="profile">

          <div className="profile-avatar">
            <Shield size={18} />
          </div>


          <div className="profile-info">

            <span className="profile-name">
              Security Admin
            </span>

            <span className="profile-role">
              Administrator
            </span>

          </div>


          <ChevronDown size={16} />

        </div>

      </div>

    </header>
  );
}

export default Header;