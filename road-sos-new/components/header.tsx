import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('full_name,role').eq('id', user.id).maybeSingle()
    : { data: null };
  const dashboard = profile?.role === 'admin' ? '/admin' : profile?.role === 'mechanic' ? '/mechanic/dashboard' : '/dashboard';

  return <header className="navbar"><div className="container navinner">
    <Link href={user ? dashboard : '/'} className="logo">ROAD<span>SOS</span></Link>
    {user ? <>
      <nav className="navlinks"><Link href="/about">About</Link><Link href={dashboard}>Dashboard</Link>{profile?.role === 'mechanic' ? <Link href="/mechanic/dashboard">Service requests</Link> : <Link href="/find-mechanics">Find mechanics</Link>}</nav>
      <Link className="account-chip" href="/profile"><span className="avatar">{(profile?.full_name || user.email || 'R').trim().slice(0,1).toUpperCase()}</span><span className="account-name">{profile?.full_name?.split(' ')[0] || 'My profile'}</span><span className="account-arrow">⌄</span></Link>
    </> : <><nav className="navlinks"><Link href="/about">About</Link><Link href="/find-mechanics">Find mechanics</Link><Link href="/mechanic/register">For mechanics</Link><Link href="/auth/login">Log in</Link><Link className="btn btn-dark" href="/auth/register">Get help</Link></nav><Link className="btn btn-dark nav-signin" href="/auth/login">Sign in</Link></>}
  </div></header>;
}
