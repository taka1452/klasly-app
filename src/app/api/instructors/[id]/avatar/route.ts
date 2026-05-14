import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextResponse } from "next/server";

const MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    default: return "jpg";
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instructorId } = await params;
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: instructor } = await ctx.supabase
      .from("instructors")
      .select("profile_id")
      .eq("id", instructorId)
      .eq("studio_id", ctx.studioId)
      .single();

    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG, and WebP images are allowed" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File size must be under 2MB" }, { status: 400 });
    }

    const profileId = instructor.profile_id;
    const ext = getExtension(file.type);
    const filePath = `${profileId}/${Date.now()}.${ext}`;
    const buffer = await file.arrayBuffer();

    const { error: uploadError } = await ctx.supabase.storage
      .from("avatars")
      .upload(filePath, buffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = ctx.supabase.storage.from("avatars").getPublicUrl(filePath);
    const avatarUrl = urlData.publicUrl;

    // Clean up old avatars
    const { data: existing } = await ctx.supabase.storage.from("avatars").list(profileId);
    if (existing) {
      const currentName = filePath.slice(profileId.length + 1);
      const stale = existing.filter((f) => f.name !== currentName).map((f) => `${profileId}/${f.name}`);
      if (stale.length > 0) await ctx.supabase.storage.from("avatars").remove(stale);
    }

    await ctx.supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", profileId);

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instructorId } = await params;
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: instructor } = await ctx.supabase
      .from("instructors")
      .select("profile_id")
      .eq("id", instructorId)
      .eq("studio_id", ctx.studioId)
      .single();

    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }

    const profileId = instructor.profile_id;
    const { data: existing } = await ctx.supabase.storage.from("avatars").list(profileId);
    if (existing && existing.length > 0) {
      await ctx.supabase.storage.from("avatars").remove(existing.map((f) => `${profileId}/${f.name}`));
    }

    await ctx.supabase.from("profiles").update({ avatar_url: null }).eq("id", profileId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
