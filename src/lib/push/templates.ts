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
