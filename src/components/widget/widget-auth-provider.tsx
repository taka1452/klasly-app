"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createWidgetClient } from "@/lib/widget/supabase-client";
import type { User, SupabaseClient } from "@supabase/supabase-js";

type MemberInfo = {
  id: string;
  credits: number;
  planType: string;
  status: string;
  waiverSigned: boolean;
};

type BookingInfo = {
  id: string;
  sessionId: string;
  status: string;
};

type WidgetAuthState = {
  user: User | null;
  member: MemberInfo | null;
  bookings: BookingInfo[];
  loading: boolean;
  supabase: SupabaseClient;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshMemberData: () => Promise<void>;
};

const WidgetAuthContext = createContext<WidgetAuthState | null>(null);

export function useWidgetAuth() {
  const ctx = useContext(WidgetAuthContext);
  if (!ctx) {
    throw new Error("useWidgetAuth must be used within WidgetAuthProvider");
  }
  return ctx;
}

type Props = {
  studioId: string;
  children: ReactNode;
};

export function WidgetAuthProvider({ studioId, children }: Props) {
  const [supabase] = useState(() => createWidgetClient());
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [bookings, setBookings] = useState<BookingInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch member data for this studio
  const refreshMemberData = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setMember(null);
      setBookings([]);
      return;
    }

    try {
      const res = await fetch(`/api/widget/${studioId}/member`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setMember(data.member);
        setBookings(data.bookings || []);
      }
    } catch {
      // Silently fail — member data is not critical for schedule viewing
    }
  }, [supabase, studioId]);

  // Listen for auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        refreshMemberData();
      }
      setLoading(false);
    });

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        refreshMemberData();
      } else {
        setMember(null);
        setBookings([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, refreshMemberData]);

  // Listen for postMessage from OAuth popup
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        event.data?.type === "KLASLY_AUTH_CALLBACK" &&
        event.data?.session
      ) {
        const { access_token, refresh_token } = event.data.session;
        supabase.auth
          .setSession({ access_token, refresh_token })
          .then(({ data: { user: newUser } }) => {
            if (newUser) {
              setUser(newUser);
              refreshMemberData();
            }
          });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [supabase, refreshMemberData]);

  // Email + password login
  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return error ? error.message : null;
    },
    [supabase]
  );

  // Google OAuth via popup
  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/widget/auth/callback`,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      console.error("[widget] Google OAuth error:", error);
      return;
    }

    // Open OAuth in a popup window
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      data.url,
      "klasly-oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!popup) {
      alert(
        "Popup was blocked by your browser. Please allow popups for this site to sign in with Google."
      );
    }
  }, [supabase]);

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMember(null);
    setBookings([]);
  }, [supabase]);

  const value: WidgetAuthState = {
    user,
    member,
    bookings,
    loading,
    supabase,
    signInWithPassword,
    signInWithGoogle,
    signOut,
    refreshMemberData,
  };

  return (
    <WidgetAuthContext.Provider value={value}>
      {children}
    </WidgetAuthContext.Provider>
  );
}
