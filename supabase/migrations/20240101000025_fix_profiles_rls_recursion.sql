-- Fix: "infinite recursion detected in policy for relation 'profiles'"
-- The policy "owner can update studio profiles" used a subquery that selected from
-- profiles, causing RLS to re-evaluate the same table. Use a SECURITY DEFINER
-- function so the lookup bypasses RLS.

CREATE OR REPLACE FUNCTION public.get_owner_studio_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT studio_id FROM public.profiles
  WHERE id = auth.uid() AND role = 'owner'
  LIMIT 1;
$$;

-- Drop the policy that causes recursion
DROP POLICY IF EXISTS "owner can update studio profiles" ON profiles;

-- Recreate using the function (no direct SELECT from profiles in the policy)
CREATE POLICY "owner can update studio profiles"
ON profiles FOR UPDATE
USING (
  studio_id = public.get_owner_studio_id()
);

-- 1. 問題のポリシーを削除（SELECT でも profiles を参照して再帰していた）
DROP POLICY IF EXISTS "owner can view studio profiles" ON profiles;

-- 2. 再帰しないポリシーに作り直す（get_owner_studio_id() 関数を使用）
CREATE POLICY "owner can view studio profiles" ON profiles
  FOR SELECT USING (
    studio_id = public.get_owner_studio_id()
  );
