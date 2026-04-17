"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { HelpCircle, X, CheckCircle2, ListChecks, PartyPopper } from "lucide-react";

const STORAGE_KEY = "klasly-setup-checklist-dismissed";

export type SetupTask = {
  id: string;
  label: string;
  done: boolean;
  href?: string | null;
  /** Short hint shown under the label */
  hint?: string | null;
  /** Link to help article */
  helpHref?: string | null;
};

type SetupTaskListProps = {
  tasks: SetupTask[];
  title?: string;
  /** Optional link to a full setup-guide page (rendered as a footer link). */
  guideHref?: string | null;
  /** Label for the guide link. */
  guideLabel?: string;
};

export default function SetupTaskList({
  tasks,
  title = "Set up your studio",
  guideHref = null,
  guideLabel = "View full setup guide",
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

  const handleReopen = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setDismissed(false);
  };

  const doneCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;
  const allDone = doneCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (tasks.length === 0 || !mounted) return null;

  // Dismissed but not all done: show floating reopen button
  if (dismissed && !allDone) {
    return (
      <button
        type="button"
        onClick={handleReopen}
        className="fixed bottom-6 right-6 z-[9990] flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 transition-colors"
        aria-label="Open setup checklist"
        title={`Setup: ${doneCount}/${totalCount} complete`}
      >
        <ListChecks className="h-5 w-5" />
        {/* Badge with remaining count */}
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {totalCount - doneCount}
        </span>
      </button>
    );
  }

  // All done and dismissed: show nothing
  if (dismissed && allDone) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9990] w-[340px] rounded-xl border border-gray-200 bg-white shadow-lg"
      aria-label={title}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">
            {allDone ? "You're all set!" : title}
          </h3>
          {!allDone && (
            <p className="text-xs text-gray-500 mt-0.5">
              {doneCount} of {totalCount} complete
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close checklist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      {!allDone && (
        <div className="mx-5 mb-3">
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* All done celebration */}
      {allDone ? (
        <div className="px-5 pb-5">
          <div className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 p-4">
            <PartyPopper className="h-8 w-8 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800">
                Your studio is ready!
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Members can now book classes and make payments.
              </p>
            </div>
          </div>
          <Link
            href="/settings/features"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Explore more features
          </Link>
        </div>
      ) : (
        /* Task list */
        <>
        <ul className="px-5 pb-1 space-y-1">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-start gap-3 py-2">
              {/* Checkmark */}
              <span className="mt-0.5 flex-shrink-0">
                {task.done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300" />
                )}
              </span>

              {/* Task content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {task.href && !task.done ? (
                    <Link
                      href={task.href}
                      className="text-sm font-medium text-gray-700 hover:text-brand-600 hover:underline"
                    >
                      {task.label}
                    </Link>
                  ) : (
                    <span
                      className={`text-sm font-medium ${
                        task.done ? "text-gray-400 line-through" : "text-gray-700"
                      }`}
                    >
                      {task.label}
                    </span>
                  )}
                  {/* Help link */}
                  {task.helpHref && !task.done && (
                    <Link
                      href={task.helpHref}
                      title="Learn how"
                      className="text-gray-300 hover:text-brand-500 transition-colors"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
                {task.hint && !task.done && (
                  <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
                    {task.hint}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
        {guideHref && (
          <div className="border-t border-gray-100 px-5 py-3">
            <Link
              href={guideHref}
              className="flex items-center justify-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              {guideLabel} &rarr;
            </Link>
          </div>
        )}
        </>
      )}
    </div>
  );
}
