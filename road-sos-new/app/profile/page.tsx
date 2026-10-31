import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import ProfileEditor from './profile-editor';
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { user, supabase } = await requireUser();
  const [{ data: profile }, { data: vehicle }, { data: contacts }, { data: mechanic }] = await Promise.all([
    supabase.from('profiles').select('full_name,phone,address,role').eq('id', user.id).maybeSingle(),
    supabase.from('vehicles').select('*').eq('user_id', user.id).order('created_at').limit(1).maybeSingle(),
    supabase.from('emergency_contacts').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('mechanics').select('mechanic_name,garage_name,services,address,service_radius_km,working_hours,vehicle_types').eq('id', user.id).maybeSingle(),
  ]);
  if (!profile) redirect('/auth/login');
  return <main className="container profile-page"><div className="profile-cover"><div className="avatar avatar-profile">{(profile.full_name || 'R').slice(0,1).toUpperCase()}</div><div><div className="eyebrow">ACCOUNT SETTINGS</div><h1>{profile.role === 'mechanic' ? 'Your partner profile' : 'Your profile'}</h1><p>{profile.role === 'mechanic' ? 'Keep your contact and workshop details up to date.' : 'Manage your details so help is ready when you need it.'}</p></div><span className="profile-role">{profile.role === 'mechanic' ? 'Mechanic partner' : 'Driver account'}</span></div><ProfileEditor profile={profile} vehicle={vehicle} contacts={contacts || []} mechanic={mechanic} email={user.email || ''}/></main>;
}
