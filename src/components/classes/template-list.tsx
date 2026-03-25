"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/utils";
import ClassListToolbar from "./class-list-toolbar";

type Template = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  capacity: number;
  price_cents: number | null;
  class_type: "in_person" | "online" | "hybrid";
  location: string | null;
  online_link: string | null;
  is_public: boolean;
  image_url: string | null;
  is_active: boolean;
  instructor_id: string | null;
  created_at: string;
  instructors: {
    id: string;
    profiles: { full_name: string } | null;
  } | null;
  classes?: { day_of_week: number }[];
};

const CLASS_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  in_person: {
    label: "In-person",
    className: "bg-blue-50 text-blue-700 ring-blue-600/20",
  },
  online: {
    label: "Online",
    className: "bg-violet-50 text-violet-700 ring-violet-600/20",
  },
  hybrid: {
    label: "Hybrid",
    className: "bg-amber-50 text-amber-700 ring-amber-600/20",
  },
};

function formatPrice(cents: number | null): string {
  if (cents === null || cents === undefined) return "Free";
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

function getInstructorName(template: Template): string | null {
  if (!template.instructors) return null;
  const profiles = template.instructors.profiles;
  if (!profiles) return null;
  const raw = Array.isArray(profiles) ? profiles[0] : profiles;
  return raw?.full_name || null;
}

function getScheduledDays(template: Template): number[] {
  if (!template.classes || !Array.isArray(template.classes)) return [];
  const days = new Set(template.classes.map((c) => c.day_of_week));
  return Array.from(days).sort();
}

export default function TemplateList() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [dayFilter, setDayFilter] = useState<number | null>(null);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch("/api/class-templates");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch templates");
        }
        const data: Template[] = await res.json();
        setTemplates(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load templates");
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  const filtered = useMemo(() => {
    let result = [...templates];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) => {
        const name = t.name.toLowerCase();
        const instructor = getInstructorName(t)?.toLowerCase() || "";
        return name.includes(q) || instructor.includes(q);
      });
    }

    // Day filter
    if (dayFilter !== null) {
      result = result.filter((t) => {
        const days = getScheduledDays(t);
        return days.includes(dayFilter);
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "day": {
          const aDays = getScheduledDays(a);
          const bDays = getScheduledDays(b);
          const aMin = aDays.length > 0 ? Math.min(...aDays) : 99;
          const bMin = bDays.length > 0 ? Math.min(...bDays) : 99;
          return aMin - bMin || a.name.localeCompare(b.name);
        }
        case "instructor": {
          const aInstr = getInstructorName(a) || "zzz";
          const bInstr = getInstructorName(b) || "zzz";
          return aInstr.localeCompare(bInstr);
        }
        case "newest":
          return (b.created_at || "").localeCompare(a.created_at || "");
        default:
          return 0;
      }
    });

    return result;
  }, [templates, search, sortBy, dayFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">No templates yet. Create one to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ClassListToolbar
        search={search}
        onSearchChange={setSearch}
        sortBy={sortBy}
        onSortChange={setSortBy}
        dayFilter={dayFilter}
        onDayFilterChange={setDayFilter}
      />

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No classes found matching your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const badge = CLASS_TYPE_BADGE[t.class_type] || CLASS_TYPE_BADGE.in_person;
            const instructorName = getInstructorName(t);

            return (
              <div
                key={t.id}
                className="card cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push(`/classes/${t.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {t.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      </div>
                    )}
                    <h3 className="text-base font-semibold text-gray-900 line-clamp-1">
                      {t.name}
                    </h3>
                  </div>
                  {!t.is_active && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span>{formatDuration(t.duration_minutes)}</span>
                  <span className="text-gray-300">|</span>
                  <span>{formatPrice(t.price_cents)}</span>
                  <span className="text-gray-300">|</span>
                  <span>{t.capacity} spots</span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  {instructorName && (
                    <span className="text-xs text-gray-500">{instructorName}</span>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span
                    className={`text-xs font-medium ${
                      t.is_active ? "text-green-600" : "text-gray-400"
                    }`}
                  >
                    {t.is_active ? "Active" : "Inactive"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/classes/${t.id}/schedule`);
                    }}
                    className="btn-secondary text-xs"
                  >
                    Schedule
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
