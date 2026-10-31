import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CarFront, Clock3, MapPin, ShieldCheck, Wrench } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
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
  const activeRequest = requests?.find(r => !['completed','cancelled','rejected'].includes(r.status));
  return <main className="portal-layout"><DashboardSidebar role="user" active="Overview" name={profile?.full_name || 'Driver'}/><div className="portal-main"><div className="container driver-dashboard">
    <section className="dashboard-welcome"><div><div className="eyebrow">YOUR ROAD SOS</div><h1>Good to have you here, {name}.</h1><p>Get help on the road and keep your trips moving with confidence.</p></div><Link className="profile-shortcut" href="/profile"><span className="avatar avatar-large">{name.slice(0,1).toUpperCase()}</span><span><b>Your profile</b><small>Personal details & vehicles</small></span><ArrowRight size={18}/></Link></section>
    <section className="atlas-location"><span className="atlas-location-icon"><MapPin size={19}/></span><span><b>Share where you are</b><small>Your location is only used to find nearby help.</small></span><Link className="btn btn-line btn-compact" href="/find-mechanics"><MapPin size={15}/>Use my location</Link></section>
    {activeRequest&&<Link className="atlas-active" href={`/requests/${activeRequest.id}`}><span className="atlas-active-icon"><Wrench size={18}/></span><span><small>YOUR ACTIVE REQUEST</small><b>{activeRequest.breakdown_type} · {activeRequest.status.replaceAll('_',' ')}</b></span><span>Track request <ArrowRight size={15}/></span></Link>}
    <div className="atlas-section-heading"><div><div className="eyebrow">A GOOD PLACE TO START</div><h2>What do you need?</h2></div><Link href="/find-mechanics" className="text-link">All nearby mechanics <ArrowRight size={15}/></Link></div>
    <section className="quickGrid atlas-quick-grid"><Link href="/find-mechanics" className="quickCard"><span className="quickGlyph"><MapPin size={18}/></span><span><strong>Find a mechanic</strong><small>See verified help near you</small></span><ArrowRight size={17}/></Link><Link href="/emergency" className="quickCard"><span className="quickGlyph green"><ShieldCheck size={18}/></span><span><strong>People to call</strong><small>Manage emergency contacts</small></span><ArrowRight size={17}/></Link><Link href="/requests" className="quickCard"><span className="quickGlyph blue"><Clock3 size={18}/></span><span><strong>Request history</strong><small>{requests?.length || 0} requests recorded</small></span><ArrowRight size={17}/></Link></section>
    <section className="stats driver-stats"><article className="card stat"><span className="stat-label"><CarFront size={17}/> My vehicle</span><strong>{vehicles?.[0]?.model || 'Add a vehicle'}</strong><small>{vehicles?.[0]?.registration_number || <Link href="/profile">Add your vehicle details <ArrowRight size={13}/></Link>}</small></article><article className="card stat"><span className="stat-label"><Wrench size={17}/> Active requests</span><strong>{active.toString().padStart(2,'0')}</strong><small>{active ? 'Your help is in progress' : 'No active requests right now'}</small></article><article className="card stat"><span className="stat-label"><ShieldCheck size={17}/> Account status</span><strong className="status-ready">Ready for the road</strong><small>Profile and support tools are available</small></article></section>
    <section className="card request-panel"><div className="panel-heading"><div><div className="eyebrow">YOUR ACTIVITY</div><h2>Recent requests</h2></div><Link className="text-link" href="/requests">View history <ArrowRight size={15}/></Link></div>{requests?.length ? <div className="request-list">{requests.map(r=><Link className="request-row" href={`/requests/${r.id}`} key={r.id}><span className="request-mark"><Wrench size={18}/></span><span className="request-info"><b>{r.breakdown_type}</b><small><Clock3 size={13}/>{new Date(r.created_at).toLocaleDateString()}</small></span><span className={`request-status status-${r.status}`}>{r.status.replaceAll('_',' ')}</span><ArrowRight className="row-arrow" size={17}/></Link>)}</div> : <div className="empty-state"><div className="empty-icon"><CarFront size={23}/></div><b>No requests yet</b><p>We hope you won’t need roadside help, but we’ll be here if you do.</p><Link className="text-link" href="/find-mechanics">Explore nearby mechanics <ArrowRight size={15}/></Link></div>}</section>
    <div className="dashboard-footer"><span>Need emergency contacts?</span><Link href="/emergency">View your trusted contacts <ArrowRight size={15}/></Link><Link href="/profile">Manage profile <ArrowRight size={15}/></Link></div>
  </div></div></main>;
}
