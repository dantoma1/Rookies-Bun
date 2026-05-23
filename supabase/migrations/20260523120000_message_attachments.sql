-- Add file attachment support to messages.
-- Files are stored in the 'message-attachments' public Storage bucket.
-- Max upload size enforced client-side at 5 MB.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_url  text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

-- Storage bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "msg_attach_insert" ON storage.objects;
DROP POLICY IF EXISTS "msg_attach_select" ON storage.objects;
DROP POLICY IF EXISTS "msg_attach_delete" ON storage.objects;

CREATE POLICY "msg_attach_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-attachments');

CREATE POLICY "msg_attach_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'message-attachments');

CREATE POLICY "msg_attach_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'message-attachments');
