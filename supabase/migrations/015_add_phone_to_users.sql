-- Add phone column to public.users to support phone-based login

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);


