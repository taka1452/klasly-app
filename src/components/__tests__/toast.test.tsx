import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Toast from "../ui/toast";

describe("Toast component", () => {
  it("renders the message", () => {
    render(<Toast message="Saved!" onClose={() => {}} />);
    expect(screen.getByText("Saved!")).toBeInTheDocument();
  });

  it("has status role for accessibility", () => {
    render(<Toast message="Done" onClose={() => {}} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("applies error variant styles", () => {
    render(<Toast message="Error!" onClose={() => {}} variant="error" />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("bg-red-600");
  });

  it("applies success variant styles by default", () => {
    render(<Toast message="OK" onClose={() => {}} />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("bg-emerald-600");
  });

  it("calls onClose after duration", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast message="Bye" onClose={onClose} duration={1000} />);

    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onClose).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
