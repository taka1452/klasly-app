"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  sessionId: string;
  studioId: string;
  capacity: number;
  memberId: string | null;
  existingBooking: { id: string; status: string } | null;
  memberCredits: number;
  confirmedCount: number;
};

export default function BookingButton({
  sessionId,
  studioId,
  capacity,
  memberId,
  existingBooking,
  memberCredits,
  confirmedCount,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isFull = confirmedCount >= capacity;
  const showWaitlist = isFull;

  if (!memberId) {
    return (
      <span className="text-sm text-gray-500">Member access required</span>
    );
  }

  if (existingBooking) {
    if (existingBooking.status === "cancelled") {
      return (
        <button
          type="button"
          onClick={async () => {
            setLoading(true);
            const supabase = createClient();
            const status = showWaitlist ? "waitlist" : "confirmed";

            if (memberCredits >= 0 && status === "confirmed" && memberCredits < 1) {
              alert("No credits remaining.");
              setLoading(false);
              return;
            }

            const { error } = await supabase
              .from("bookings")
              .update({ status })
              .eq("id", existingBooking.id);

            if (error) {
              alert(error.message);
              setLoading(false);
              return;
            }

            if (memberCredits >= 0 && status === "confirmed") {
              await supabase
                .from("members")
                .update({ credits: memberCredits - 1 })
                .eq("id", memberId);
            }

            setLoading(false);
            router.refresh();
          }}
          disabled={loading}
          className="btn-primary text-sm"
        >
          {loading ? "..." : "Re-book"}
        </button>
      );
    }
    if (existingBooking.status === "waitlist") {
      return (
        <button
          type="button"
          onClick={async () => {
            setLoading(true);
            const supabase = createClient();
            const { error } = await supabase
              .from("bookings")
              .update({ status: "cancelled" })
              .eq("id", existingBooking.id);

            if (error) {
              alert(error.message);
              setLoading(false);
              return;
            }

            setLoading(false);
            router.refresh();
          }}
          disabled={loading}
          className="btn-secondary text-sm"
        >
          {loading ? "..." : "Leave waitlist"}
        </button>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-green-600">Booked ✓</span>
        <button
          type="button"
          onClick={async () => {
            if (!confirm("Cancel this booking?")) return;
            setLoading(true);
            const supabase = createClient();
            const { error } = await supabase
              .from("bookings")
              .update({ status: "cancelled" })
              .eq("id", existingBooking.id);

            if (error) {
              alert(error.message);
              setLoading(false);
              return;
            }

            if (memberCredits >= 0) {
              await supabase
                .from("members")
                .update({ credits: memberCredits + 1 })
                .eq("id", memberId);
            }

            setLoading(false);
            router.refresh();
          }}
          disabled={loading}
          className="text-sm text-gray-500 underline hover:text-red-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        setLoading(true);
        const supabase = createClient();
        const status = showWaitlist ? "waitlist" : "confirmed";

        if (memberCredits >= 0 && status === "confirmed" && memberCredits < 1) {
          alert("No credits remaining.");
          setLoading(false);
          return;
        }

        const { error } = await supabase.from("bookings").insert({
          studio_id: studioId,
          session_id: sessionId,
          member_id: memberId,
          status,
        });

        if (error) {
          alert(error.message);
          setLoading(false);
          return;
        }

        if (memberCredits >= 0 && status === "confirmed") {
          await supabase
            .from("members")
            .update({ credits: memberCredits - 1 })
            .eq("id", memberId);
        }

        setLoading(false);
        router.refresh();
      }}
      disabled={loading}
      className={
        showWaitlist ? "btn-secondary text-sm" : "btn-primary text-sm"
      }
    >
      {loading ? "..." : showWaitlist ? "Waitlist" : "Book"}
    </button>
  );
}
