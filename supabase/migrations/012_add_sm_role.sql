-- Add Supply Manager (SM) role and supporting columns

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'sm'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'sm';
  END IF;
END $$;

-- Add optional sm_id column for users (unique identifier for supply managers)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS sm_id TEXT UNIQUE;


