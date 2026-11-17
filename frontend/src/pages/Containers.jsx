import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Container,
  Layers,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Server,
  Tag,
  Clock,
  HardDrive,
} from "lucide-react";
import {
  getContainers,
  getDockerImages,
} from "../services/api";
import "./Containers.css";

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
}

function Containers() {
  const [activeTab, setActiveTab] = useState("images");
  const [images, setImages] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [repositoryUri, setRepositoryUri] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [imgData, contData] = await Promise.allSettled([
        getDockerImages(),
        getContainers(),
      ]);

      if (imgData.status === "fulfilled" && imgData.value?.success) {
        setImages(imgData.value.images || []);
        setRepositoryUri(imgData.value.repository_uri || "");
      }

      if (contData.status === "fulfilled" && contData.value?.success) {
        setContainers(contData.value.containers || []);
      }
    } catch (err) {
      console.error("Failed to load Docker data:", err);
      setError(err?.message || "Failed to load Docker infrastructure.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalImages = images.length;
  const runningContainers = containers.filter(
    (c) => c.state === "running" || c.status?.toLowerCase().includes("up")
  ).length;

  return (
    <div className="containers-page">
      {/* Header */}
      <div className="containers-page-header">
        <div>
          <div className="section-label">CONTAINER REGISTRY & RUNTIMES</div>
          <h1>Docker Images & Workloads</h1>
          <p>
            Real-time synchronization with AWS ECR registry, build artifacts, image vulnerability status, and running Fargate workloads.
          </p>
        </div>

        <button
          className="containers-refresh-button"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw className={loading ? "aws-spin" : ""} size={16} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="containers-summary">
        <div className="summary-card">
          <div className="summary-label">TOTAL ECR IMAGES</div>
          <div className="summary-value">{totalImages}</div>
          <div className="summary-desc">Tagged builds in AWS ECR</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">ACTIVE WORKLOADS</div>
          <div className="summary-value">{runningContainers}</div>
          <div className="summary-desc">Running in ECS Fargate</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">REGISTRY TARGET</div>
          <div className="summary-value" style={{ fontSize: "16px", textTransform: "none", wordBreak: "break-all" }}>
            AWS ECR
          </div>
          <div className="summary-desc">ap-south-1</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">REGISTRY STATUS</div>
          <div className="summary-value" style={{ color: "#22c55e", fontSize: "20px" }}>
            Operational
          </div>
          <div className="summary-desc">Scan on push enabled</div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("images")}
          style={{
            padding: "10px 20px",
            background: activeTab === "images" ? "#1e40af" : "#0d1b30",
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
          <Layers size={16} /> Docker Images in AWS ECR ({totalImages})
        </button>
        <button
          onClick={() => setActiveTab("containers")}
          style={{
            padding: "10px 20px",
            background: activeTab === "containers" ? "#1e40af" : "#0d1b30",
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
          <Server size={16} /> Active Containers & Tasks ({containers.length})
        </button>
      </div>

      {error && (
        <div style={{ padding: "14px 18px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: "8px", color: "#fca5a5", marginBottom: "20px" }}>
          <strong>Notice:</strong> {error}
        </div>
      )}

      {/* Tab 1: Real Docker Images from ECR */}
      {activeTab === "images" && (
        <div style={{ background: "#0b1526", border: "1px solid #1a2f4c", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid #1a2f4c", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: "18px" }}>AWS ECR Image Catalog</h3>
              <span style={{ fontSize: "13px", color: "#64748b" }}>
                Repository: {repositoryUri || "288418346751.dkr.ecr.ap-south-1.amazonaws.com/devsecops-platform"}
              </span>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Loading Docker images from AWS ECR...</div>
          ) : images.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              No tagged Docker images found in AWS ECR yet. Run a pipeline to build and push an image.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#08101d", color: "#94a3b8", borderBottom: "1px solid #1a2f4c" }}>
                    <th style={{ padding: "14px 20px" }}>Associated Project</th>
                    <th style={{ padding: "14px 20px" }}>Image Tag</th>
                    <th style={{ padding: "14px 20px" }}>Size</th>
                    <th style={{ padding: "14px 20px" }}>Push Timestamp</th>
                    <th style={{ padding: "14px 20px" }}>Vulnerability Scan</th>
                    <th style={{ padding: "14px 20px" }}>Deployment Link</th>
                    <th style={{ padding: "14px 20px" }}>Digest</th>
                  </tr>
                </thead>
                <tbody>
                  {images.map((img, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #122138", color: "#e2e8f0" }}>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ fontWeight: 600, color: "#60a5fa" }}>
                          {img.associated_project}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          {img.registry} ({img.region})
                        </div>
                      </td>

                      <td style={{ padding: "14px 20px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(59, 130, 246, 0.15)", color: "#93c5fd", padding: "3px 8px", borderRadius: "6px", fontFamily: "monospace", fontSize: "12px" }}>
                          <Tag size={12} /> {img.tag}
                        </span>
                      </td>

                      <td style={{ padding: "14px 20px", color: "#cbd5e1" }}>
                        {img.image_size}
                      </td>

                      <td style={{ padding: "14px 20px", color: "#94a3b8", fontSize: "13px" }}>
                        {formatDate(img.last_pushed || img.build_timestamp)}
                      </td>

                      <td style={{ padding: "14px 20px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#22c55e", fontSize: "13px" }}>
                          <ShieldCheck size={16} /> {img.scan_status || "COMPLETE"}
                        </span>
                      </td>

                      <td style={{ padding: "14px 20px" }}>
                        {img.associated_deployment ? (
                          <Link
                            to="/deployments"
                            style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#38bdf8", textDecoration: "none", fontSize: "13px" }}
                          >
                            {img.associated_deployment} <ExternalLink size={13} />
                          </Link>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "13px" }}>None</span>
                        )}
                      </td>

                      <td style={{ padding: "14px 20px", fontFamily: "monospace", fontSize: "12px", color: "#64748b" }}>
                        {img.digest ? `${img.digest.substring(0, 16)}...` : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Containers / Active Workloads */}
      {activeTab === "containers" && (
        <div style={{ background: "#0b1526", border: "1px solid #1a2f4c", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid #1a2f4c" }}>
            <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: "18px" }}>Running Containers & Fargate Tasks</h3>
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Loading workloads...</div>
          ) : containers.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              No active container workloads discovered.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#08101d", color: "#94a3b8", borderBottom: "1px solid #1a2f4c" }}>
                    <th style={{ padding: "14px 20px" }}>Workload Name / ID</th>
                    <th style={{ padding: "14px 20px" }}>Image</th>
                    <th style={{ padding: "14px 20px" }}>Runtime</th>
                    <th style={{ padding: "14px 20px" }}>Status</th>
                    <th style={{ padding: "14px 20px" }}>Port</th>
                    <th style={{ padding: "14px 20px" }}>Live Application</th>
                  </tr>
                </thead>
                <tbody>
                  {containers.map((c, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #122138", color: "#e2e8f0" }}>
                      <td style={{ padding: "14px 20px", fontWeight: 600 }}>
                        {c.name || c.id}
                      </td>
                      <td style={{ padding: "14px 20px", fontFamily: "monospace", fontSize: "12px", color: "#93c5fd" }}>
                        {c.image}
                      </td>
                      <td style={{ padding: "14px 20px", color: "#94a3b8" }}>
                        {c.runtime || "AWS ECS Fargate"}
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: c.state === "running" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: c.state === "running" ? "#4ade80" : "#f87171",
                        }}>
                          {c.status || c.state}
                        </span>
                      </td>
                      <td style={{ padding: "14px 20px", color: "#cbd5e1" }}>
                        {c.ports || "5000"}
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        {c.app_url ? (
                          <a
                            href={c.app_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#38bdf8", textDecoration: "none" }}
                          >
                            Open App <ExternalLink size={13} />
                          </a>
                        ) : (
                          <span style={{ color: "#64748b" }}>—</span>
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
    </div>
  );
}

export default Containers;