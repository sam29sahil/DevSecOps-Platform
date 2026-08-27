import { useEffect, useState } from "react";
import {
  Cloud,
  Database,
  Activity,
  Wifi,
  ShieldAlert,
  RefreshCw,
  Server,
} from "lucide-react";
import "./AzureActivity.css";

function AzureActivity() {
  const [loading, setLoading] = useState(false);

  const [azure, setAzure] = useState({
    connected: false,
    subscription: null,
    resources: [],
    resourceTypes: [],
    environment: "AzureCloud",
    error: "Azure CLI was not found.",
  });

  async function loadAzure() {
    try {
      setLoading(true);

      const response = await fetch(
        "http://127.0.0.1:5000/api/azure"
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to connect to Azure."
        );
      }

      setAzure({
        connected: data.connected ?? true,
        subscription: data.subscription ?? null,
        resources: data.resources ?? [],
        resourceTypes: data.resource_types ?? [],
        environment: data.environment || "AzureCloud",
        error: data.error || "",
      });
    } catch (error) {
      setAzure((previous) => ({
        ...previous,
        connected: false,
        error: error.message || "Azure connection unavailable.",
      }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAzure();
  }, []);

  const subscriptionName =
    azure.subscription?.name || "Unknown";

  const subscriptionId =
    azure.subscription?.id || "—";

  const tenantId =
    azure.subscription?.tenantId || "—";

  const status =
    azure.subscription?.state || "—";

  return (
    <div className="azure-page">

      {/* HEADER */}
      <div className="azure-page-header">

        <div>
          <div className="azure-section-label">
            AZURE CLOUD SECURITY
          </div>

          <h1>Azure Activity</h1>

          <p>
            Monitor your Azure subscription, infrastructure
            resources, and cloud environment status.
          </p>
        </div>

        <button
          className="azure-refresh-button"
          onClick={loadAzure}
          disabled={loading}
        >
          <RefreshCw
            size={18}
            className={loading ? "azure-spin" : ""}
          />

          {loading ? "Refreshing..." : "Refresh"}
        </button>

      </div>

      {/* CONNECTION */}
      {!azure.connected && (
        <div className="azure-connection-alert">

          <div className="azure-alert-icon">
            <ShieldAlert size={27} />
          </div>

          <div className="azure-alert-content">
            <strong>
              Azure connection unavailable
            </strong>

            <span>
              {azure.error || "Azure CLI was not found."}
            </span>
          </div>

          <div className="azure-connection-status">

            <div className="azure-status-icon">
              <ShieldAlert size={21} />
            </div>

            <div>
              <span>AZURE CONNECTION</span>

              <strong className="azure-disconnected">
                Disconnected
              </strong>

              <small>OFFLINE</small>
            </div>

          </div>

        </div>
      )}

      {/* CONNECTED */}
      {azure.connected && (
        <div className="azure-connection-alert azure-connected-alert">

          <div className="azure-alert-icon azure-success-icon">
            <ShieldAlert size={27} />
          </div>

          <div className="azure-alert-content">
            <strong>
              Azure connection established
            </strong>

            <span>
              Azure subscription information is available.
            </span>
          </div>

          <div className="azure-connection-status">

            <div className="azure-status-icon">
              <ShieldAlert size={21} />
            </div>

            <div>
              <span>AZURE CONNECTION</span>

              <strong className="azure-connected">
                Connected
              </strong>

              <small>ONLINE</small>
            </div>

          </div>

        </div>
      )}

      {/* SUMMARY */}
      <div className="azure-summary">

        {/* SUBSCRIPTION */}
        <div className="azure-summary-card">

          <div className="azure-summary-icon blue">
            <Cloud size={25} />
          </div>

          <div className="azure-summary-content">
            <span>Subscription</span>

            <strong>
              {subscriptionName}
            </strong>

            <small>
              {subscriptionId}
            </small>
          </div>

        </div>

        {/* RESOURCES */}
        <div className="azure-summary-card">

          <div className="azure-summary-icon green">
            <Server size={25} />
          </div>

          <div className="azure-summary-content">
            <span>Resources</span>

            <strong>
              {azure.resources.length}
            </strong>

            <small>
              Azure resources
            </small>
          </div>

        </div>

        {/* RESOURCE TYPES */}
        <div className="azure-summary-card">

          <div className="azure-summary-icon purple">
            <Activity size={25} />
          </div>

          <div className="azure-summary-content">
            <span>Resource Types</span>

            <strong>
              {azure.resourceTypes.length}
            </strong>

            <small>
              Infrastructure categories
            </small>
          </div>

        </div>

        {/* ENVIRONMENT */}
        <div className="azure-summary-card">

          <div className="azure-summary-icon orange">
            <Wifi size={25} />
          </div>

          <div className="azure-summary-content">
            <span>Environment</span>

            <strong>
              {azure.environment}
            </strong>

            <small>
              Cloud environment
            </small>
          </div>

        </div>

      </div>

      {/* AZURE ENVIRONMENT */}
      <section className="azure-panel">

        <div className="azure-panel-header">

          <div>
            <div className="azure-section-label">
              SUBSCRIPTION
            </div>

            <h2>Azure Environment</h2>

            <p>
              Current Azure account and subscription
              information.
            </p>
          </div>

        </div>

        <div className="azure-account-grid">

          <div className="azure-account-item">
            <span>SUBSCRIPTION NAME</span>
            <strong>{subscriptionName}</strong>
          </div>

          <div className="azure-account-item">
            <span>SUBSCRIPTION ID</span>
            <strong>{subscriptionId}</strong>
          </div>

          <div className="azure-account-item">
            <span>TENANT ID</span>
            <strong>{tenantId}</strong>
          </div>

          <div className="azure-account-item">
            <span>STATUS</span>
            <strong>{status}</strong>
          </div>

        </div>

      </section>

      {/* RESOURCE INVENTORY */}
      <section className="azure-panel azure-resource-panel">

        <div className="azure-panel-header">

          <div>
            <div className="azure-section-label">
              RESOURCE INVENTORY
            </div>

            <h2>Azure Resources</h2>

            <p>
              Resources available in your Azure
              subscription.
            </p>
          </div>

          <div className="azure-resource-count">
            {azure.resources.length} resource
            {azure.resources.length === 1 ? "" : "s"}
          </div>

        </div>

        {azure.resources.length === 0 ? (

          <div className="azure-empty">

            <div className="azure-empty-icon">
              <Cloud size={36} />
            </div>

            <h3>
              No Azure resources found
            </h3>

            <p>
              Your Azure subscription currently has no
              resources available to display.
            </p>

            <small>
              Resources will appear here after they are
              created or deployed.
            </small>

          </div>

        ) : (

          <div className="azure-resource-list">

            {azure.resources.map((resource, index) => (

              <div
                className="azure-resource-card"
                key={
                  resource.id ||
                  resource.name ||
                  index
                }
              >

                <div className="azure-resource-icon">
                  <Database size={22} />
                </div>

                <div className="azure-resource-info">

                  <h3>
                    {resource.name || "Unnamed Resource"}
                  </h3>

                  <span>
                    {resource.type || "Unknown type"}
                  </span>

                </div>

                <div className="azure-resource-location">
                  <span>LOCATION</span>
                  <strong>
                    {resource.location || "—"}
                  </strong>
                </div>

                <div className="azure-resource-status">
                  <i></i>
                  Available
                </div>

              </div>

            ))}

          </div>

        )}

      </section>

    </div>
  );
}

export default AzureActivity;