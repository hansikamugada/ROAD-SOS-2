'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const [busy,setBusy]=useState(false);
  async function signOut(){setBusy(true);const{error}=await createClient().auth.signOut();if(error){setBusy(false);return}window.location.replace('/')}
  return <button className="header-signout" onClick={signOut} disabled={busy}>{busy?'Signing out…':'Sign out'}</button>;
}
