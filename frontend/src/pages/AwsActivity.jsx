import { useEffect, useState } from "react";
import { Cloud, Database, RefreshCw, ShieldAlert } from "lucide-react";
import { getAwsEcr, getAwsImages, getAwsStatus } from "../services/api";
import "./AwsActivity.css";

function display(value) {
  return value === null || value === undefined || value === ""
    ? "N/A"
    : String(value);
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
}

function AwsActivity() {
  const [state, setState] = useState({
    loading: true,
    connected: false,
    status: null,
    repository: null,
    images: [],
    error: "",
    checkedAt: null,
  });

  async function refresh() {
    setState((previous) => ({ ...previous, loading: true, error: "" }));

    try {
      const status = await getAwsStatus();
      const [ecr, images] = await Promise.all([
        getAwsEcr(),
        getAwsImages(),
      ]);

      setState({
        loading: false,
        connected: true,
        status,
        repository: ecr.repository || null,
        images: Array.isArray(images.images) ? images.images : [],
        error: "",
        checkedAt: new Date(),
      });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        loading: false,
        connected: false,
        error: error.message || "Unable to connect to AWS.",
        checkedAt: new Date(),
      }));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const latest = state.repository?.latest_image || state.images[0];
  const statusLabel = state.loading
    ? "Checking..."
    : state.connected
      ? "Connected"
      : "Unavailable";

  return (
    <div className="aws-page">
      <div className="aws-page-header">
        <div>
          <div className="aws-section-label">AWS CLOUD INTEGRATION</div>
          <h1>AWS Activity</h1>
          <p>
            Monitor AWS identity access and the DevSecOps ECR repository.
          </p>
        </div>

        <button
          className="aws-refresh-button"
          onClick={refresh}
          disabled={state.loading}
        >
          <RefreshCw className={state.loading ? "aws-spin" : ""} size={18} />
          {state.loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {state.loading && (
        <div className="aws-connection-alert">
          <div className="aws-alert-content">
            <strong>Checking AWS...</strong>
            <span>Reading identity and Amazon ECR data.</span>
          </div>
        </div>
      )}

      {!state.loading && (
        <div className={`aws-connection-alert ${state.connected ? "aws-connected-alert" : ""}`}>
          <div className={`aws-alert-icon ${state.connected ? "aws-success-icon" : ""}`}>
            <ShieldAlert size={27} />
          </div>
          <div className="aws-alert-content">
            <strong>{state.connected ? "AWS connection established" : "AWS unavailable"}</strong>
            <span>{state.error || "AWS identity and ECR data are available."}</span>
          </div>
          <div className="aws-connection-status">
            <span>AWS CONNECTION</span>
            <strong className={state.connected ? "aws-connected" : "aws-disconnected"}>
              {statusLabel}
            </strong>
          </div>
        </div>
      )}

      <div className="aws-summary">
        <div className="aws-summary-card">
          <div className="aws-summary-icon blue"><Cloud size={25} /></div>
          <div className="aws-summary-content"><span>Account</span><strong>{display(state.status?.account_id)}</strong><small>AWS account</small></div>
        </div>
        <div className="aws-summary-card">
          <div className="aws-summary-icon green"><Cloud size={25} /></div>
          <div className="aws-summary-content"><span>Region</span><strong>{display(state.status?.region)}</strong><small>Asia Pacific (Mumbai)</small></div>
        </div>
        <div className="aws-summary-card">
          <div className="aws-summary-icon purple"><Database size={25} /></div>
          <div className="aws-summary-content"><span>Image Count</span><strong>{display(state.repository?.image_count)}</strong><small>Tagged ECR images</small></div>
        </div>
        <div className="aws-summary-card">
          <div className="aws-summary-icon orange"><Cloud size={25} /></div>
          <div className="aws-summary-content"><span>Last Check</span><strong>{state.checkedAt ? state.checkedAt.toLocaleTimeString() : "N/A"}</strong><small>{formatDate(state.checkedAt)}</small></div>
        </div>
      </div>

      <section className="aws-panel">
        <div className="aws-panel-header"><div><div className="aws-section-label">AMAZON ECR</div><h2>Repository Details</h2><p>Real-time information returned by the Flask AWS service.</p></div></div>
        <div className="aws-account-grid">
          <div className="aws-account-item"><span>SERVICE</span><strong>Amazon ECR</strong></div>
          <div className="aws-account-item"><span>REPOSITORY</span><strong>{display(state.repository?.name)}</strong></div>
          <div className="aws-account-item"><span>ECR URI</span><strong>{display(state.repository?.uri)}</strong></div>
          <div className="aws-account-item"><span>REPOSITORY ARN</span><strong>{display(state.repository?.arn)}</strong></div>
          <div className="aws-account-item"><span>SCAN ON PUSH</span><strong>{state.repository?.scan_on_push === null || state.repository?.scan_on_push === undefined ? "N/A" : state.repository.scan_on_push ? "Enabled" : "Disabled"}</strong></div>
          <div className="aws-account-item"><span>CREATED</span><strong>{formatDate(state.repository?.created_at)}</strong></div>
        </div>
      </section>

      <section className="aws-panel aws-image-panel">
        <div className="aws-panel-header"><div><div className="aws-section-label">IMAGE INVENTORY</div><h2>Latest Images</h2><p>Tags and metadata returned from Amazon ECR.</p></div><div className="aws-resource-count">{state.images.length} image{state.images.length === 1 ? "" : "s"}</div></div>
        {!state.images.length ? <div className="aws-empty"><Cloud size={36} /><h3>{state.loading ? "Loading images" : "No images found"}</h3><p>{state.loading ? "Reading the ECR repository." : "The repository has no tagged images available."}</p></div> : <div className="aws-image-list">{state.images.map((image) => <div className="aws-image-card" key={image.digest || image.tags.join(",")}><div className="aws-resource-icon"><Database size={22} /></div><div className="aws-resource-info"><h3>{image.tags.length ? image.tags.join(", ") : "Untagged image"}</h3><span>{display(image.digest)}</span></div><div className="aws-resource-location"><span>PUSHED</span><strong>{formatDate(image.pushed_at)}</strong></div><div className="aws-resource-status"><i />{latest?.digest === image.digest ? "Latest" : "Available"}</div></div>)}</div>}
      </section>

      <section className="aws-panel aws-security-panel">
        <div className="aws-section-label">SECURITY</div>
        <h2>AWS Authentication</h2>
        <p>GitHub Actions authenticates to AWS with OpenID Connect. No long-lived AWS credentials are stored in the pipeline.</p>
      </section>
    </div>
  );
}

export default AwsActivity;
