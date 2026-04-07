"use client";

import { useState } from "react";
import ReviewDialog from "./review-dialog";
import StarRating from "./star-rating";

type ReviewButtonProps = {
  sessionId: string;
  className: string;
  existingRating?: number | null;
};

export default function ReviewButton({
  sessionId,
  className,
  existingRating,
}: ReviewButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (submitted || existingRating) {
    return (
      <div className="flex items-center gap-1">
        <StarRating value={existingRating || 5} size="sm" readonly />
        <span className="text-xs text-gray-400">Reviewed</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        Rate
      </button>
      {open && (
        <ReviewDialog
          sessionId={sessionId}
          className={className}
          onClose={() => setOpen(false)}
          onSubmitted={() => {
            setSubmitted(true);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
