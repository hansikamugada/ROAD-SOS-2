import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profileError || profile?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const form = await req.formData();
  if (form.get('decision') !== 'approve') return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
  const { id } = await params;
  const { data, error } = await supabase.from('mechanics')
    .update({ verified: true, available: false })
    .eq('id', id)
    .eq('verified', false)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'This application was not found or has already been reviewed.' }, { status: 404 });

  revalidatePath('/admin');
  return NextResponse.redirect(new URL('/admin?review=approved', req.url));
}
