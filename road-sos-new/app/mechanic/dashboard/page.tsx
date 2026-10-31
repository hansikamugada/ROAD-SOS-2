import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Clock3, MapPin, Star, Wrench } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { MechanicRequestActions } from '@/components/mechanic-request-actions';
export const dynamic = 'force-dynamic';

export default async function MechanicDashboard() {
  const { user, supabase } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('role,full_name').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'mechanic' && profile?.role !== 'admin') redirect('/dashboard');
  const [{ data: mechanic }, { data: requests }] = await Promise.all([
    supabase.from('mechanics').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('assistance_requests').select('id,breakdown_type,status,created_at,latitude,longitude,profiles(full_name,phone)').eq('mechanic_id', user.id).order('created_at', { ascending: false }),
  ]);
  const items = requests ?? [];
  const open = items.filter(r => ['waiting','accepted','on_the_way','arrived','in_progress'].includes(r.status));
  const completed = items.filter(r => r.status === 'completed').length;
  return <main className="container mechanic-dashboard">
    <section className="mechanic-hero"><div className="mechanic-hero-top"><div><div className="eyebrow">ROAD SOS · PARTNER WORKSPACE</div><h1>Good day, {mechanic?.mechanic_name?.split(' ')[0] || profile?.full_name?.split(' ')[0] || 'Mechanic'}.</h1><p>Your service desk, requests and business profile in one place.</p></div><Link href="/profile" className="mechanic-profile-link">Manage business profile <ArrowRight size={16}/></Link></div><div className="mechanic-overview"><div className="availability-card"><span className={`availability-dot ${mechanic?.available ? 'online' : ''}`}/><span><b>{mechanic?.available ? 'You’re online' : 'Currently offline'}</b><small>{mechanic?.available ? 'Drivers can find your service' : 'Availability is managed by the ROAD SOS team'}</small></span></div><span className={mechanic?.verified ? 'verified-badge' : 'pending-badge'}>{mechanic?.verified ? <><BadgeCheck size={16}/> Verified partner</> : <><Clock3 size={16}/> Verification pending</>}</span></div></section>
    {!mechanic?.verified && <div className="verification-note"><Clock3 size={18}/><span><b>Your application is being reviewed.</b> Once verified, drivers will be able to discover your business.</span></div>}
    <section className="stats mechanic-stats"><article className="card stat"><span className="stat-label"><BriefcaseBusiness size={17}/> Active jobs</span><strong>{open.length.toString().padStart(2,'0')}</strong><small>Requests that need your attention</small></article><article className="card stat"><span className="stat-label"><Wrench size={17}/> Completed jobs</span><strong>{completed.toString().padStart(2,'0')}</strong><small>Services completed through ROAD SOS</small></article><article className="card stat"><span className="stat-label"><Star size={17}/> Customer rating</span><strong>{Number(mechanic?.average_rating || 0).toFixed(1)}<span className="rating-outof"> / 5</span></strong><small>Based on customer feedback</small></article></section>
    <section className="card request-panel mechanic-request-panel"><div className="panel-heading"><div><div className="eyebrow">SERVICE DESK</div><h2>Customer requests</h2></div><span className="count-badge">{items.length} total</span></div>{items.length ? <div className="mechanic-request-list">{items.map(x=>{const customer=Array.isArray(x.profiles)?x.profiles[0]:x.profiles;return <article className="mechanic-request" key={x.id}><div className="mechanic-request-head"><span className="request-mark"><Wrench size={18}/></span><span><b>{x.breakdown_type}</b><small><Clock3 size={13}/>{new Date(x.created_at).toLocaleString()}</small></span><span className={`request-status status-${x.status}`}>{x.status.replaceAll('_',' ')}</span></div><div className="mechanic-request-details"><span><b>Customer</b>{customer?.full_name || 'Driver'}{customer?.phone && <> · <a href={`tel:${customer.phone}`}>{customer.phone}</a></>}</span><a className="text-link" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${x.latitude}&mlon=${x.longitude}#map=16/${x.latitude}/${x.longitude}`}><MapPin size={15}/> Open location</a></div><div className="mechanic-request-actions"><MechanicRequestActions id={x.id} status={x.status}/></div></article>})}</div> : <div className="empty-state"><div className="empty-icon"><BriefcaseBusiness size={23}/></div><b>Your service desk is ready</b><p>New customer requests assigned to your workshop will appear here.</p></div>}</section>
    <div className="dashboard-footer"><span>{mechanic?.garage_name || 'Your workshop'}</span><Link href="/profile">Update service details <ArrowRight size={15}/></Link></div>
  </main>;
}
