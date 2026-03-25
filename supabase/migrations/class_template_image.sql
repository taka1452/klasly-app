-- Add image_url column to class_templates
ALTER TABLE class_templates ADD COLUMN IF NOT EXISTS image_url text;

-- Create public storage bucket for class images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'class-images',
  'class-images',
  true,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Anyone can read (public bucket)
CREATE POLICY "class_images_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'class-images');

-- Storage RLS: Owner/Manager can upload/update
CREATE POLICY "class_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'class-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "class_images_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'class-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "class_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'class-images'
    AND auth.role() = 'authenticated'
  );
