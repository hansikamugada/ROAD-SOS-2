import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CarFront, Clock3, MapPin, ShieldCheck, Wrench } from 'lucide-react';
import { requireUser } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const { user, supabase } = await requireUser();
  const [{ data: profile }, { data: vehicles }, { data: requests }] = await Promise.all([
    supabase.from('profiles').select('full_name,role').eq('id', user.id).maybeSingle(),
    supabase.from('vehicles').select('*').eq('user_id', user.id).order('created_at').limit(1),
    supabase.from('assistance_requests').select('id,breakdown_type,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
  ]);
  if (profile?.role === 'mechanic') redirect('/mechanic/dashboard');
  if (profile?.role === 'admin') redirect('/admin');
  const active = requests?.filter(r => !['completed','cancelled','rejected'].includes(r.status)).length ?? 0;
  const name = profile?.full_name?.split(' ')[0] || 'there';
  return <main className="container driver-dashboard">
    <section className="dashboard-welcome"><div><div className="eyebrow">YOUR ROAD SOS</div><h1>Good to have you here, {name}.</h1><p>Get help on the road and keep your trips moving with confidence.</p></div><Link className="profile-shortcut" href="/profile"><span className="avatar avatar-large">{name.slice(0,1).toUpperCase()}</span><span><b>Your profile</b><small>Personal details & vehicles</small></span><ArrowRight size={18}/></Link></section>
    <section className="driver-actions"><Link href="/find-mechanics" className="action-card action-primary"><span className="action-icon"><MapPin/></span><span><b>Find nearby help</b><small>Discover available mechanics near you</small></span><ArrowRight/></Link><Link href="/requests/new" className="action-card"><span className="action-icon"><Wrench/></span><span><b>Request assistance</b><small>Tell us what happened and get support</small></span><ArrowRight/></Link></section>
    <section className="stats driver-stats"><article className="card stat"><span className="stat-label"><CarFront size={17}/> My vehicle</span><strong>{vehicles?.[0]?.model || 'Add a vehicle'}</strong><small>{vehicles?.[0]?.registration_number || <Link href="/profile">Add your vehicle details <ArrowRight size={13}/></Link>}</small></article><article className="card stat"><span className="stat-label"><Wrench size={17}/> Active requests</span><strong>{active.toString().padStart(2,'0')}</strong><small>{active ? 'Your help is in progress' : 'No active requests right now'}</small></article><article className="card stat"><span className="stat-label"><ShieldCheck size={17}/> Account status</span><strong className="status-ready">Ready for the road</strong><small>Profile and support tools are available</small></article></section>
    <section className="card request-panel"><div className="panel-heading"><div><div className="eyebrow">YOUR ACTIVITY</div><h2>Recent requests</h2></div><Link className="text-link" href="/requests">View history <ArrowRight size={15}/></Link></div>{requests?.length ? <div className="request-list">{requests.map(r=><Link className="request-row" href={`/requests/${r.id}`} key={r.id}><span className="request-mark"><Wrench size={18}/></span><span className="request-info"><b>{r.breakdown_type}</b><small><Clock3 size={13}/>{new Date(r.created_at).toLocaleDateString()}</small></span><span className={`request-status status-${r.status}`}>{r.status.replaceAll('_',' ')}</span><ArrowRight className="row-arrow" size={17}/></Link>)}</div> : <div className="empty-state"><div className="empty-icon"><CarFront size={23}/></div><b>No requests yet</b><p>We hope you won’t need roadside help, but we’ll be here if you do.</p><Link className="text-link" href="/find-mechanics">Explore nearby mechanics <ArrowRight size={15}/></Link></div>}</section>
    <div className="dashboard-footer"><span>Need emergency contacts?</span><Link href="/emergency">View your trusted contacts <ArrowRight size={15}/></Link><Link href="/profile">Manage profile <ArrowRight size={15}/></Link></div>
  </main>;
}
