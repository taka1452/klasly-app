"use client";

import { Search } from "lucide-react";

const DAYS = ["All", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SORT_OPTIONS = [
  { value: "custom", label: "Custom Order" },
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
  { value: "day", label: "Day of Week" },
  { value: "instructor", label: "Instructor" },
  { value: "newest", label: "Newest First" },
];

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  dayFilter: number | null;
  onDayFilterChange: (day: number | null) => void;
};

export default function ClassListToolbar({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  dayFilter,
  onDayFilterChange,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search classes..."
            className="input-field w-full pl-9"
          />
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="input-field w-full sm:w-48"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Day filter tabs */}
      <div className="flex flex-wrap gap-1">
        {DAYS.map((label, i) => {
          const dayValue = i === 0 ? null : i - 1; // 0=Mon ... 6=Sun
          const isActive = dayFilter === dayValue;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onDayFilterChange(dayValue)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                isActive
                  ? "bg-brand-100 text-brand-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
