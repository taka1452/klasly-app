"use client";

import { useCallback, useEffect, useState } from "react";

type Connection = {
  id: string;
  provider: string;
  status: "pending" | "connected" | "disconnected" | "error" | string;
  connected_email: string | null;
  scopes: string[];
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ProviderDef = {
  id: string;
  name: string;
  description: string;
  /** Accent background color for the provider tile (CSS color). */
  accent: string;
  /** Two-letter abbreviation rendered on the tile. */
  abbr: string;
  scopes: string[];
  docsHref: string;
};

const PROVIDERS: ProviderDef[] = [
  {
    id: "google",
    name: "Google Workspace",
    description:
      "Sync Google Calendar for classes & events. Track Google Pay / Wallet subscriptions against library memberships by matching member email.",
    accent: "#fbbc05",
    abbr: "G",
    scopes: ["calendar.readonly", "calendar.events", "userinfo.email"],
    docsHref: "/help/integrations/google",
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description:
      "Sync members to a Mailchimp audience automatically as they join or cancel.",
    accent: "#ffe01b",
    abbr: "M",
    scopes: ["audiences.readwrite"],
    docsHref: "/help/integrations/mailchimp",
  },
  {
    id: "zoom",
    name: "Zoom",
    description:
      "Host hybrid classes and auto-generate meeting links when a session is scheduled.",
    accent: "#2d8cff",
    abbr: "Z",
    scopes: ["meeting:write"],
    docsHref: "/help/integrations/zoom",
  },
];

export default function IntegrationsClient() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/integrations");
    setLoading(false);
    if (res.ok) setConnections(await res.json());
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  async function connect(provider: ProviderDef) {
    setBusy(provider.id);
    setError(null);
    setNotice(null);
    // First-pass: mark it "pending" so the studio can see it's a known state.
    // A real OAuth round-trip will flip status to "connected" with a real
    // access token; we leave that for a per-provider /auth/<provider> route.
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: provider.id,
        status: "pending",
        scopes: provider.scopes,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to start connection");
      return;
    }
    setNotice(
      `${provider.name} is queued. We'll email your owner when the OAuth handshake completes.`
    );
    await fetchConnections();
  }

  async function disconnect(provider: ProviderDef) {
    if (!confirm(`Disconnect ${provider.name}?`)) return;
    setBusy(provider.id);
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: provider.id, status: "disconnected" }),
    });
    setBusy(null);
    if (res.ok) {
      setNotice(`${provider.name} disconnected.`);
      await fetchConnections();
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {notice}
        </div>
      )}

      <div className="space-y-3">
        {PROVIDERS.map((p) => {
          const conn = byProvider.get(p.id);
          const status = conn?.status || "not_connected";
          const connected = status === "connected";
          return (
            <div
              key={p.id}
              className="card flex flex-wrap items-center gap-4"
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold text-white ring-1 ring-black/5"
                style={{ background: p.accent }}
              >
                {p.abbr}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{p.name}</h3>
                  <StatusBadge status={status} />
                </div>
                <p className="mt-1 text-xs text-gray-500">{p.description}</p>
                {conn?.connected_email && (
                  <p className="mt-1 text-[11px] text-gray-400">
                    Connected as {conn.connected_email}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {connected ? (
                  <button
                    type="button"
                    onClick={() => disconnect(p)}
                    disabled={busy === p.id}
                    className="btn-secondary"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => connect(p)}
                    disabled={busy === p.id || loading}
                    className="btn-primary"
                  >
                    {status === "pending" ? "Queued — retry" : `Connect ${p.name.split(" ")[0]}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    connected: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    disconnected: "bg-gray-100 text-gray-600",
    error: "bg-red-100 text-red-600",
    not_connected: "bg-gray-100 text-gray-500",
  };
  const label: Record<string, string> = {
    connected: "Connected",
    pending: "Pending",
    disconnected: "Disconnected",
    error: "Error",
    not_connected: "Not connected",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status] ?? styles.not_connected}`}
    >
      {label[status] ?? status}
    </span>
  );
}
