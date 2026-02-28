import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import Link from "next/link";

const LIMIT = 50;

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; type?: string }>;
}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { tab = "webhooks", page = "1", type } = await searchParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const offset = (pageNum - 1) * LIMIT;

  const currentTab = ["webhooks", "cron", "email"].includes(tab) ? tab : "webhooks";

  let webhooks: { id: string; event_type: string; event_id: string | null; studio_id: string | null; status: string; error_message: string | null; created_at: string }[] = [];
  let webhookTotal = 0;
  let crons: { id: string; job_name: string; status: string; affected_count: number; error_message: string | null; started_at: string; completed_at: string | null }[] = [];
  let cronTotal = 0;
  let emails: { id: string; studio_id: string | null; to_email: string; template: string; subject: string | null; status: string; created_at: string }[] = [];
  let emailTotal = 0;

  if (currentTab === "webhooks") {
    let q = supabase
      .from("webhook_logs")
      .select("id, event_type, event_id, studio_id, status, error_message, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + LIMIT - 1);
    if (type) q = q.eq("event_type", type);
    const { data, count } = await q;
    webhooks = (data || []) as typeof webhooks;
    webhookTotal = count ?? 0;
  } else if (currentTab === "cron") {
    const { data, count } = await supabase
      .from("cron_logs")
      .select("id, job_name, status, affected_count, error_message, started_at, completed_at", { count: "exact" })
      .order("started_at", { ascending: false })
      .range(offset, offset + LIMIT - 1);
    crons = (data || []) as typeof crons;
    cronTotal = count ?? 0;
  } else {
    let q = supabase
      .from("email_logs")
      .select("id, studio_id, to_email, template, subject, status, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + LIMIT - 1);
    if (type) q = q.eq("template", type);
    const { data, count } = await q;
    emails = (data || []) as typeof emails;
    emailTotal = count ?? 0;
  }

  const { data: webhookTypes } = await supabase.from("webhook_logs").select("event_type");
  const eventTypes = Array.from(new Set((webhookTypes || []).map((r) => r.event_type))).sort();

  const { data: emailTemplates } = await supabase.from("email_logs").select("template");
  const templates = Array.from(new Set((emailTemplates || []).map((r) => r.template))).sort();

  const studioIds = Array.from(
    new Set([
      ...webhooks.map((w) => w.studio_id).filter(Boolean),
      ...emails.map((e) => e.studio_id).filter(Boolean),
    ])
  ) as string[];
  const { data: studios } =
    studioIds.length > 0 ? await supabase.from("studios").select("id, name").in("id", studioIds) : { data: [] };
  const studioNames = (studios || []).reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {} as Record<string, string>);

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const baseUrl = "/admin/logs";
  const tabLink = (t: string) => `${baseUrl}?tab=${t}${type ? `&type=${encodeURIComponent(type)}` : ""}`;
  const pageLink = (p: number) => `${baseUrl}?tab=${currentTab}&page=${p}${type ? `&type=${encodeURIComponent(type)}` : ""}`;
  const typeLink = (typeValue: string) => `${baseUrl}?tab=${currentTab}&type=${encodeURIComponent(typeValue)}`;
  const totalPages = (total: number) => Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Logs</h1>
      <p className="text-slate-400">Webhooks, cron jobs, and email delivery</p>

      <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-2">
        <Link
          href={tabLink("webhooks")}
          className={`rounded px-3 py-1.5 text-sm font-medium ${currentTab === "webhooks" ? "bg-slate-600 text-white" : "text-slate-400 hover:bg-slate-700 hover:text-white"}`}
        >
          Webhooks
        </Link>
        <Link
          href={tabLink("cron")}
          className={`rounded px-3 py-1.5 text-sm font-medium ${currentTab === "cron" ? "bg-slate-600 text-white" : "text-slate-400 hover:bg-slate-700 hover:text-white"}`}
        >
          Cron
        </Link>
        <Link
          href={tabLink("email")}
          className={`rounded px-3 py-1.5 text-sm font-medium ${currentTab === "email" ? "bg-slate-600 text-white" : "text-slate-400 hover:bg-slate-700 hover:text-white"}`}
        >
          Email
        </Link>
      </div>

      {currentTab === "webhooks" && (
        <>
          {eventTypes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-slate-400">Filter by event:</span>
              <Link href={baseUrl + "?tab=webhooks"} className="rounded bg-slate-700 px-2 py-0.5 text-sm text-slate-300 hover:bg-slate-600">All</Link>
              {eventTypes.map((et) => (
                <Link key={et} href={typeLink(et)} className={`rounded px-2 py-0.5 text-sm ${type === et ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
                  {et}
                </Link>
              ))}
            </div>
          )}
          <div className="rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600 bg-slate-900/50 text-left text-slate-400">
                    <th className="p-3">Time</th>
                    <th className="p-3">Event</th>
                    <th className="p-3">Event ID</th>
                    <th className="p-3">Studio</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.length === 0 ? (
                    <tr><td colSpan={6} className="p-4 text-slate-500">No webhook logs</td></tr>
                  ) : (
                    webhooks.map((w) => (
                      <tr key={w.id} className="border-b border-slate-700">
                        <td className="p-3 text-slate-300">{formatDate(w.created_at)}</td>
                        <td className="p-3 text-white">{w.event_type}</td>
                        <td className="p-3 text-slate-400 font-mono text-xs">{w.event_id ?? "—"}</td>
                        <td className="p-3 text-slate-300">{w.studio_id ? (studioNames[w.studio_id] ?? w.studio_id) : "—"}</td>
                        <td className="p-3"><span className={w.status === "success" ? "text-green-400" : "text-red-400"}>{w.status}</span></td>
                        <td className="p-3 text-red-300 text-xs max-w-[200px] truncate" title={w.error_message ?? ""}>{w.error_message ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {webhookTotal > LIMIT && (
              <div className="flex items-center justify-between border-t border-slate-700 px-3 py-2 text-sm text-slate-400">
                <span>Total {webhookTotal}</span>
                <div className="flex gap-2">
                  {pageNum > 1 && <Link href={pageLink(pageNum - 1)} className="text-indigo-400 hover:underline">Previous</Link>}
                  {pageNum < totalPages(webhookTotal) && <Link href={pageLink(pageNum + 1)} className="text-indigo-400 hover:underline">Next</Link>}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {currentTab === "cron" && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600 bg-slate-900/50 text-left text-slate-400">
                  <th className="p-3">Started</th>
                  <th className="p-3">Job</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Affected</th>
                  <th className="p-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {crons.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-slate-500">No cron logs</td></tr>
                ) : (
                  crons.map((c) => (
                    <tr key={c.id} className="border-b border-slate-700">
                      <td className="p-3 text-slate-300">{formatDate(c.started_at)}</td>
                      <td className="p-3 text-white">{c.job_name}</td>
                      <td className="p-3"><span className={c.status === "success" ? "text-green-400" : "text-red-400"}>{c.status}</span></td>
                      <td className="p-3 text-slate-300">{c.affected_count ?? 0}</td>
                      <td className="p-3 text-red-300 text-xs max-w-[200px] truncate" title={c.error_message ?? ""}>{c.error_message ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {cronTotal > LIMIT && (
            <div className="flex items-center justify-between border-t border-slate-700 px-3 py-2 text-sm text-slate-400">
              <span>Total {cronTotal}</span>
              <div className="flex gap-2">
                {pageNum > 1 && <Link href={pageLink(pageNum - 1)} className="text-indigo-400 hover:underline">Previous</Link>}
                {pageNum < totalPages(cronTotal) && <Link href={pageLink(pageNum + 1)} className="text-indigo-400 hover:underline">Next</Link>}
              </div>
            </div>
          )}
        </div>
      )}

      {currentTab === "email" && (
        <>
          {templates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-slate-400">Filter by template:</span>
              <Link href={baseUrl + "?tab=email"} className="rounded bg-slate-700 px-2 py-0.5 text-sm text-slate-300 hover:bg-slate-600">All</Link>
              {templates.map((tpl) => (
                <Link key={tpl} href={typeLink(tpl)} className={`rounded px-2 py-0.5 text-sm ${type === tpl ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
                  {tpl}
                </Link>
              ))}
            </div>
          )}
          <div className="rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600 bg-slate-900/50 text-left text-slate-400">
                    <th className="p-3">Time</th>
                    <th className="p-3">To</th>
                    <th className="p-3">Template</th>
                    <th className="p-3">Subject</th>
                    <th className="p-3">Studio</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.length === 0 ? (
                    <tr><td colSpan={6} className="p-4 text-slate-500">No email logs</td></tr>
                  ) : (
                    emails.map((e) => (
                      <tr key={e.id} className="border-b border-slate-700">
                        <td className="p-3 text-slate-300">{formatDate(e.created_at)}</td>
                        <td className="p-3 text-white">{e.to_email}</td>
                        <td className="p-3 text-slate-300">{e.template}</td>
                        <td className="p-3 text-slate-400 max-w-[180px] truncate" title={e.subject ?? ""}>{e.subject ?? "—"}</td>
                        <td className="p-3 text-slate-300">{e.studio_id ? (studioNames[e.studio_id] ?? e.studio_id) : "—"}</td>
                        <td className="p-3"><span className={e.status === "sent" ? "text-green-400" : "text-red-400"}>{e.status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {emailTotal > LIMIT && (
              <div className="flex items-center justify-between border-t border-slate-700 px-3 py-2 text-sm text-slate-400">
                <span>Total {emailTotal}</span>
                <div className="flex gap-2">
                  {pageNum > 1 && <Link href={pageLink(pageNum - 1)} className="text-indigo-400 hover:underline">Previous</Link>}
                  {pageNum < totalPages(emailTotal) && <Link href={pageLink(pageNum + 1)} className="text-indigo-400 hover:underline">Next</Link>}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
