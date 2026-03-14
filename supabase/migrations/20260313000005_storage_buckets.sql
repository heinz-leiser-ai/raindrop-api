-- RDBE-7: Storage buckets for file uploads and covers

INSERT INTO storage.buckets (id, name, public) VALUES
  ('raindrop-files', 'raindrop-files', false),
  ('raindrop-covers', 'raindrop-covers', true)
ON CONFLICT (id) DO NOTHING;

-- raindrop-files: private, only owner can read/write
CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'raindrop-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'raindrop-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'raindrop-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- raindrop-covers: public read, only owner can write
CREATE POLICY "Users can upload covers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'raindrop-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can read covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'raindrop-covers');

CREATE POLICY "Users can delete own covers"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'raindrop-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
