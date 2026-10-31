import Link from 'next/link';
import { Activity, ArrowRight, Compass, LifeBuoy, MapPin, Shield, ShieldAlert, Users, WalletCards, Wrench } from 'lucide-react';

export function DashboardSidebar({role,active,name}:{role:'user'|'mechanic';active:string;name:string}) {
  const driver=role==='user';
  const links=driver?[
    ['/dashboard','Overview',Activity],['/find-mechanics','Find mechanics',Compass],['/requests','My requests',WalletCards],['/emergency','Emergency contacts',Users],['/profile','My profile',Shield],
  ] as const:[
    ['/mechanic/dashboard','Overview',Activity],['/mechanic/dashboard#requests','Service requests',WalletCards],['/profile','Business profile',Wrench],
  ] as const;
  return <aside className="reference-sidebar"><div className="ref-side-label">YOUR SPACE</div><nav className="ref-side-nav">{links.map(([href,label,Icon])=><Link href={href} key={label} className={`ref-side-link ${active===label?'current':''}`}><Icon size={17}/>{label}</Link>)}</nav><div className="ref-side-rule"/><Link className="ref-side-link ref-sos-link" href={driver?'/emergency':'/mechanic/dashboard#requests'}><ShieldAlert size={17}/>{driver?'Emergency support':'Work requests'}</Link><div className="ref-side-bottom"><div className="ref-support-card"><span className="ref-support-icon"><LifeBuoy size={17}/></span><b>{driver?'Here when you need us.':'Your service desk is ready.'}</b><p>{driver?'Roadside help, without the runaround.':'Keep your workshop details up to date.'}</p><Link href={driver?'/find-mechanics':'/profile'}>{driver?'Explore nearby help':'Edit business profile'} <ArrowRight size={13}/></Link></div><Link href="/profile" className="ref-side-user"><span className="avatar">{name.trim().slice(0,1).toUpperCase()}</span><span><b>{name}</b><small>{driver?'Driver account':'Mechanic account'}</small></span><MapPin size={14}/></Link></div></aside>;
}
