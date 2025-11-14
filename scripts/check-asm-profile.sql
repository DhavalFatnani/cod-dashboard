-- Check ASM user profiles and permissions
-- Run this in Supabase Studio SQL Editor to verify ASM setup

-- Check all ASM users
SELECT 
  id,
  email,
  full_name,
  role,
  asm_id,
  is_active
FROM public.users
WHERE role = 'asm';

-- Check if the logged-in user is an ASM
SELECT 
  id,
  email,
  full_name,
  role,
  asm_id,
  is_active,
  CASE 
    WHEN asm_id IS NULL THEN '❌ Missing asm_id'
    WHEN role != 'asm' THEN '❌ Wrong role'
    ELSE '✓ Profile OK'
  END as status
FROM public.users
WHERE role = 'asm';

-- Test the INSERT policy
-- This should return true if the policy allows the insert
SELECT 
  u.email,
  u.asm_id as user_asm_id,
  'ASM-001' as test_asm_id,
  CASE 
    WHEN u.asm_id = 'ASM-001' THEN '✓ Can insert events for ASM-001'
    ELSE '❌ Cannot insert (asm_id mismatch)'
  END as insert_permission
FROM public.users u
WHERE u.role = 'asm';

