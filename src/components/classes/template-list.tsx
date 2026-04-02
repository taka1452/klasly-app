"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/utils";
import ClassListToolbar from "./class-list-toolbar";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  image_url: string | null;
  sort_order?: number;
  is_active: boolean;
  instructor_id: string | null;
  created_at: string;
  instructors: {
    id: string;
    profiles: { full_name: string } | null;
  } | null;
  schedule_days?: number[];
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
  return template.schedule_days || [];
}

// Sortable card wrapper with drag handle
function SortableCard({
  template,
  children,
}: {
  template: Template;
  children: (handleProps: {
    listeners: ReturnType<typeof useSortable>["listeners"];
    attributes: ReturnType<typeof useSortable>["attributes"];
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: template.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ listeners, attributes })}
    </div>
  );
}

export default function TemplateList() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("custom");
  const [dayFilter, setDayFilter] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

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

  const isDragEnabled = sortBy === "custom" && !search.trim() && dayFilter === null;

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

    // Sort (custom = server order, no re-sort needed)
    if (sortBy !== "custom") {
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
    }

    return result;
  }, [templates, search, sortBy, dayFilter]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = templates.findIndex((t) => t.id === active.id);
    const newIndex = templates.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(templates, oldIndex, newIndex);
    setTemplates(reordered);

    // Persist to server
    const updates = reordered.map((t, i) => ({ id: t.id, sort_order: i + 1 }));
    try {
      await fetch("/api/class-templates/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
    } catch {
      // Revert on error
      setTemplates(templates);
    }
  }

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
      <div className="card py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
          <svg className="h-7 w-7 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-800">No classes yet</h3>
        <p className="mt-1 text-sm text-gray-500 mx-auto max-w-sm">
          Create a class template to define the name, duration, capacity, and instructor. Then schedule sessions from it.
        </p>
        <a href="/classes/new" className="btn-primary mt-5 inline-flex">
          + New Template
        </a>
      </div>
    );
  }

  function renderCard(
    t: Template,
    dragHandle?: {
      listeners: ReturnType<typeof useSortable>["listeners"];
      attributes: ReturnType<typeof useSortable>["attributes"];
    }
  ) {
    const badge = CLASS_TYPE_BADGE[t.class_type] || CLASS_TYPE_BADGE.in_person;
    const instructorName = getInstructorName(t);

    return (
      <div
        className="card relative flex cursor-pointer transition-shadow hover:shadow-md"
        onClick={() => router.push(`/classes/${t.id}`)}
      >
        <div className="flex-1 min-w-0">
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
                router.push(`/calendar/${t.id}`);
              }}
              className="btn-secondary text-xs"
            >
              Schedule
            </button>
          </div>
        </div>

        {/* Drag handle */}
        {dragHandle && (
          <div
            className="flex w-8 shrink-0 touch-none items-center justify-center border-l border-gray-100 ml-3 -mr-2 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"
            onClick={(e) => e.stopPropagation()}
            {...dragHandle.attributes}
            {...dragHandle.listeners}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
            </svg>
          </div>
        )}
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
      ) : isDragEnabled ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filtered.map((t) => t.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => (
                <SortableCard key={t.id} template={t}>
                  {(handleProps) => renderCard(t, handleProps)}
                </SortableCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.id}>{renderCard(t)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
