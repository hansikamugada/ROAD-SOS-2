import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Clock3, MapPin, Star, Wrench } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { MechanicRequestActions } from '@/components/mechanic-request-actions';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { MechanicAvailabilityToggle, MechanicServiceLocation } from '@/components/mechanic-availability-toggle';
export const dynamic = 'force-dynamic';

export default async function MechanicDashboard() {
  const { user, supabase } = await requireUser('/mechanic/login');
  const { data: profile } = await supabase.from('profiles').select('role,full_name,phone,address').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'mechanic' && profile?.role !== 'admin') redirect('/dashboard');
  const [mechanicResult, { data: requests }] = await Promise.all([
    supabase.from('mechanics').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('assistance_requests').select('id,breakdown_type,status,created_at,latitude,longitude,profiles(full_name,phone)').eq('mechanic_id', user.id).order('created_at', { ascending: false }),
  ]);
  let mechanic = mechanicResult.data;
  if (!mechanic && profile.role === 'mechanic') {
    const metadata = user.user_metadata || {};
    const radius = Number(metadata.service_radius_km || 15);
    const { data: repaired, error: repairError } = await supabase.from('mechanics').insert({
      id: user.id,
      mechanic_name: String(metadata.mechanic_name || metadata.full_name || profile.full_name || 'Mechanic'),
      phone: String(metadata.phone || profile.phone || ''),
      garage_name: String(metadata.garage_name || ''),
      services: String(metadata.services || '').split(',').map((item) => item.trim()).filter(Boolean),
      address: String(metadata.address || profile.address || ''),
      service_radius_km: Number.isFinite(radius) && radius >= 1 && radius <= 300 ? radius : 15,
      working_hours: String(metadata.working_hours || ''),
      vehicle_types: String(metadata.vehicle_types || '').split(',').map((item) => item.trim()).filter(Boolean),
      available: false,
      verified: false,
    }).select('*').maybeSingle();
    if (!repairError) mechanic = repaired;
    else if (repairError.code === '23505') {
      const { data: existing } = await supabase.from('mechanics').select('*').eq('id', user.id).maybeSingle();
      mechanic = existing;
    }
  }
  const items = requests ?? [];
  const open = items.filter(r => ['waiting','accepted','on_the_way','arrived','in_progress'].includes(r.status));
  const completed = items.filter(r => r.status === 'completed').length;
  return <main className="portal-layout"><DashboardSidebar role="mechanic" active="Overview" name={mechanic?.mechanic_name || profile?.full_name || 'Mechanic'}/><div className="portal-main"><div className="container mechanic-dashboard">
    <section className="mechanic-hero"><div className="mechanic-hero-top"><div><div className="eyebrow">ROAD SOS · PARTNER WORKSPACE</div><h1>Good day, {mechanic?.mechanic_name?.split(' ')[0] || profile?.full_name?.split(' ')[0] || 'Mechanic'}.</h1><p>Your service desk, requests and business profile in one place.</p></div><Link href="/profile" className="mechanic-profile-link">Manage business profile <ArrowRight size={16}/></Link></div><div className="mechanic-overview"><MechanicAvailabilityToggle userId={user.id} initialAvailable={Boolean(mechanic?.available)} verified={Boolean(mechanic?.verified)} hasServiceLocation={mechanic?.latitude != null && mechanic?.longitude != null}/><span className={mechanic?.verified ? 'verified-badge' : 'pending-badge'}>{mechanic?.verified ? <><BadgeCheck size={16}/> Verified partner</> : <><Clock3 size={16}/> Verification pending</>}</span></div></section>
    <MechanicServiceLocation userId={user.id} initialLatitude={mechanic?.latitude ?? null} initialLongitude={mechanic?.longitude ?? null}/>
    {!mechanic?.verified && <div className="verification-note"><Clock3 size={18}/><span><b>Verification pending.</b> ROAD SOS administrators review workshop details before listing a mechanic. After approval, you can choose when to go online for drivers.</span></div>}
    <section className="stats mechanic-stats"><article className="card stat"><span className="stat-label"><BriefcaseBusiness size={17}/> Active jobs</span><strong>{open.length.toString().padStart(2,'0')}</strong><small>Requests that need your attention</small></article><article className="card stat"><span className="stat-label"><Wrench size={17}/> Completed jobs</span><strong>{completed.toString().padStart(2,'0')}</strong><small>Services completed through ROAD SOS</small></article><article className="card stat"><span className="stat-label"><Star size={17}/> Customer rating</span><strong>{Number(mechanic?.average_rating || 0).toFixed(1)}<span className="rating-outof"> / 5</span></strong><small>Based on customer feedback</small></article></section>
    <section id="requests" className="card request-panel mechanic-request-panel"><div className="panel-heading"><div><div className="eyebrow">SERVICE DESK</div><h2>Customer requests</h2></div><span className="count-badge">{items.length} total</span></div>{items.length ? <div className="mechanic-request-list">{items.map(x=>{const customer=Array.isArray(x.profiles)?x.profiles[0]:x.profiles;return <article className="mechanic-request" key={x.id}><div className="mechanic-request-head"><span className="request-mark"><Wrench size={18}/></span><span><b>{x.breakdown_type}</b><small><Clock3 size={13}/>{new Date(x.created_at).toLocaleString()}</small></span><span className={`request-status status-${x.status}`}>{x.status.replaceAll('_',' ')}</span></div><div className="mechanic-request-details"><span><b>Customer</b>{customer?.full_name || 'Driver'}{customer?.phone && <> · <a href={`tel:${customer.phone}`}>{customer.phone}</a></>}</span><a className="text-link" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${x.latitude}&mlon=${x.longitude}#map=16/${x.latitude}/${x.longitude}`}><MapPin size={15}/> Open location</a></div><div className="mechanic-request-actions"><MechanicRequestActions id={x.id} status={x.status}/></div></article>})}</div> : <div className="empty-state"><div className="empty-icon"><BriefcaseBusiness size={23}/></div><b>Your service desk is ready</b><p>New customer requests assigned to your workshop will appear here.</p></div>}</section>
    <div className="dashboard-footer"><span>{mechanic?.garage_name || 'Your workshop'}</span><Link href="/profile">Update service details <ArrowRight size={15}/></Link></div>
  </div></div></main>;
}
