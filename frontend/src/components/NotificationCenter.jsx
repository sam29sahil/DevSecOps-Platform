import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
  Trash2,
  CheckCheck,
  X,
  Server,
  Shield,
  Layers,
} from "lucide-react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications,
} from "../services/api";
import "./NotificationCenter.css";

function formatTimeAgo(dateString) {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    return date.toLocaleDateString();
  } catch {
    return dateString;
  }
}

function getNotificationIcon(eventType, status) {
  if (status === "error" || eventType === "deploy_failed" || eventType === "health_check_failed") {
    return <AlertTriangle size={18} className="notif-icon-error" />;
  }
  if (status === "success" || eventType === "deployed_success") {
    return <CheckCircle2 size={18} className="notif-icon-success" />;
  }
  if (eventType === "ecs_started" || eventType === "ecr_pushed") {
    return <Server size={18} className="notif-icon-cloud" />;
  }
  if (eventType === "security_completed") {
    return <Shield size={18} className="notif-icon-shield" />;
  }
  if (eventType === "docker_built" || eventType === "docker_build") {
    return <Layers size={18} className="notif-icon-docker" />;
  }
  return <Info size={18} className="notif-icon-info" />;
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  async function fetchNotifications(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await getNotifications(false, 30);
      if (data && data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.warn("Failed to fetch notifications:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Poll for notifications every 4 seconds to provide real-time updates
  useEffect(() => {
    fetchNotifications(false);
    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  async function handleMarkRead(id, event) {
    event.stopPropagation();
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: 1 } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error marking notification read:", err);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  }

  async function handleClearAll() {
    try {
      await clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error("Error clearing notifications:", err);
    }
  }

  return (
    <div className="notification-center-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className="icon-button notification-button"
        aria-label="Notifications"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="notification-badge" title={`${unreadCount} unread`}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notif-dropdown-header">
            <div className="notif-header-title">
              <strong>Notifications</strong>
              {unreadCount > 0 && (
                <span className="notif-unread-pill">{unreadCount} new</span>
              )}
            </div>

            <div className="notif-header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notif-action-btn"
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                >
                  <CheckCheck size={15} />
                  <span>Mark all read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  className="notif-action-btn notif-clear-btn"
                  onClick={handleClearAll}
                  title="Clear all"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                type="button"
                className="notif-close-btn"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="notif-dropdown-body">
            {loading && notifications.length === 0 ? (
              <div className="notif-loading">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty">
                <Bell size={28} className="notif-empty-icon" />
                <p>No notifications yet</p>
                <span>Live deployment and security events will appear here in real-time.</span>
              </div>
            ) : (
              <div className="notif-list">
                {notifications.map((item) => {
                  const isUnread = !item.read;
                  return (
                    <div
                      key={item.id}
                      className={`notif-item ${isUnread ? "unread" : ""}`}
                    >
                      <div className="notif-item-icon">
                        {getNotificationIcon(item.event_type, item.status)}
                      </div>

                      <div className="notif-item-content">
                        <div className="notif-item-top">
                          <strong className="notif-item-title">{item.title}</strong>
                          <span className="notif-item-time">
                            {formatTimeAgo(item.created_at)}
                          </span>
                        </div>

                        <p className="notif-item-msg">{item.message}</p>

                        <div className="notif-item-meta">
                          {item.project_name && (
                            <span className="notif-meta-project">
                              {item.project_name}
                            </span>
                          )}
                          {item.deployment_id && (
                            <span className="notif-meta-dep">
                              {item.deployment_id}
                            </span>
                          )}
                          {item.message && item.message.includes("http") && (
                            <a
                              href={item.message.match(/https?:\/\/[^\s]+/)?.[0]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="notif-live-link"
                            >
                              <ExternalLink size={12} />
                              <span>Open Live Application</span>
                            </a>
                          )}
                        </div>
                      </div>

                      {isUnread && (
                        <button
                          type="button"
                          className="notif-item-read-btn"
                          onClick={(e) => handleMarkRead(item.id, e)}
                          title="Mark as read"
                        >
                          <CheckCircle2 size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
