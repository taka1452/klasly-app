import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { getErrorInfo } from "@/lib/error-messages";

type ErrorAlertProps = {
  error: string;
  onDismiss?: () => void;
};

export default function ErrorAlert({ error, onDismiss }: ErrorAlertProps) {
  const info = getErrorInfo(error);

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800">{info.title}</p>
          <p className="mt-1 text-sm text-red-700 leading-relaxed">
            {info.description}
          </p>
          {info.action && (
            <Link
              href={info.action.href}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800"
            >
              {info.action.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 tap-target rounded text-red-400 hover:bg-red-100 hover:text-red-600"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
