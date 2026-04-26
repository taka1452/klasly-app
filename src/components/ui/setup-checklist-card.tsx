import Link from "next/link";
import { HelpCircle } from "lucide-react";
import type { SetupTask } from "./setup-task-list";

type Props = {
  tasks: SetupTask[];
  guideHref?: string | null;
  guideLabel?: string;
};

/**
 * Inline (non-dismissible) version of the setup checklist for the dashboard
 * home. Hidden once everything is complete. The floating <SetupTaskList/> in
 * the dashboard layout remains available on every page.
 */
export default function SetupChecklistCard({
  tasks,
  guideHref = null,
  guideLabel = "View full setup guide",
}: Props) {
  if (tasks.length === 0) return null;

  const doneCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;
  if (doneCount === totalCount) return null;

  const progressPercent = Math.round((doneCount / totalCount) * 100);
  const remaining = tasks.filter((t) => !t.done);
  const visible = remaining.slice(0, 4);
  const hiddenCount = remaining.length - visible.length;

  return (
    <section
      aria-label="Studio setup checklist"
      className="mb-8 rounded-xl border border-gray-200 bg-white p-6 md:p-7"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="text-base font-semibold tracking-tight text-gray-900">
          Finish setting up your studio
        </h2>
        <p className="text-xs font-medium tabular-nums text-gray-500">
          {doneCount} of {totalCount}
        </p>
      </div>
      <div className="mt-3 h-px w-full overflow-hidden bg-gray-100">
        <div
          className="h-full bg-brand-500 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ width: `${progressPercent}%` }}
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>

      <ul className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {visible.map((task) => (
          <li key={task.id} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-300"
            />
            <div className="flex-1 min-w-0">
              {task.href ? (
                <Link
                  href={task.href}
                  className="block text-sm font-medium text-gray-800 underline-offset-4 hover:text-brand-700 hover:underline"
                >
                  {task.label}
                </Link>
              ) : (
                <span className="block text-sm font-medium text-gray-800">
                  {task.label}
                </span>
              )}
              {task.hint && (
                <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                  {task.hint}
                </span>
              )}
            </div>
            {task.helpHref && (
              <Link
                href={task.helpHref}
                title="Learn how"
                aria-label={`Learn how: ${task.label}`}
                className="-m-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded text-gray-300 hover:text-brand-600"
              >
                <HelpCircle className="h-4 w-4" />
              </Link>
            )}
          </li>
        ))}
      </ul>

      {(hiddenCount > 0 || guideHref) && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
          {hiddenCount > 0 ? (
            <span>{hiddenCount} more in the checklist</span>
          ) : (
            <span aria-hidden="true" />
          )}
          {guideHref && (
            <Link
              href={guideHref}
              className="font-medium text-brand-700 underline-offset-4 hover:underline"
            >
              {guideLabel} &rarr;
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
