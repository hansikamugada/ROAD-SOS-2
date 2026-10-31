import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { Activity, ArrowRight, BadgeCheck, BellRing, BriefcaseBusiness, CarFront, Check, Clock3, MapPin, ShieldAlert, Users, Wrench } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Admin({ searchParams }: { searchParams: Promise<{ review?: string }> }) {
  const { user, supabase } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('role,full_name').eq('id', user.id).single();

  if (profile?.role !== 'admin') {
    return <main className="container section"><div className="card admin-access-card"><div className="eyebrow">ADMIN ACCESS REQUIRED</div><h1>This account can’t manage ROAD SOS yet</h1><p className="muted">The admin workspace is at <strong>/admin</strong>. A project owner can enable it in Supabase: open <strong>Table Editor → public → profiles</strong>, find your account, and set its <strong>role</strong> to <strong>admin</strong>. Sign out and back in afterward.</p><p className="muted">Only project owners can grant admin access. Drivers and mechanics can’t approve their own accounts.</p><div className="admin-access-actions"><Link className="btn btn-dark" href="/admin/login">Admin sign in</Link><Link className="btn btn-line" href="/dashboard">Back to my dashboard</Link></div></div></main>;
  }

  const [notice, users, mechanics, pending, active, sos, queueResult, sosResult, requestsResult] = await Promise.all([
    searchParams,
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user'),
    supabase.from('mechanics').select('*', { count: 'exact', head: true }),
    supabase.from('mechanics').select('*', { count: 'exact', head: true }).eq('verified', false),
    supabase.from('assistance_requests').select('*', { count: 'exact', head: true }).not('status', 'in', '("completed","cancelled","rejected")'),
    supabase.from('sos_requests').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('mechanics').select('id,mechanic_name,garage_name,phone,address,services,vehicle_types,service_radius_km,created_at').eq('verified', false).order('created_at', { ascending: true }),
    supabase.from('sos_requests').select('id,user_id,latitude,longitude,created_at').eq('status', 'active').order('created_at', { ascending: false }).limit(10),
    supabase.from('assistance_requests').select('id,user_id,mechanic_id,breakdown_type,status,created_at').not('status', 'in', '("completed","cancelled","rejected")').order('created_at', { ascending: false }).limit(10),
  ]);

  const stats = [
    { label: 'Drivers', value: users.count ?? 0, icon: Users, tone: 'blue' },
    { label: 'Mechanics', value: mechanics.count ?? 0, icon: Wrench, tone: 'orange' },
    { label: 'Awaiting review', value: pending.count ?? 0, icon: Clock3, tone: 'gold' },
    { label: 'Active assistance', value: active.count ?? 0, icon: Activity, tone: 'green' },
    { label: 'Live SOS alerts', value: sos.count ?? 0, icon: ShieldAlert, tone: 'red' },
  ];

  return <main className="admin-workspace" id="overview">
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/admin">ROAD<span>SOS</span><small>OPERATIONS</small></Link>
      <div className="admin-nav-label">WORKSPACE</div>
      <nav className="admin-nav">
        <a className="active" href="#overview"><Activity size={16}/> Overview</a>
        <a href="#reviews"><Wrench size={16}/> Mechanic reviews <b>{pending.count ?? 0}</b></a>
        <a href="#assistance"><CarFront size={16}/> Assistance requests</a>
        <a href="#alerts"><ShieldAlert size={16}/> SOS alerts</a>
      </nav>
      <div className="admin-sidebar-bottom"><span className="admin-secure"><BadgeCheck size={15}/> Admin access</span><span className="admin-name">{profile.full_name || user.email || 'Administrator'}</span><Link href="/dashboard">Return to app <ArrowRight size={14}/></Link></div>
    </aside>

    <section className="admin-main">
      <header className="admin-topbar"><span><span className="admin-live-dot"/> ROAD SOS OPERATIONS</span><span className="admin-topbar-user"><span className="admin-avatar">{(profile.full_name || 'A').slice(0, 1).toUpperCase()}</span>{profile.full_name || 'Administrator'}</span></header>
      <div className="admin-content">
        <section className="admin-welcome"><div><div className="eyebrow">OPERATIONS OVERVIEW</div><h1>Good day, {(profile.full_name || 'Admin').split(' ')[0]}.</h1><p>Review partner applications and keep roadside support moving.</p></div><div className="admin-date"><BellRing size={16}/> Live service desk</div></section>
        {notice.review === 'approved' && <div className="admin-notice"><Check size={17}/> Mechanic verified. They’re now approved and can be activated for driver searches.</div>}

        <section className="admin-stat-grid" aria-label="Platform overview">
          {stats.map(({ label, value, icon: Icon, tone }) => <article className="admin-stat-card" key={label}><span className={`admin-stat-icon ${tone}`}><Icon size={18}/></span><span className="admin-stat-label">{label}</span><strong>{value.toString().padStart(2, '0')}</strong><small>{label === 'Awaiting review' ? 'Applications to check' : label === 'Live SOS alerts' ? 'Need urgent attention' : 'Current total'}</small></article>)}
        </section>

        <section className="admin-panel" id="reviews">
          <div className="admin-panel-heading"><div><div className="eyebrow">PARTNER ONBOARDING</div><h2>Mechanic verification</h2><p>Review the business details before approving a mechanic.</p></div><span className="admin-count-pill">{queueResult.data?.length ?? 0} pending</span></div>
          {queueResult.error ? <div className="admin-empty"><b>Applications couldn’t be loaded</b><p>{queueResult.error.message}</p></div> : queueResult.data?.length ? <div className="admin-review-list">
            {queueResult.data.map((mechanic) => <article className="admin-review-card" key={mechanic.id}>
              <div className="admin-review-top"><span className="admin-review-icon"><BriefcaseBusiness size={19}/></span><div className="admin-review-title"><h3>{mechanic.garage_name || 'Workshop name missing'}</h3><span>{mechanic.mechanic_name} · Applied {new Date(mechanic.created_at).toLocaleDateString()}</span></div><span className="admin-pending"><Clock3 size={13}/> Pending</span></div>
              <div className="admin-review-details"><div><small>Contact</small><b>{mechanic.phone || 'Not provided'}</b></div><div><small>Workshop address</small><b>{mechanic.address || 'Not provided'}</b></div><div><small>Services</small><b>{mechanic.services?.join(', ') || 'Not provided'}</b></div><div><small>Vehicles · radius</small><b>{mechanic.vehicle_types?.join(', ') || 'Not provided'} · {mechanic.service_radius_km} km</b></div></div>
              <form className="admin-review-actions" action={`/api/admin/mechanics/${mechanic.id}`} method="post"><input type="hidden" name="decision" value="approve"/><button className="btn btn-orange" type="submit"><BadgeCheck size={16}/> Verify mechanic</button><a href={`tel:${mechanic.phone}`} className="admin-contact-link">Contact applicant</a></form>
            </article>)}
          </div> : <div className="admin-empty"><span><BadgeCheck size={21}/></span><b>You’re all caught up</b><p>New mechanic applications will appear here after signup is completed.</p><Link href="/mechanic/register">View mechanic signup <ArrowRight size={14}/></Link></div>}
        </section>

        <section className="admin-panel" id="assistance"><div className="admin-panel-heading"><div><div className="eyebrow">SERVICE ACTIVITY</div><h2>Active assistance requests</h2></div><span className="admin-count-pill">{requestsResult.data?.length ?? 0} open</span></div>{requestsResult.data?.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Issue</th><th>Request</th><th>Status</th><th>Received</th></tr></thead><tbody>{requestsResult.data.map((request) => <tr key={request.id}><td><b>{request.breakdown_type}</b></td><td>{request.id.slice(0, 8).toUpperCase()}</td><td><span className={`admin-status status-${request.status}`}>{request.status.replaceAll('_', ' ')}</span></td><td>{new Date(request.created_at).toLocaleString()}</td></tr>)}</tbody></table></div> : <div className="admin-empty compact"><b>No active assistance requests</b><p>Current driver requests will show here.</p></div>}</section>

        <section className="admin-panel" id="alerts"><div className="admin-panel-heading"><div><div className="eyebrow">URGENT SUPPORT</div><h2>Active SOS alerts</h2></div><span className="admin-count-pill danger">{sosResult.data?.length ?? 0} active</span></div>{sosResult.data?.length ? <div className="admin-sos-list">{sosResult.data.map((alert) => <article className="admin-sos-row" key={alert.id}><span className="admin-sos-icon"><ShieldAlert size={18}/></span><span><b>SOS · {alert.id.slice(0, 8).toUpperCase()}</b><small>Account {alert.user_id.slice(0, 8)} · {new Date(alert.created_at).toLocaleString()}</small></span>{alert.latitude == null ? <span className="admin-location-missing">Location not shared</span> : <a target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${alert.latitude}&mlon=${alert.longitude}#map=15/${alert.latitude}/${alert.longitude}`}><MapPin size={14}/> View location</a>}</article>)}</div> : <div className="admin-empty compact"><b>No active SOS alerts</b><p>Emergency alerts needing attention will appear here.</p></div>}</section>
        <footer className="admin-footer">ROAD SOS · Secure operations workspace</footer>
      </div>
    </section>
  </main>;
}
