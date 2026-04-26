"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import ContextHelpLink from "@/components/help/context-help-link";

type Campaign = {
  id: string;
  subject: string;
  status: string;
  sent_at: string | null;
  sent_count: number;
  created_at: string;
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Email Campaigns</h1>
            <ContextHelpLink href="/help/messaging/studio-announcements" />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Send emails to your members
          </p>
        </div>
        <Link href="/campaigns/new" className="btn-primary">
          New Campaign
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="card">
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="card">
            <p className="text-sm text-gray-500">
              No campaigns yet. Create your first email campaign to reach your members.
            </p>
          </div>
        ) : (
          campaigns.map((c) => (
            <div key={c.id} className="card flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{c.subject}</h3>
                <p className="text-sm text-gray-500">
                  {formatDate(c.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.status === "sent"
                      ? "bg-green-100 text-green-700"
                      : c.status === "sending"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {c.status === "sent" ? `Sent (${c.sent_count})` : c.status === "sending" ? "Sending..." : "Draft"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
