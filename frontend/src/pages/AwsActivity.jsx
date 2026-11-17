import { useEffect, useState } from "react";
import {
  Cloud,
  Database,
  RefreshCw,
  Server,
  Layers,
  FileText,
  Activity,
  ShieldCheck,
  ExternalLink,
  Cpu,
  HardDrive,
} from "lucide-react";
import {
  getAwsStatus,
  getAwsEcr,
  getAwsImages,
  getAwsOverview,
  getAwsEcs,
  getAwsCloudWatch,
} from "../services/api";
import { formatDateTime } from "../utils/time";
import "./AwsActivity.css";

function formatDate(value) {
  if (!value) return "N/A";
  return formatDateTime(value, { fallback: "N/A" });
}

function AwsActivity() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState(null);
  const [ecsData, setEcsData] = useState(null);
  const [cloudWatchData, setCloudWatchData] = useState([]);
  const [ecrRepo, setEcrRepo] = useState(null);
  const [images, setImages] = useState([]);

  async function loadAwsData() {
    try {
      setLoading(true);
      setError("");

      const [ovRes, ecsRes, cwRes, ecrRes, imgRes] = await Promise.allSettled([
        getAwsOverview(),
        getAwsEcs(),
        getAwsCloudWatch(),
        getAwsEcr(),
        getAwsImages(),
      ]);

      if (ovRes.status === "fulfilled" && ovRes.value?.success) {
        setOverview(ovRes.value);
      }
      if (ecsRes.status === "fulfilled" && ecsRes.value?.success) {
        setEcsData(ecsRes.value);
      }
      if (cwRes.status === "fulfilled" && cwRes.value?.success) {
        setCloudWatchData(cwRes.value.log_groups || []);
      }
      if (ecrRes.status === "fulfilled" && ecrRes.value?.success) {
        setEcrRepo(ecrRes.value.repository);
      }
      if (imgRes.status === "fulfilled" && imgRes.value?.success) {
        setImages(imgRes.value.images || []);
      }
    } catch (err) {
      console.error("Failed to load AWS infrastructure:", err);
      setError(err?.message || "Failed to load AWS infrastructure data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAwsData();
  }, []);

  const isConnected = overview?.connected ?? false;
  const accountId = overview?.account_id || "288418346751";
  const region = overview?.region || "ap-south-1";
  const clusterName = ecsData?.cluster || "devsecops-cluster";
  const services = ecsData?.services || [];
  const runningTasks = overview?.running_tasks ?? services.reduce((acc, s) => acc + (s.running_count || 0), 0);

  return (
    <div className="aws-page">
      {/* Header */}
      <div className="aws-page-header">
        <div>
          <div className="aws-section-label">AWS CLOUD INFRASTRUCTURE</div>
          <h1>AWS Activity & Resources</h1>
          <p>
            Real-time infrastructure metrics for AWS ECS Fargate, Amazon ECR registries, Application Load Balancers, and CloudWatch log streams.
          </p>
        </div>

        <button
          className="aws-refresh-button"
          onClick={loadAwsData}
          disabled={loading}
        >
          <RefreshCw className={loading ? "aws-spin" : ""} size={16} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Top AWS Account Banner */}
      <div style={{
        background: "#0d1b30",
        border: "1px solid #1a365d",
        borderRadius: "12px",
        padding: "18px 24px",
        marginBottom: "24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            background: "rgba(255, 153, 0, 0.15)",
            border: "1px solid #ff9900",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ff9900",
          }}>
            <Cloud size={24} />
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
              AWS Account: {accountId}
            </div>
            <div style={{ fontSize: "13px", color: "#94a3b8" }}>
              Target Region: <span style={{ color: "#38bdf8", fontWeight: 600 }}>{region}</span> | Cluster: <span style={{ color: "#38bdf8", fontWeight: 600 }}>{clusterName}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{
            padding: "5px 12px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 700,
            background: isConnected ? "rgba(34, 197, 94, 0.15)" : "rgba(234, 179, 8, 0.15)",
            color: isConnected ? "#4ade80" : "#facc15",
            border: `1px solid ${isConnected ? "#22c55e" : "#eab308"}`,
          }}>
            {isConnected ? "AWS APIs Connected" : "Connecting AWS..."}
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div className="aws-card" style={{ background: "#0b1526", border: "1px solid #1a2f4c", borderRadius: "10px", padding: "18px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>ECS FARGATE SERVICES</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", marginTop: "6px" }}>{services.length}</div>
          <div style={{ fontSize: "12px", color: "#38bdf8", marginTop: "4px" }}>Isolated app workloads</div>
        </div>

        <div className="aws-card" style={{ background: "#0b1526", border: "1px solid #1a2f4c", borderRadius: "10px", padding: "18px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>RUNNING ECS TASKS</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#22c55e", marginTop: "6px" }}>{runningTasks}</div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>Active Fargate containers</div>
        </div>

        <div className="aws-card" style={{ background: "#0b1526", border: "1px solid #1a2f4c", borderRadius: "10px", padding: "18px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>ECR REPOSITORIES</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", marginTop: "6px" }}>1</div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>{ecrRepo?.name || "devsecops-platform"}</div>
        </div>

        <div className="aws-card" style={{ background: "#0b1526", border: "1px solid #1a2f4c", borderRadius: "10px", padding: "18px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>CLOUDWATCH LOG GROUPS</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#f8fafc", marginTop: "6px" }}>{cloudWatchData.length}</div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>Prefix: /ecs</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "10px 18px",
            background: activeTab === "overview" ? "#1e40af" : "#0d1b30",
            color: "#fff",
            border: "1px solid #25476e",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Server size={16} /> ECS Services & Deployments ({services.length})
        </button>
        <button
          onClick={() => setActiveTab("ecr")}
          style={{
            padding: "10px 18px",
            background: activeTab === "ecr" ? "#1e40af" : "#0d1b30",
            color: "#fff",
            border: "1px solid #25476e",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Layers size={16} /> Amazon ECR Registry
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          style={{
            padding: "10px 18px",
            background: activeTab === "logs" ? "#1e40af" : "#0d1b30",
            color: "#fff",
            border: "1px solid #25476e",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FileText size={16} /> CloudWatch Logs ({cloudWatchData.length})
        </button>
      </div>

      {error && (
        <div style={{ padding: "14px 18px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: "8px", color: "#fca5a5", marginBottom: "20px" }}>
          <strong>Notice:</strong> {error}
        </div>
      )}

      {/* Tab 1: ECS Services */}
      {activeTab === "overview" && (
        <div style={{ background: "#0b1526", border: "1px solid #1a2f4c", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid #1a2f4c" }}>
            <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: "18px" }}>ECS Fargate Workloads</h3>
            <span style={{ fontSize: "13px", color: "#64748b" }}>Cluster: {clusterName}</span>
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Loading ECS services...</div>
          ) : services.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              No active ECS services in cluster <strong>{clusterName}</strong>. Deploy an application to launch a Fargate service.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#08101d", color: "#94a3b8", borderBottom: "1px solid #1a2f4c" }}>
                    <th style={{ padding: "14px 20px" }}>Service Name</th>
                    <th style={{ padding: "14px 20px" }}>Tasks (Run/Des)</th>
                    <th style={{ padding: "14px 20px" }}>Compute (CPU/Mem)</th>
                    <th style={{ padding: "14px 20px" }}>Port</th>
                    <th style={{ padding: "14px 20px" }}>Health Status</th>
                    <th style={{ padding: "14px 20px" }}>Public Endpoint</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #122138", color: "#e2e8f0" }}>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ fontWeight: 600, color: "#60a5fa" }}>{s.service_name}</div>
                        <div style={{ fontSize: "12px", color: "#64748b", fontFamily: "monospace" }}>
                          {s.task_definition ? s.task_definition.split("/").pop() : "Fargate Task"}
                        </div>
                      </td>

                      <td style={{ padding: "14px 20px" }}>
                        <span style={{ fontWeight: 600, color: s.running_count > 0 ? "#4ade80" : "#94a3b8" }}>
                          {s.running_count || 0}
                        </span>
                        <span style={{ color: "#64748b" }}> / {s.desired_count || 0}</span>
                      </td>

                      <td style={{ padding: "14px 20px", color: "#cbd5e1" }}>
                        {s.cpu || "256"} CPU / {s.memory || "512"} MB
                      </td>

                      <td style={{ padding: "14px 20px", color: "#94a3b8" }}>
                        {s.container_port || 5000}
                      </td>

                      <td style={{ padding: "14px 20px" }}>
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: s.health_status === "healthy" ? "rgba(34, 197, 94, 0.15)" : "rgba(234, 179, 8, 0.15)",
                          color: s.health_status === "healthy" ? "#4ade80" : "#facc15",
                        }}>
                          {s.health_status || "Active"}
                        </span>
                      </td>

                      <td style={{ padding: "14px 20px" }}>
                        {s.app_url ? (
                          <a
                            href={s.app_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#38bdf8", textDecoration: "none" }}
                          >
                            Open Live App <ExternalLink size={13} />
                          </a>
                        ) : (
                          <span style={{ color: "#64748b" }}>Pending IP/ALB</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: ECR Repository */}
      {activeTab === "ecr" && (
        <div style={{ background: "#0b1526", border: "1px solid #1a2f4c", borderRadius: "12px", padding: "24px" }}>
          <h3 style={{ margin: "0 0 16px", color: "#f1f5f9", fontSize: "18px" }}>ECR Repository Metadata</h3>
          {ecrRepo ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
              <div style={{ background: "#08101d", padding: "16px", borderRadius: "8px", border: "1px solid #1a2f4c" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>REPOSITORY NAME</span>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "#f8fafc", marginTop: "4px" }}>{ecrRepo.name}</div>
              </div>

              <div style={{ background: "#08101d", padding: "16px", borderRadius: "8px", border: "1px solid #1a2f4c" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>TOTAL IMAGES</span>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "#f8fafc", marginTop: "4px" }}>{ecrRepo.image_count}</div>
              </div>

              <div style={{ background: "#08101d", padding: "16px", borderRadius: "8px", border: "1px solid #1a2f4c" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>SCAN ON PUSH</span>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "#4ade80", marginTop: "4px" }}>
                  {ecrRepo.scan_on_push ? "Enabled (Automated CVE Scan)" : "Disabled"}
                </div>
              </div>

              <div style={{ background: "#08101d", padding: "16px", borderRadius: "8px", border: "1px solid #1a2f4c", gridColumn: "1 / -1" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>REPOSITORY URI</span>
                <div style={{ fontSize: "14px", fontWeight: 500, color: "#93c5fd", fontFamily: "monospace", marginTop: "4px", wordBreak: "break-all" }}>
                  {ecrRepo.uri}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: "#64748b" }}>ECR metadata currently loading or unavailable.</div>
          )}
        </div>
      )}

      {/* Tab 3: CloudWatch */}
      {activeTab === "logs" && (
        <div style={{ background: "#0b1526", border: "1px solid #1a2f4c", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid #1a2f4c" }}>
            <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: "18px" }}>CloudWatch Log Groups</h3>
            <span style={{ fontSize: "13px", color: "#64748b" }}>Target prefix: /ecs</span>
          </div>

          {cloudWatchData.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              No log groups with prefix <strong>/ecs</strong> discovered. Ensure log groups are provisioned in ap-south-1.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#08101d", color: "#94a3b8", borderBottom: "1px solid #1a2f4c" }}>
                    <th style={{ padding: "14px 20px" }}>Log Group Name</th>
                    <th style={{ padding: "14px 20px" }}>Stored Bytes</th>
                    <th style={{ padding: "14px 20px" }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {cloudWatchData.map((g, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #122138", color: "#e2e8f0" }}>
                      <td style={{ padding: "14px 20px", fontWeight: 600, color: "#60a5fa" }}>
                        {g.name}
                      </td>
                      <td style={{ padding: "14px 20px", color: "#cbd5e1" }}>
                        {g.stored_bytes} bytes
                      </td>
                      <td style={{ padding: "14px 20px", color: "#94a3b8", fontSize: "13px" }}>
                        {formatDate(g.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AwsActivity;
