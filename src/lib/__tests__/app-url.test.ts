import { describe, it, expect } from "vitest";
import { sanitizeRedirectPath } from "../app-url";

describe("sanitizeRedirectPath", () => {
  it("returns valid paths unchanged", () => {
    expect(sanitizeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/settings/billing")).toBe("/settings/billing");
    expect(sanitizeRedirectPath("/")).toBe("/");
  });

  it("blocks protocol-relative URLs (//evil.com)", () => {
    expect(sanitizeRedirectPath("//evil.com")).toBe("/");
    expect(sanitizeRedirectPath("//evil.com/path")).toBe("/");
  });

  it("blocks absolute URLs with protocol", () => {
    expect(sanitizeRedirectPath("https://evil.com")).toBe("/");
    expect(sanitizeRedirectPath("http://evil.com/path")).toBe("/");
    expect(sanitizeRedirectPath("javascript://alert(1)")).toBe("/");
  });

  it("blocks paths not starting with /", () => {
    expect(sanitizeRedirectPath("evil.com")).toBe("/");
    expect(sanitizeRedirectPath("dashboard")).toBe("/");
  });

  it("returns fallback for null/undefined", () => {
    expect(sanitizeRedirectPath(null)).toBe("/");
    expect(sanitizeRedirectPath(undefined)).toBe("/");
    expect(sanitizeRedirectPath("")).toBe("/");
  });

  it("uses custom fallback", () => {
    expect(sanitizeRedirectPath(null, "/home")).toBe("/home");
    expect(sanitizeRedirectPath("//evil.com", "/login")).toBe("/login");
  });
});
