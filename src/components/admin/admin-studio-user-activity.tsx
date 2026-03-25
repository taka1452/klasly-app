"use client";

import { useState, useEffect } from "react";
import { useAdminLocale } from "@/lib/admin/locale-context";

type UserActivity = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  last_sign_in_at: string | null;
  status: "active" | "inactive" | "dormant";
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-green-500/20", text: "text-green-400" },
  inactive: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  dormant: { bg: "bg-red-500/20", text: "text-red-400" },
};

export default function AdminStudioUserActivity({
  studioId,
}: {
  studioId: string;
}) {
  const { t, formatDateTime } = useAdminLocale();
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/studios/${studioId}/users-activity`)
      .then((r) => r.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [studioId]);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
      <h2 className="text-lg font-semibold text-white">
        {t("studioDetail.userActivity")}
      </h2>

      {loading ? (
        <p className="mt-4 text-sm text-slate-400">Loading...</p>
      ) : users.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          {t("studioDetail.noStaff")}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Email</th>
                <th className="pb-2 pr-4 font-medium">Role</th>
                <th className="pb-2 pr-4 font-medium">
                  {t("studioDetail.lastLogin")}
                </th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const style = STATUS_STYLES[u.status] ?? STATUS_STYLES.dormant;
                return (
                  <tr
                    key={u.id}
                    className="border-b border-slate-700/50 last:border-0"
                  >
                    <td className="py-2.5 pr-4 text-white">
                      {u.full_name || "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-300">
                      {u.email || "—"}
                    </td>
                    <td className="py-2.5 pr-4 capitalize text-slate-300">
                      {u.role}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-300">
                      {u.last_sign_in_at
                        ? formatDateTime(u.last_sign_in_at)
                        : t("studioDetail.never")}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
                      >
                        {t(`studioDetail.${u.status}`)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
