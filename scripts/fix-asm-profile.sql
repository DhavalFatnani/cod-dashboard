-- Fix ASM user profile to ensure asm_id is set correctly
-- Run this in Supabase Studio SQL Editor

-- First, check the current ASM user profile
SELECT 
  id,
  email,
  full_name,
  role,
  asm_id,
  is_active
FROM public.users
WHERE role = 'asm';

-- If asm_id is missing, update it
-- Replace 'your-asm-email@example.com' with the actual ASM user's email
UPDATE public.users
SET 
  asm_id = 'ASM-001',
  full_name = COALESCE(full_name, 'ASM User')
WHERE role = 'asm' 
  AND (asm_id IS NULL OR asm_id = '');

-- Verify the update
SELECT 
  id,
  email,
  full_name,
  role,
  asm_id,
  is_active,
  CASE 
    WHEN asm_id IS NOT NULL AND asm_id != '' THEN '✓ asm_id is set'
    ELSE '❌ asm_id is missing'
  END as status
FROM public.users
WHERE role = 'asm';

