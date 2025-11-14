-- Make email nullable to support phone-only authentication
ALTER TABLE public.users
ALTER COLUMN email DROP NOT NULL;

