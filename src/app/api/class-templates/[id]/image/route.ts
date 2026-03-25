import { getDashboardContext } from "@/lib/auth/dashboard-access";
import { getInstructorContext } from "@/lib/auth/instructor-access";
import { NextResponse } from "next/server";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    default: return "jpg";
  }
}

async function getContext(templateId: string) {
  // Dashboard context (owner/manager)
  const dashCtx = await getDashboardContext();
  if (dashCtx) {
    if (dashCtx.role === "manager" && !dashCtx.permissions?.can_manage_classes) {
      return null;
    }
    return { supabase: dashCtx.supabase, studioId: dashCtx.studioId };
  }

  // Instructor context (own classes only)
  const instrCtx = await getInstructorContext();
  if (instrCtx) {
    // Verify the template belongs to this instructor
    const { data } = await instrCtx.supabase
      .from("class_templates")
      .select("id")
      .eq("id", templateId)
      .eq("instructor_id", instrCtx.instructorId)
      .single();
    if (!data) return null;
    return { supabase: instrCtx.supabase, studioId: instrCtx.studioId };
  }

  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const ctx = await getContext(templateId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        { error: "File size must be under 2MB" },
        { status: 400 }
      );
    }

    const ext = getExtension(file.type);
    const filePath = `${ctx.studioId}/${templateId}.${ext}`;
    const buffer = await file.arrayBuffer();

    // Upload to Supabase Storage (upsert to replace existing)
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

    // Get public URL
    const { data: urlData } = ctx.supabase.storage
      .from("class-images")
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    // Update class template
    const { error: updateError } = await ctx.supabase
      .from("class_templates")
      .update({ image_url: imageUrl })
      .eq("id", templateId)
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const ctx = await getContext(templateId);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current image_url to find the storage path
    const { data: template } = await ctx.supabase
      .from("class_templates")
      .select("image_url")
      .eq("id", templateId)
      .eq("studio_id", ctx.studioId)
      .single();

    if (template?.image_url) {
      // Extract file path from URL
      const url = new URL(template.image_url);
      const pathParts = url.pathname.split("/class-images/");
      if (pathParts[1]) {
        await ctx.supabase.storage
          .from("class-images")
          .remove([pathParts[1]]);
      }
    }

    // Clear image_url
    const { error: updateError } = await ctx.supabase
      .from("class_templates")
      .update({ image_url: null })
      .eq("id", templateId)
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
