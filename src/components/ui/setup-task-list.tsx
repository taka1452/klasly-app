"use client";

import Link from "next/link";

export type SetupTask = {
  id: string;
  label: string;
  done: boolean;
  href?: string | null;
};

type SetupTaskListProps = {
  tasks: SetupTask[];
  title?: string;
};

export default function SetupTaskList({
  tasks,
  title = "Setup checklist",
}: SetupTaskListProps) {
  const allDone = tasks.every((t) => t.done);
  if (tasks.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9990] w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
      aria-label={title}
    >
      <h3 className="mb-3 text-sm font-semibold text-gray-900">
        {allDone ? "All set!" : title}
      </h3>
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-3">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs"
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
            {task.href && !task.done ? (
              <Link
                href={task.href}
                className="text-sm text-gray-700 hover:text-indigo-600 hover:underline"
              >
                {task.label}
              </Link>
            ) : (
              <span
                className={`text-sm ${task.done ? "text-gray-500 line-through" : "text-gray-700"}`}
              >
                {task.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
