import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { NextResponse } from "next/server";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB for event images
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
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: event } = await ctx.supabase
      .from("events")
      .select("id, studio_id")
      .eq("id", eventId)
      .eq("studio_id", ctx.studioId)
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPG, PNG, and WebP images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size must be under 5MB" },
        { status: 400 }
      );
    }

    const ext = getExtension(file.type);
    const filePath = `events/${ctx.studioId}/${eventId}.${ext}`;
    const buffer = await file.arrayBuffer();

    const { error: uploadError } = await ctx.supabase.storage
      .from("class-images")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = ctx.supabase.storage
      .from("class-images")
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    const { error: updateError } = await ctx.supabase
      .from("events")
      .update({ image_url: imageUrl })
      .eq("id", eventId)
      .eq("studio_id", ctx.studioId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ image_url: imageUrl });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const ctx = await getDashboardContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: event } = await ctx.supabase
      .from("events")
      .select("image_url")
      .eq("id", eventId)
      .eq("studio_id", ctx.studioId)
      .single();

    if (event?.image_url) {
      const url = new URL(event.image_url);
      const pathParts = url.pathname.split("/class-images/");
      if (pathParts[1]) {
        await ctx.supabase.storage
          .from("class-images")
          .remove([decodeURIComponent(pathParts[1])]);
      }
    }

    const { error: updateError } = await ctx.supabase
      .from("events")
      .update({ image_url: null })
      .eq("id", eventId)
      .eq("studio_id", ctx.studioId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
