import { useState, useEffect } from "react";
import { Clock, Globe } from "lucide-react";
import "./RealTimeClock.css";

/**
 * RealTimeClock
 *
 * Displays genuine live real-world system clock updating precisely every second.
 * Supports toggling between User Local Timezone and Indian Standard Time (IST / Asia/Kolkata).
 * Fully reactive with interval cleanup to guarantee zero memory leaks.
 */
export default function RealTimeClock() {
  const [time, setTime] = useState(new Date());
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem("devsecops_clock_mode") || "local";
    } catch {
      return "local";
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const toggleMode = () => {
    const nextMode = mode === "local" ? "ist" : "local";
    setMode(nextMode);
    try {
      localStorage.setItem("devsecops_clock_mode", nextMode);
    } catch {
      // localStorage may be disabled in private mode
    }
  };

  const targetTimeZone = mode === "ist" ? "Asia/Kolkata" : undefined;

  let timeString = "";
  let dateString = "";
  let tzBadge = "";

  try {
    timeString = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: targetTimeZone,
    }).format(time);

    dateString = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: targetTimeZone,
    }).format(time);

    tzBadge = mode === "ist" ? "IST (UTC+5:30)" : "LOCAL";
  } catch (err) {
    timeString = time.toLocaleTimeString();
    dateString = time.toLocaleDateString();
    tzBadge = mode.toUpperCase();
  }

  return (
    <div
      className="real-time-clock"
      onClick={toggleMode}
      title={`Live System Clock (${mode === "ist" ? "Indian Standard Time" : "Local Browser Time"}). Click to switch.`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleMode();
        }
      }}
    >
      <div className="clock-icon-wrapper">
        <Clock size={16} className="clock-icon" />
        <span className="clock-pulse" />
      </div>

      <div className="clock-content">
        <div className="clock-time-row">
          <span className="clock-time">{timeString}</span>
          <span className={`clock-tz-badge ${mode === "ist" ? "ist" : "local"}`}>
            <Globe size={10} className="globe-icon" />
            {tzBadge}
          </span>
        </div>
        <div className="clock-date-row">
          <span className="clock-date">{dateString}</span>
        </div>
      </div>
    </div>
  );
}
