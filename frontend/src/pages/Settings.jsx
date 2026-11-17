import { useState } from "react";
import {
  Settings as SettingsIcon,
  Shield,
  Key,
  Cloud,
  Bell,
  Save,
  CheckCircle,
  Copy,
} from "lucide-react";

function Settings() {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [config, setConfig] = useState({
    awsRegion: "ap-south-1",
    awsAccountId: "288418346751",
    ecrRepository: "devsecops-platform",
    ecsCluster: "devsecops-cluster",
    oidcRole: "arn:aws:iam::288418346751:role/DevSecOpsPlatform-GitHubActions",
    minQualityScore: "80",
    blockCritical: true,
    blockHigh: true,
    pollInterval: "15",
    apiKey: localStorage.getItem("apiKey") || "devsecops-secret-key-2026",
  });

  function handleSave(e) {
    e.preventDefault();
    localStorage.setItem("apiKey", config.apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function copyKey() {
    navigator.clipboard.writeText(config.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ padding: "38px 42px 60px", maxWidth: "100%", boxSizing: "border-box" }}>
      <div style={{ marginBottom: "30px" }}>
        <div style={{ color: "#5ea2ff", fontSize: "12px", fontWeight: 700, letterSpacing: "1.2px" }}>PLATFORM CONFIGURATION</div>
        <h1 style={{ color: "#f5f8ff", fontSize: "32px", fontWeight: 700, margin: "8px 0" }}>System Settings</h1>
        <p style={{ color: "#7f9bc0", fontSize: "15px", margin: 0 }}>
          Manage AWS infrastructure targets, security scanning thresholds, and platform authentication credentials.
        </p>
      </div>

      {saved && (
        <div style={{
          padding: "14px 20px",
          background: "rgba(34, 197, 94, 0.15)",
          border: "1px solid #22c55e",
          borderRadius: "8px",
          color: "#4ade80",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}>
          <CheckCircle size={18} /> Settings saved successfully to local storage.
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "24px" }}>
        {/* Card 1: AWS Target Configuration */}
        <div style={{ background: "#0b1526", border: "1px solid #1a2f4c", borderRadius: "12px", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <Cloud size={20} color="#38bdf8" />
            <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "18px" }}>AWS Cloud Targets</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "13px", marginBottom: "6px" }}>AWS Region</label>
              <input
                type="text"
                value={config.awsRegion}
                onChange={(e) => setConfig({ ...config, awsRegion: e.target.value })}
                style={{ width: "100%", padding: "10px", background: "#08101d", border: "1px solid #1a2f4c", borderRadius: "6px", color: "#f1f5f9" }}
              />
            </div>

            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "13px", marginBottom: "6px" }}>AWS Account ID</label>
              <input
                type="text"
                value={config.awsAccountId}
                disabled
                style={{ width: "100%", padding: "10px", background: "#08101d", border: "1px solid #1a2f4c", borderRadius: "6px", color: "#94a3b8" }}
              />
            </div>

            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "13px", marginBottom: "6px" }}>ECR Repository Name</label>
              <input
                type="text"
                value={config.ecrRepository}
                onChange={(e) => setConfig({ ...config, ecrRepository: e.target.value })}
                style={{ width: "100%", padding: "10px", background: "#08101d", border: "1px solid #1a2f4c", borderRadius: "6px", color: "#f1f5f9" }}
              />
            </div>

            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "13px", marginBottom: "6px" }}>ECS Fargate Cluster</label>
              <input
                type="text"
                value={config.ecsCluster}
                onChange={(e) => setConfig({ ...config, ecsCluster: e.target.value })}
                style={{ width: "100%", padding: "10px", background: "#08101d", border: "1px solid #1a2f4c", borderRadius: "6px", color: "#f1f5f9" }}
              />
            </div>

            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "13px", marginBottom: "6px" }}>GitHub OIDC Role ARN</label>
              <input
                type="text"
                value={config.oidcRole}
                disabled
                style={{ width: "100%", padding: "10px", background: "#08101d", border: "1px solid #1a2f4c", borderRadius: "6px", color: "#94a3b8", fontSize: "12px", fontFamily: "monospace" }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Security & Quality Gates */}
        <div style={{ background: "#0b1526", border: "1px solid #1a2f4c", borderRadius: "12px", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <Shield size={20} color="#22c55e" />
            <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "18px" }}>Security & Quality Gates</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "13px", marginBottom: "6px" }}>
                Minimum Security Gate Score (0-100)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={config.minQualityScore}
                onChange={(e) => setConfig({ ...config, minQualityScore: e.target.value })}
                style={{ width: "100%", padding: "10px", background: "#08101d", border: "1px solid #1a2f4c", borderRadius: "6px", color: "#f1f5f9" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "#08101d", borderRadius: "8px" }}>
              <input
                type="checkbox"
                id="blockCrit"
                checked={config.blockCritical}
                onChange={(e) => setConfig({ ...config, blockCritical: e.target.checked })}
                style={{ cursor: "pointer", width: "18px", height: "18px" }}
              />
              <label htmlFor="blockCrit" style={{ color: "#f1f5f9", fontSize: "14px", cursor: "pointer" }}>
                Fail pipeline immediately on CRITICAL severity findings
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "#08101d", borderRadius: "8px" }}>
              <input
                type="checkbox"
                id="blockHigh"
                checked={config.blockHigh}
                onChange={(e) => setConfig({ ...config, blockHigh: e.target.checked })}
                style={{ cursor: "pointer", width: "18px", height: "18px" }}
              />
              <label htmlFor="blockHigh" style={{ color: "#f1f5f9", fontSize: "14px", cursor: "pointer" }}>
                Fail pipeline immediately on HIGH severity findings
              </label>
            </div>

            {/* Authentication API Key */}
            <div style={{ marginTop: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <Key size={16} color="#eab308" />
                <label style={{ color: "#94a3b8", fontSize: "13px" }}>Platform API Key</label>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  style={{ flex: 1, padding: "10px", background: "#08101d", border: "1px solid #1a2f4c", borderRadius: "6px", color: "#f1f5f9", fontFamily: "monospace" }}
                />
                <button
                  type="button"
                  onClick={copyKey}
                  style={{ padding: "10px 14px", background: "#1a2f4c", border: "none", borderRadius: "6px", color: "#38bdf8", cursor: "pointer" }}
                >
                  <Copy size={16} /> {copied ? "Copied" : ""}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Save button row */}
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
          <button
            type="submit"
            style={{
              padding: "12px 28px",
              background: "#2563eb",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Save size={18} /> Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}

export default Settings;
