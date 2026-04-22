"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User, Mail, Lock, Camera, Trash2 } from "lucide-react";

type ProfileData = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  auth_email: string | null;
};

type Section = "profile" | "email" | "password" | "avatar";

type Flash = { section: Section; kind: "error" | "success"; text: string } | null;

export default function AccountForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Flash>(null);

  // Profile form
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Email form
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  // Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const fetchProfile = useCallback(async () => {
    const res = await fetch("/api/account/profile");
    if (!res.ok) return;
    const data: ProfileData = await res.json();
    setProfile(data);
    setFullName(data.full_name ?? "");
    setPhone(data.phone ?? "");
  }, []);

  useEffect(() => {
    fetchProfile().finally(() => setLoading(false));
  }, [fetchProfile]);

  function showFlash(section: Section, kind: "error" | "success", text: string) {
    setFlash({ section, kind, text });
    if (kind === "success") {
      setTimeout(() => setFlash(null), 4000);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, phone: phone || null }),
    });
    setSavingProfile(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showFlash("profile", "error", data.error || "Failed to save");
      return;
    }
    showFlash("profile", "success", "Profile updated");
    router.refresh();
    fetchProfile();
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingEmail(true);
    const res = await fetch("/api/account/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail }),
    });
    setSavingEmail(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showFlash("email", "error", data.error || "Failed to change email");
      return;
    }
    showFlash(
      "email",
      "success",
      data.message || "Confirmation emails sent — check both inboxes"
    );
    setNewEmail("");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      showFlash("password", "error", "New passwords do not match");
      return;
    }
    setSavingPw(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: currentPw,
        new_password: newPw,
      }),
    });
    setSavingPw(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showFlash("password", "error", data.error || "Failed to change password");
      return;
    }
    showFlash("password", "success", "Password updated");
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  }

  async function handleAvatarSelect(file: File) {
    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/account/avatar", {
      method: "POST",
      body: formData,
    });
    setUploadingAvatar(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showFlash("avatar", "error", data.error || "Upload failed");
      return;
    }
    showFlash("avatar", "success", "Photo updated");
    router.refresh();
    fetchProfile();
  }

  async function handleAvatarRemove() {
    setUploadingAvatar(true);
    const res = await fetch("/api/account/avatar", { method: "DELETE" });
    setUploadingAvatar(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showFlash("avatar", "error", data.error || "Failed to remove");
      return;
    }
    showFlash("avatar", "success", "Photo removed");
    router.refresh();
    fetchProfile();
  }

  if (loading) {
    return (
      <div className="card py-12 text-center text-sm text-gray-500">
        Loading...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card py-12 text-center text-sm text-red-600">
        Failed to load your profile.
      </div>
    );
  }

  const initials = (profile.full_name || profile.auth_email || "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* --- Profile picture --- */}
      <section className="card">
        <div className="flex items-start gap-2">
          <Camera className="mt-0.5 h-4 w-4 text-gray-500" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">
              Profile picture
            </h2>
            <p className="text-xs text-gray-500">
              JPG, PNG, or WebP. Max 2MB.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-brand-100">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt="Avatar"
                fill
                className="object-cover"
                sizes="80px"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-medium text-brand-700">
                {initials}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAvatarSelect(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="btn-secondary text-sm"
            >
              {uploadingAvatar ? "Uploading..." : "Upload photo"}
            </button>
            {profile.avatar_url && (
              <button
                type="button"
                onClick={handleAvatarRemove}
                disabled={uploadingAvatar}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>
        </div>
        {flash?.section === "avatar" && (
          <p
            className={`mt-3 text-sm ${
              flash.kind === "error" ? "text-red-600" : "text-green-600"
            }`}
          >
            {flash.text}
          </p>
        )}
      </section>

      {/* --- Profile info --- */}
      <section className="card">
        <div className="flex items-start gap-2">
          <User className="mt-0.5 h-4 w-4 text-gray-500" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">
              Profile information
            </h2>
            <p className="text-xs text-gray-500">
              Shown to your studio and members.
            </p>
          </div>
        </div>
        <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field mt-1"
              required
              maxLength={120}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field mt-1"
              maxLength={30}
            />
          </div>
          {flash?.section === "profile" && (
            <p
              className={`text-sm ${
                flash.kind === "error" ? "text-red-600" : "text-green-600"
              }`}
            >
              {flash.text}
            </p>
          )}
          <button
            type="submit"
            disabled={savingProfile}
            className="btn-primary"
          >
            {savingProfile ? "Saving..." : "Save changes"}
          </button>
        </form>
      </section>

      {/* --- Email --- */}
      <section className="card">
        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 text-gray-500" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">
              Email address
            </h2>
            <p className="text-xs text-gray-500">
              Current: <span className="font-medium">{profile.auth_email}</span>
            </p>
          </div>
        </div>
        <form onSubmit={handleChangeEmail} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              New email
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="input-field mt-1"
              placeholder="you@example.com"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              You&rsquo;ll need to click a confirmation link in both your
              current and new inbox before the change takes effect.
            </p>
          </div>
          {flash?.section === "email" && (
            <p
              className={`text-sm ${
                flash.kind === "error" ? "text-red-600" : "text-green-600"
              }`}
            >
              {flash.text}
            </p>
          )}
          <button
            type="submit"
            disabled={savingEmail || !newEmail}
            className="btn-primary"
          >
            {savingEmail ? "Sending..." : "Send confirmation"}
          </button>
        </form>
      </section>

      {/* --- Password --- */}
      <section className="card">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 text-gray-500" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">Password</h2>
            <p className="text-xs text-gray-500">
              At least 8 characters. Use something you don&rsquo;t use
              elsewhere.
            </p>
          </div>
        </div>
        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Current password
            </label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="input-field mt-1"
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              New password
            </label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="input-field mt-1"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="input-field mt-1"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {flash?.section === "password" && (
            <p
              className={`text-sm ${
                flash.kind === "error" ? "text-red-600" : "text-green-600"
              }`}
            >
              {flash.text}
            </p>
          )}
          <button
            type="submit"
            disabled={savingPw || !currentPw || !newPw}
            className="btn-primary"
          >
            {savingPw ? "Updating..." : "Update password"}
          </button>
        </form>
      </section>
    </div>
  );
}
