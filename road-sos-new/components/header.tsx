import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SignOutButton } from '@/components/sign-out-button';

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('full_name,role').eq('id', user.id).maybeSingle()
    : { data: null };
  const dashboard = profile?.role === 'admin' ? '/admin' : profile?.role === 'mechanic' ? '/mechanic/dashboard' : '/dashboard';

  return <header className={`navbar ${user ? 'navbar-auth' : ''}`}><div className="container navinner">
    <Link href={user ? dashboard : '/'} className="logo">ROAD<span>SOS</span></Link>
    {user ? <>
      <div className="auth-header-status"><span className="liveDot"/>{profile?.role==='admin'?'ADMIN OPERATIONS':profile?.role==='mechanic'?'MECHANIC WORKSPACE':'ROAD SUPPORT READY'}</div><nav className="navlinks"><Link href="/about">About</Link><Link href={dashboard}>{profile?.role==='admin'?'Admin dashboard':'Dashboard'}</Link>{profile?.role === 'admin' ? <Link href="/admin#reviews">Mechanic reviews</Link> : profile?.role === 'mechanic' ? <Link href="/mechanic/dashboard#requests">Service requests</Link> : <Link href="/find-mechanics">Find mechanics</Link>}</nav>
      <div className="account-actions"><Link className="account-chip" href="/profile"><span className="avatar">{(profile?.full_name || user.email || 'R').trim().slice(0,1).toUpperCase()}</span><span className="account-name">{profile?.full_name?.split(' ')[0] || 'My profile'}</span><span className="account-arrow">⌄</span></Link><SignOutButton/></div>
    </> : <><nav className="navlinks"><Link href="/about">About</Link><Link href="/find-mechanics">Find mechanics</Link><Link href="/mechanic/register">For mechanics</Link><Link href="/mechanic/login">Mechanic sign in</Link><Link href="/admin/login">Admin sign in</Link><Link href="/auth/login">Log in</Link><Link className="btn btn-dark" href="/auth/register">Get help</Link></nav><div className="nav-mobile-actions"><Link className="btn btn-dark nav-signin" href="/auth/login">Driver sign in</Link><Link className="btn btn-line nav-signin" href="/mechanic/login">Mechanic sign in</Link><Link className="nav-admin-signin" href="/admin/login">Admin sign in</Link></div></>}
  </div></header>;
}
