import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
export async function requireUser(loginPath = '/auth/login') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(loginPath);
  return { supabase, user };
}
