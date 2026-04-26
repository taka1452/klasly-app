import Link from "next/link";
import { CheckCircle2, HelpCircle, Sparkles } from "lucide-react";
import type { SetupTask } from "./setup-task-list";

type Props = {
  tasks: SetupTask[];
  /** Optional link to a full setup-guide page rendered as a footer link. */
  guideHref?: string | null;
  guideLabel?: string;
};

/**
 * Inline (non-dismissible) version of the setup checklist, intended for the
 * dashboard home. Hidden once everything is complete so the dashboard returns
 * to its normal layout. The floating <SetupTaskList/> in the dashboard layout
 * remains available on every page for users who navigate away.
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
  // Show first 4 remaining inline; rest is reachable via floating checklist.
  const visible = remaining.slice(0, 4);
  const hiddenCount = remaining.length - visible.length;

  return (
    <section
      aria-label="Studio setup checklist"
      className="mb-6 rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-white p-5 shadow-sm md:p-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-600" aria-hidden="true" />
            <h2 className="text-base md:text-lg font-semibold text-gray-900">
              Finish setting up your studio
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {doneCount} of {totalCount} complete · A few more steps and members can start booking.
          </p>
          <div className="mt-3 h-1.5 w-full max-w-md rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
            />
          </div>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {visible.map((task) => (
          <li
            key={task.id}
            className="group flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
          >
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-300 group-hover:border-brand-400" />
            <div className="flex-1 min-w-0">
              {task.href ? (
                <Link
                  href={task.href}
                  className="block text-sm font-medium text-gray-800 hover:text-brand-700"
                >
                  {task.label}
                </Link>
              ) : (
                <span className="block text-sm font-medium text-gray-800">
                  {task.label}
                </span>
              )}
              {task.hint && (
                <span className="mt-0.5 block text-xs text-gray-500">
                  {task.hint}
                </span>
              )}
            </div>
            {task.helpHref && (
              <Link
                href={task.helpHref}
                title="Learn how"
                className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-brand-500"
              >
                <HelpCircle className="h-4 w-4" />
              </Link>
            )}
          </li>
        ))}
      </ul>

      {(hiddenCount > 0 || guideHref || tasks.some((t) => t.done)) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-3">
            {tasks.some((t) => t.done) && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {doneCount} done
              </span>
            )}
            {hiddenCount > 0 && (
              <span className="text-gray-500">
                +{hiddenCount} more · open the checklist (bottom-right) to see all
              </span>
            )}
          </div>
          {guideHref && (
            <Link
              href={guideHref}
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              {guideLabel} &rarr;
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
