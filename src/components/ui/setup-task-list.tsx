"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STORAGE_KEY = "klasly-setup-checklist-dismissed";

export type SetupTask = {
  id: string;
  label: string;
  done: boolean;
  href?: string | null;
  /** Short hint shown under the label */
  hint?: string | null;
};

type SetupTaskListProps = {
  tasks: SetupTask[];
  title?: string;
};

export default function SetupTaskList({
  tasks,
  title = "Setup checklist",
}: SetupTaskListProps) {
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    setMounted(true);
  }, []);

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const allDone = tasks.every((t) => t.done);
  if (tasks.length === 0 || !mounted || dismissed) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9990] w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
      aria-label={title}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          {allDone ? "All set!" : title}
        </h3>
        <button
          type="button"
          onClick={handleClose}
          className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Close checklist"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <ul className="space-y-3">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs"
              aria-hidden
            >
              {task.done ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </span>
              ) : (
                <span className="h-5 w-5 rounded-full border-2 border-gray-300" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              {task.href && !task.done ? (
                <Link
                  href={task.href}
                  className="text-sm font-medium text-gray-700 hover:text-indigo-600 hover:underline"
                >
                  {task.label}
                </Link>
              ) : (
                <span
                  className={`text-sm font-medium ${task.done ? "text-gray-500 line-through" : "text-gray-700"}`}
                >
                  {task.label}
                </span>
              )}
              {task.hint && (
                <p className="mt-0.5 text-xs text-gray-500">{task.hint}</p>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
