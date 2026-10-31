'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm({ audience }: { audience: 'driver' | 'mechanic' | 'admin' }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const mechanic = audience === 'mechanic';
  const admin = audience === 'admin';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const form = new FormData(event.currentTarget);
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: String(form.get('email')).trim(),
        password: String(form.get('password')),
      });

      if (signInError) {
        setError(signInError.message.includes('Email not confirmed')
          ? 'Please confirm your email before signing in.'
          : signInError.message.includes('Invalid login credentials')
            ? 'Invalid email or password.'
            : signInError.message);
        return;
      }

      let { data: profile, error: profileError } = await supabase.from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
        await supabase.auth.signOut();
        setError('Your password was accepted, but your account profile could not be loaded. Check the Supabase profile table and try again.');
        router.refresh();
        return;
      }

      if (!profile) {
        if (admin || mechanic) {
          await supabase.auth.signOut();
          setError('No ROAD SOS profile is linked to this account. Ask the project owner to check your account setup.');
          router.refresh();
          return;
        }
        const fullName = String(data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'ROAD SOS member');
        const { data: created, error: createError } = await supabase.from('profiles')
          .upsert({ id: data.user.id, full_name: fullName, role: 'user' }, { onConflict: 'id' })
          .select('role')
          .single();
        if (createError) {
          await supabase.auth.signOut();
          setError('Your sign-in worked, but we could not create your account profile. Please refresh and try again.');
          router.refresh();
          return;
        }
        profile = created;
      }

      const role = profile.role;
      if (admin && role !== 'admin') {
        await supabase.auth.signOut();
        setError('This account does not have admin access. A project owner must set its profile role to admin in Supabase.');
        router.refresh();
        return;
      }
      if (mechanic && role !== 'mechanic' && role !== 'admin') {
        await supabase.auth.signOut();
        setError('This is a driver account. Use the driver sign-in page instead.');
        router.refresh();
        return;
      }
      if (!admin && !mechanic && role === 'mechanic') {
        await supabase.auth.signOut();
        setError('This is a mechanic account. Use the mechanic sign-in page instead.');
        router.refresh();
        return;
      }

      window.location.assign(role === 'admin' ? '/admin' : role === 'mechanic' ? '/mechanic/dashboard' : '/dashboard');
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : '';
      if (detail.includes('Supabase is not configured')) {
        setError('Sign-in is not configured for this deployment. Add the Supabase URL and publishable key to the Vercel environment, then redeploy.');
      } else {
        setError(navigator.onLine ? 'Could not connect to the sign-in service. Check the Supabase project URL/key and try again.' : 'Network connection failed. Check your internet connection.');
      }
    } finally {
      setBusy(false);
    }
  }

  return <main className={`container login-page ${admin ? 'admin-login-page' : ''}`}>
    <form className="card form-card login-card" onSubmit={submit}>
      <div className="eyebrow">{admin ? 'AUTHORIZED PERSONNEL' : mechanic ? 'MECHANIC PARTNER PORTAL' : 'WELCOME BACK'}</div>
      <h1>{admin ? 'Admin sign in' : mechanic ? 'Mechanic sign in' : 'Driver sign in'}</h1>
      <p className="muted">{admin ? 'Sign in with your approved ROAD SOS administrator account.' : mechanic ? 'Manage your workshop and roadside service requests.' : 'Access your ROAD SOS account and roadside support.'}</p>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email"/></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password"/></div>
      {error && <div className="notice" role="alert">{error}</div>}
      <button className="btn btn-dark" style={{ width: '100%', marginTop: 14 }} disabled={busy}>{busy ? 'Signing in…' : admin ? 'Sign in to admin' : mechanic ? 'Sign in to mechanic portal' : 'Sign in'}</button>
      <p className="muted"><Link href="/auth/forgot-password">Forgot password?</Link>{!admin && <>{mechanic ? ' · New mechanic? ' : ' · New driver? '}{mechanic ? <Link href="/mechanic/register">Apply to join</Link> : <Link href="/auth/register">Create account</Link>}</>}</p>
      <div className="login-switch">{admin ? <>Not an administrator? <Link href="/auth/login">Driver sign in <span aria-hidden="true">→</span></Link></> : <>{mechanic ? 'Are you a driver?' : 'Are you a mechanic?'} <Link href={mechanic ? '/auth/login' : '/mechanic/login'}>{mechanic ? 'Driver sign in' : 'Mechanic sign in'} <span aria-hidden="true">→</span></Link></>}</div>
    </form>
  </main>;
}
