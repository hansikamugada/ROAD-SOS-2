'use client';

import { useState } from 'react';
import { Check, CloudOff, LoaderCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function MechanicAvailabilityToggle({
  userId,
  initialAvailable,
  verified,
}: {
  userId: string;
  initialAvailable: boolean;
  verified: boolean;
}) {
  const [available, setAvailable] = useState(initialAvailable);
  const [pendingChoice, setPendingChoice] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');

  async function setAvailability(next: boolean) {
    if (pendingChoice !== null || next === available || !verified) return;
    setPendingChoice(next);
    setMessage('');
    try {
      const { data, error } = await createClient()
        .from('mechanics')
        .update({ available: next })
        .eq('id', userId)
        .select('available')
        .single();
      if (error) throw error;
      setAvailable(data.available);
      setMessage(data.available ? 'You are online and can receive requests.' : 'You are offline and will not receive new requests.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Availability could not be updated. Please try again.');
    } finally {
      setPendingChoice(null);
    }
  }

  return <div className="mechanic-availability-control">
    <span className="mechanic-availability-label">YOUR AVAILABILITY</span>
    <div className="mechanic-availability-buttons" role="group" aria-label="Set your availability">
      <button type="button" className={`availability-choice online ${available ? 'selected' : ''}`} aria-pressed={available} disabled={!verified || pendingChoice !== null} onClick={() => setAvailability(true)}>
        {pendingChoice === true ? <LoaderCircle size={15} className="availability-spinner"/> : <Check size={15}/>} Online
      </button>
      <button type="button" className={`availability-choice offline ${!available ? 'selected' : ''}`} aria-pressed={!available} disabled={!verified || pendingChoice !== null} onClick={() => setAvailability(false)}>
        {pendingChoice === false ? <LoaderCircle size={15} className="availability-spinner"/> : <CloudOff size={15}/>} Offline
      </button>
    </div>
    <span className="mechanic-availability-message" aria-live="polite">{message || (verified ? 'Choose whether drivers can send you new requests.' : 'You can go online after your account is verified.')}</span>
  </div>;
}
