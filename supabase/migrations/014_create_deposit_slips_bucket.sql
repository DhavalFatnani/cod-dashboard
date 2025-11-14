-- Create storage bucket for deposit slips

INSERT INTO storage.buckets (id, name, public)
VALUES ('deposit-slips', 'deposit-slips', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access (slips will be shared with finance team)
DROP POLICY IF EXISTS "Public read deposit slips" ON storage.objects;

CREATE POLICY "Public read deposit slips"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'deposit-slips');

-- Allow authenticated users to upload deposit slips
DROP POLICY IF EXISTS "Authenticated upload deposit slips" ON storage.objects;

CREATE POLICY "Authenticated upload deposit slips"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'deposit-slips');

-- Allow owners to update/delete their own files
DROP POLICY IF EXISTS "Owners update deposit slips" ON storage.objects;

CREATE POLICY "Owners update deposit slips"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'deposit-slips' AND owner = auth.uid());

DROP POLICY IF EXISTS "Owners delete deposit slips" ON storage.objects;

CREATE POLICY "Owners delete deposit slips"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'deposit-slips' AND owner = auth.uid());


