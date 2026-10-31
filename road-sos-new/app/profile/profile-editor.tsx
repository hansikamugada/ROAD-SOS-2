'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Contact = { id: string; name: string; phone: string; relationship: string };
type Props = { profile: { full_name: string; phone: string | null; address: string | null; role: string }; vehicle: { id: string; vehicle_type: string; model: string; registration_number: string } | null; contacts: Contact[]; mechanic: { mechanic_name: string; garage_name: string; services: string[]; address: string; service_radius_km: number; working_hours: string | null; vehicle_types: string[] } | null; email: string };

export default function ProfileEditor({ profile, vehicle, contacts, mechanic, email }: Props) {
  const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false); const router=useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage(''); const form=new FormData(e.currentTarget); const client=createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) { setMessage('Your session expired. Please sign in again.'); setBusy(false); return; }
    const { error: profileError } = await client.from('profiles').update({ full_name: String(form.get('full_name')), phone: String(form.get('phone')), address: String(form.get('address')) }).eq('id', user.id);
    if (profileError) { setMessage(profileError.message); setBusy(false); return; }
    if (profile.role === 'user') {
      const type=String(form.get('vehicle_type')), model=String(form.get('vehicle_model')), registration=String(form.get('registration_number'));
      if (type && model && registration) {
        const result = vehicle ? await client.from('vehicles').update({ vehicle_type:type, model, registration_number:registration }).eq('id',vehicle.id) : await client.from('vehicles').insert({ user_id:user.id, vehicle_type:type, model, registration_number:registration });
        if (result.error) { setMessage(result.error.message); setBusy(false); return; }
      }
      const saved=contacts || [];
      for (let i=0;i<2;i++) {
        const name=String(form.get(`contact${i+1}_name`)), phone=String(form.get(`contact${i+1}_phone`)), relationship=String(form.get(`contact${i+1}_relationship`)||'Other');
        const old=saved[i];
        const result=name&&phone ? old ? await client.from('emergency_contacts').update({name,phone,relationship}).eq('id',old.id) : await client.from('emergency_contacts').insert({user_id:user.id,name,phone,relationship}) : old ? await client.from('emergency_contacts').delete().eq('id',old.id) : {error:null};
        if (result.error) { setMessage(result.error.message); setBusy(false); return; }
      }
    } else if (profile.role === 'mechanic') {
      const result=await client.from('mechanics').update({mechanic_name:String(form.get('mechanic_name')),garage_name:String(form.get('garage_name')),services:String(form.get('services')).split(',').map(x=>x.trim()).filter(Boolean),address:String(form.get('address')),service_radius_km:Number(form.get('service_radius_km')),working_hours:String(form.get('working_hours')),vehicle_types:String(form.get('vehicle_types')).split(',').map(x=>x.trim()).filter(Boolean)}).eq('id',user.id);
      if (result.error) { setMessage(result.error.message); setBusy(false); return; }
    }
    setMessage('Your profile has been saved.'); setBusy(false); router.refresh();
  }
  async function signOut(){const {error}=await createClient().auth.signOut();if(!error)location.href='/';else setMessage(error.message);}
  return <form className="profile-form" onSubmit={submit}>
    <section className="card profile-section"><div className="profile-section-heading"><div><div className="eyebrow">BASIC INFORMATION</div><h2>Personal details</h2></div><span className="profile-section-icon">✦</span></div><div className="profile-fields"><Field name="full_name" label="Full name" defaultValue={profile.full_name}/><Field name="email" label="Email address" defaultValue={email} type="email" disabled/><Field name="phone" label="Phone number" defaultValue={profile.phone || ''} type="tel"/><Field name="address" label={profile.role === 'mechanic' ? 'Workshop address' : 'Home address'} defaultValue={profile.role === 'mechanic' ? mechanic?.address || profile.address || '' : profile.address || ''}/></div></section>
    {profile.role==='user' ? <><section className="card profile-section"><div className="profile-section-heading"><div><div className="eyebrow">YOUR VEHICLE</div><h2>Vehicle details</h2></div><span className="profile-section-icon">🚘</span></div><div className="profile-fields"><Field name="vehicle_type" label="Vehicle type" defaultValue={vehicle?.vehicle_type || ''} placeholder="Car, motorcycle, van…"/><Field name="vehicle_model" label="Make and model" defaultValue={vehicle?.model || ''} placeholder="e.g. Honda City"/><Field name="registration_number" label="Registration number" defaultValue={vehicle?.registration_number || ''} placeholder="e.g. KA 01 AB 1234"/></div></section><section className="card profile-section"><div className="profile-section-heading"><div><div className="eyebrow">PEACE OF MIND</div><h2>Emergency contacts</h2><p>Add up to two people you trust.</p></div><span className="profile-section-icon">♡</span></div><div className="profile-fields">{[0,1].map((i)=>{const c=contacts[i];return <div className="contact-group" key={i}><b>Contact {i+1}</b><Field name={`contact${i+1}_name`} label="Name" defaultValue={c?.name||''}/><Field name={`contact${i+1}_phone`} label="Phone" defaultValue={c?.phone||''} type="tel"/><Field name={`contact${i+1}_relationship`} label="Relationship" defaultValue={c?.relationship||''} placeholder="Family, friend…"/></div>})}</div></section></> : profile.role==='mechanic' && <section className="card profile-section"><div className="profile-section-heading"><div><div className="eyebrow">YOUR WORKSHOP</div><h2>Business details</h2></div><span className="profile-section-icon">🔧</span></div><div className="profile-fields"><Field name="mechanic_name" label="Mechanic name" defaultValue={mechanic?.mechanic_name || profile.full_name}/><Field name="garage_name" label="Garage name" defaultValue={mechanic?.garage_name || ''}/><Field name="services" label="Services (comma separated)" defaultValue={mechanic?.services?.join(', ') || ''}/><Field name="service_radius_km" label="Service radius (km)" defaultValue={mechanic?.service_radius_km || 15} type="number"/><Field name="working_hours" label="Working hours" defaultValue={mechanic?.working_hours || ''}/><Field name="vehicle_types" label="Vehicle types (comma separated)" defaultValue={mechanic?.vehicle_types?.join(', ') || ''}/></div></section>}
    {message&&<p className={message.includes('saved')?'success-message':'notice'} role="status">{message}</p>}<div className="profile-save-row"><button className="btn btn-orange" disabled={busy}>{busy?'Saving changes…':'Save changes'}</button><button className="btn btn-line" type="button" onClick={signOut}>Sign out</button></div>
  </form>;
}
function Field({name,label,defaultValue,type='text',disabled=false,placeholder}:{name:string;label:string;defaultValue:string|number;type?:string;disabled?:boolean;placeholder?:string}){return <div className="field"><label htmlFor={name}>{label}</label><input id={name} name={name} type={type} defaultValue={defaultValue} disabled={disabled} placeholder={placeholder}/></div>}
