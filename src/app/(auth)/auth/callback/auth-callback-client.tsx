"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackClient() {
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const supabase = createClient();

    async function handleHash() {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      if (!hash) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch("/api/auth/redirect-destination");
          const data = await res.json().catch(() => ({ url: "/" }));
          window.location.replace(data.url ?? "/");
          return;
        }
        setStatus("error");
        window.location.replace("/login?error=auth_callback_failed");
        return;
      }

      const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error: setError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!setError) {
          const res = await fetch("/api/auth/redirect-destination");
          const data = await res.json().catch(() => ({ url: "/" }));
          window.location.replace(data.url ?? "/");
          return;
        }
      }

      await new Promise((r) => setTimeout(r, 100));
      let { data: { session }, error } = await supabase.auth.getSession();
      if (!session && hash) {
        await new Promise((r) => setTimeout(r, 300));
        const next = await supabase.auth.getSession();
        session = next.data.session;
        error = next.error;
      }
      if (error) {
        setStatus("error");
        window.location.replace("/login?error=auth_callback_failed");
        return;
      }
      if (session) {
        const res = await fetch("/api/auth/redirect-destination");
        const data = await res.json().catch(() => ({ url: "/" }));
        window.location.replace(data.url ?? "/");
        return;
      }
      setStatus("error");
      setTimeout(() => {
        window.location.replace("/login?error=auth_callback_failed");
      }, 2000);
    }

    handleHash();
  }, []);

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Redirecting to login...</p>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="mt-4 text-sm text-gray-500">Signing you in...</p>
      </div>
    </div>
  );
}
