type PushTemplate = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

type BookingPushParams = {
  className: string;
  sessionDate: string;
  startTime: string;
};

export function pushBookingConfirmation(
  params: BookingPushParams
): PushTemplate {
  return {
    title: "Booking Confirmed",
    body: `${params.className} — ${params.sessionDate} at ${params.startTime}`,
    url: "/member/my-bookings",
    tag: `booking-${params.className}-${params.sessionDate}`,
  };
}

export function pushBookingCancelled(params: BookingPushParams): PushTemplate {
  return {
    title: "Booking Cancelled",
    body: `${params.className} — ${params.sessionDate} at ${params.startTime}`,
    url: "/member/schedule",
    tag: `cancel-${params.className}-${params.sessionDate}`,
  };
}

export function pushWaitlistPromoted(params: BookingPushParams): PushTemplate {
  return {
    title: "You're in!",
    body: `A spot opened up for ${params.className} — ${params.sessionDate} at ${params.startTime}`,
    url: "/member/my-bookings",
    tag: `waitlist-${params.className}-${params.sessionDate}`,
  };
}

export function pushClassReminder(params: BookingPushParams): PushTemplate {
  return {
    title: "Class in 1 hour",
    body: `${params.className} starts at ${params.startTime}`,
    url: "/member/my-bookings",
    tag: `reminder-${params.className}-${params.sessionDate}`,
  };
}

export function pushNewMessage(params: { senderName: string }): PushTemplate {
  return {
    title: "New Message",
    body: `${params.senderName} sent you a message`,
    url: "/messages",
    tag: `message-${params.senderName}`,
  };
}

export function pushAppointmentReminder(params: {
  appointmentType: string;
  instructorName: string;
  startTime: string;
}): PushTemplate {
  return {
    title: "Appointment in 1 hour",
    body: `${params.appointmentType} with ${params.instructorName} at ${params.startTime}`,
    url: "/member/appointments",
    tag: `appt-reminder-${params.startTime}-${Date.now()}`,
  };
}

export function pushStudioAnnouncement(params: {
  studioName: string;
  message: string;
}): PushTemplate {
  return {
    title: params.studioName,
    body: params.message,
    url: "/member/schedule",
    tag: `announcement-${Date.now()}`,
  };
}

// =====================================================
// Staff motivation / revenue push templates
// =====================================================

export function pushInstructorMorningBriefing(params: {
  classCount: number;
  studentCount: number;
  newStudentCount: number;
  loyaltyHighlight?: string | null;
}): PushTemplate {
  const { classCount, studentCount, newStudentCount, loyaltyHighlight } = params;
  const segments: string[] = [];
  if (classCount === 0) {
    segments.push("No classes today — enjoy the rest day.");
  } else {
    const classWord = classCount === 1 ? "class" : "classes";
    const studentWord = studentCount === 1 ? "student" : "students";
    segments.push(`${classCount} ${classWord} · ${studentCount} ${studentWord}`);
    if (newStudentCount > 0) {
      segments.push(
        `${newStudentCount} new ${newStudentCount === 1 ? "face" : "faces"}`
      );
    }
  }
  if (loyaltyHighlight) segments.push(loyaltyHighlight);

  return {
    title: "Good morning ☀️",
    body: segments.join(" · "),
    url: "/my-classes",
    tag: `briefing-${new Date().toISOString().slice(0, 10)}`,
  };
}

export function pushInstructorReviewReceived(params: {
  rating: number;
  className: string;
  hasComment: boolean;
}): PushTemplate {
  const stars = "★".repeat(Math.max(1, Math.min(5, Math.round(params.rating))));
  const tail = params.hasComment ? " — they left a note" : "";
  return {
    title: `New review · ${stars}`,
    body: `${params.className}${tail}`,
    url: "/reviews",
    tag: `review-${Date.now()}`,
  };
}

export function pushInstructorLowFillWarning(params: {
  className: string;
  sessionDate: string;
  startTime: string;
  bookedCount: number;
  capacity: number;
}): PushTemplate {
  const open = Math.max(0, params.capacity - params.bookedCount);
  return {
    title: "Spots still open tomorrow",
    body: `${params.className} ${params.startTime} — ${open} of ${params.capacity} unbooked`,
    url: `/my-classes?promote=${encodeURIComponent(params.className)}`,
    tag: `lowfill-${params.className}-${params.sessionDate}`,
  };
}

export function pushInstructorBirthdayAlert(params: {
  memberName: string;
  ageOrYearsLabel?: string | null;
}): PushTemplate {
  const suffix = params.ageOrYearsLabel ? ` (${params.ageOrYearsLabel})` : "";
  return {
    title: "🎂 Birthday today",
    body: `${params.memberName}${suffix} — say hello when you see them`,
    url: "/my-classes",
    tag: `birthday-${params.memberName}-${new Date().toISOString().slice(0, 10)}`,
  };
}

export function pushManagerMorningTodo(params: {
  pendingBookings: number;
  failedPayments: number;
  passesExpiringSoon: number;
  lowFillTomorrow: number;
}): PushTemplate {
  const items: string[] = [];
  if (params.pendingBookings > 0)
    items.push(`${params.pendingBookings} booking${params.pendingBookings === 1 ? "" : "s"} waiting`);
  if (params.failedPayments > 0)
    items.push(`${params.failedPayments} failed payment${params.failedPayments === 1 ? "" : "s"}`);
  if (params.passesExpiringSoon > 0)
    items.push(`${params.passesExpiringSoon} pass${params.passesExpiringSoon === 1 ? "" : "es"} expiring`);
  if (params.lowFillTomorrow > 0)
    items.push(`${params.lowFillTomorrow} class${params.lowFillTomorrow === 1 ? "" : "es"} need filling`);

  const body = items.length === 0
    ? "All clear — nothing urgent today."
    : items.join(" · ");

  return {
    title: "Today's todo",
    body,
    url: "/dashboard",
    tag: `manager-todo-${new Date().toISOString().slice(0, 10)}`,
  };
}
