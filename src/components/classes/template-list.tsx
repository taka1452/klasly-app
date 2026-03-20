"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
  is_active: boolean;
  instructor_id: string | null;
  instructors: {
    id: string;
    profiles: { full_name: string } | null;
  } | null;
};

const CLASS_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  in_person: {
    label: "In-person",
    className:
      "bg-blue-50 text-blue-700 ring-blue-600/20",
  },
  online: {
    label: "Online",
    className:
      "bg-violet-50 text-violet-700 ring-violet-600/20",
  },
  hybrid: {
    label: "Hybrid",
    className:
      "bg-amber-50 text-amber-700 ring-amber-600/20",
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

export default function TemplateList() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => {
        const badge = CLASS_TYPE_BADGE[t.class_type] || CLASS_TYPE_BADGE.in_person;
        const instructorName = getInstructorName(t);

        return (
          <div
            key={t.id}
            className="card cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => router.push(`/classes/templates/${t.id}`)}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900 line-clamp-1">
                {t.name}
              </h3>
              {!t.is_active && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  Inactive
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span>{t.duration_minutes} min</span>
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
                  router.push(`/classes/templates/${t.id}/schedule`);
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
  );
}
