import { describe, it, expect } from "vitest";
import {
  getDayName,
  formatCurrency,
  formatDate,
  formatTime,
  getPlanLabel,
  getStatusColor,
  formatCredits,
} from "../utils";

describe("getDayName", () => {
  it("returns correct day names", () => {
    expect(getDayName(0)).toBe("Sunday");
    expect(getDayName(1)).toBe("Monday");
    expect(getDayName(6)).toBe("Saturday");
  });

  it("returns Unknown for invalid index", () => {
    expect(getDayName(7)).toBe("Unknown");
    expect(getDayName(-1)).toBe("Unknown");
  });
});

describe("formatCurrency", () => {
  it("converts cents to dollar format", () => {
    expect(formatCurrency(1900)).toBe("$19.00");
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(150)).toBe("$1.50");
  });

  it("supports other currencies", () => {
    const result = formatCurrency(1000, "eur");
    expect(result).toContain("10.00");
  });
});

describe("formatDate", () => {
  it("formats YYYY-MM-DD to readable string", () => {
    expect(formatDate("2025-02-23")).toBe("Feb 23, 2025");
    expect(formatDate("2025-01-01")).toBe("Jan 1, 2025");
    expect(formatDate("2025-12-31")).toBe("Dec 31, 2025");
  });
});

describe("formatTime", () => {
  it("converts 24h to 12h format", () => {
    expect(formatTime("09:30:00")).toBe("9:30 AM");
    expect(formatTime("13:00:00")).toBe("1:00 PM");
    expect(formatTime("00:00:00")).toBe("12:00 AM");
    expect(formatTime("12:00:00")).toBe("12:00 PM");
  });
});

describe("getPlanLabel", () => {
  it("returns display names for plan types", () => {
    expect(getPlanLabel("monthly")).toBe("Monthly");
    expect(getPlanLabel("pack")).toBe("Class Pack");
    expect(getPlanLabel("drop_in")).toBe("Drop-in");
  });

  it("returns raw value for unknown plans", () => {
    expect(getPlanLabel("custom")).toBe("custom");
  });
});

describe("getStatusColor", () => {
  it("returns green classes for positive statuses", () => {
    expect(getStatusColor("active")).toContain("green");
    expect(getStatusColor("confirmed")).toContain("green");
    expect(getStatusColor("paid")).toContain("green");
  });

  it("returns yellow classes for pending statuses", () => {
    expect(getStatusColor("paused")).toContain("yellow");
    expect(getStatusColor("pending")).toContain("yellow");
  });

  it("returns red classes for negative statuses", () => {
    expect(getStatusColor("cancelled")).toContain("red");
    expect(getStatusColor("failed")).toContain("red");
  });

  it("returns gray for unknown statuses", () => {
    expect(getStatusColor("unknown")).toContain("gray");
  });
});

describe("formatCredits", () => {
  it("returns Unlimited for -1", () => {
    expect(formatCredits(-1)).toBe("Unlimited");
  });

  it("returns remaining count", () => {
    expect(formatCredits(5)).toBe("5 remaining");
    expect(formatCredits(0)).toBe("0 remaining");
  });
});
