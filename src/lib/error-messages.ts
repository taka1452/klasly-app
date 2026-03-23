type ErrorInfo = {
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
};

const ERROR_MAP: Record<string, ErrorInfo> = {
  "booking_conflict": {
    title: "This time slot is already booked",
    description: "The room is being used at this time. Please choose a different time or room.",
    action: { label: "View schedule", href: "/schedule" },
  },
  "booking_no_credits": {
    title: "Not enough credits",
    description: "You need at least 1 credit to book this class. Purchase a credit pack or subscription to continue.",
    action: { label: "Purchase credits", href: "/purchase" },
  },
  "booking_class_full": {
    title: "This class is full",
    description: "All spots are taken. You can join the waitlist and you'll be notified if a spot opens up.",
  },
  "booking_already_booked": {
    title: "You're already booked",
    description: "You already have a reservation for this class.",
  },
  "stripe_not_connected": {
    title: "Stripe is not connected",
    description: "You need to connect your Stripe account before you can accept payments.",
    action: { label: "Connect Stripe", href: "/settings/connect" },
  },
  "payment_failed": {
    title: "Payment failed",
    description: "The payment could not be processed. Please check your payment method and try again.",
  },
  "subscription_past_due": {
    title: "Payment overdue",
    description: "Your subscription payment is past due. Please update your payment method to continue using Klasly.",
    action: { label: "Update billing", href: "/settings/billing" },
  },
  "auth_unauthorized": {
    title: "Access denied",
    description: "You don't have permission to perform this action. Contact your studio owner if you think this is a mistake.",
  },
  "auth_session_expired": {
    title: "Session expired",
    description: "Your session has expired. Please log in again.",
    action: { label: "Log in", href: "/login" },
  },
  "room_conflict": {
    title: "Room already in use",
    description: "This room is booked at the selected time. Choose a different time or room.",
    action: { label: "View schedule", href: "/schedule" },
  },
  "duplicate_email": {
    title: "Email already exists",
    description: "A member with this email address already exists in your studio.",
  },
  "tier_hours_exceeded": {
    title: "Monthly hours exceeded",
    description: "You've used all hours included in your membership tier this month. Overage charges may apply.",
  },
  "server_error": {
    title: "Something went wrong",
    description: "We're having trouble processing your request. Please try again in a moment.",
  },
  "network_error": {
    title: "Connection problem",
    description: "Please check your internet connection and try again.",
  },
};

export function getErrorInfo(errorCode: string): ErrorInfo {
  if (ERROR_MAP[errorCode]) {
    return ERROR_MAP[errorCode];
  }

  const lowerError = errorCode.toLowerCase();

  if (lowerError.includes("conflict") || lowerError.includes("409")) {
    return ERROR_MAP["booking_conflict"];
  }
  if (lowerError.includes("credit") || lowerError.includes("insufficient")) {
    return ERROR_MAP["booking_no_credits"];
  }
  if (lowerError.includes("full") || lowerError.includes("capacity")) {
    return ERROR_MAP["booking_class_full"];
  }
  if (lowerError.includes("stripe") && lowerError.includes("connect")) {
    return ERROR_MAP["stripe_not_connected"];
  }
  if (lowerError.includes("payment") && lowerError.includes("fail")) {
    return ERROR_MAP["payment_failed"];
  }
  if (lowerError.includes("unauthorized") || lowerError.includes("403")) {
    return ERROR_MAP["auth_unauthorized"];
  }
  if (lowerError.includes("duplicate") && lowerError.includes("email")) {
    return ERROR_MAP["duplicate_email"];
  }
  if (lowerError.includes("network") || lowerError.includes("fetch")) {
    return ERROR_MAP["network_error"];
  }

  return {
    title: "Something went wrong",
    description: errorCode || "An unexpected error occurred. Please try again.",
  };
}

export type { ErrorInfo };
