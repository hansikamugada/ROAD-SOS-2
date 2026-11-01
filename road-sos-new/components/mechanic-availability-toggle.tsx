'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CloudOff, LoaderCircle, MapPin, Navigation } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function MechanicAvailabilityToggle({
  userId,
  initialAvailable,
  verified,
  hasServiceLocation,
}: {
  userId: string;
  initialAvailable: boolean;
  verified: boolean;
  hasServiceLocation: boolean;
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
      setMessage(data.available
        ? hasServiceLocation ? 'You are online and can receive nearby requests.' : 'You are online. Save your workshop location below so nearby drivers can find you.'
        : 'You are offline and will not receive new requests.');
    } catch (error) {
      const databaseError = error && typeof error === 'object' ? error as { code?: string; message?: string } : null;
      if (databaseError?.code === '42501') {
        setMessage('Supabase blocked this change with its row security rules. Apply the mechanic availability migration, then try again.');
      } else if (databaseError?.code === 'PGRST116') {
        setMessage('Your mechanic record could not be found. Sign out, sign in again, and retry.');
      } else {
        setMessage(databaseError?.message || (error instanceof Error ? error.message : 'Availability could not be updated. Please try again.'));
      }
    } finally {
      setPendingChoice(null);
    }
  }

  return <div className="mechanic-availability-control">
    <div className="mechanic-availability-area">
      <div className="availability-card"><span className={`availability-dot ${available ? 'online' : ''}`}/><span><b>{available ? 'You’re online' : 'Currently offline'}</b><small>{available ? hasServiceLocation ? 'Visible to nearby drivers' : 'Save a workshop location to appear in nearby searches' : 'Set your status below whenever you are ready'}</small></span></div>
      <div className="mechanic-availability-actions">
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
      </div>
    </div>
  </div>;
}

export function MechanicServiceLocation({
  userId,
  initialLatitude,
  initialLongitude,
}: {
  userId: string;
  initialLatitude: number | null;
  initialLongitude: number | null;
}) {
  const router = useRouter();
  const [location, setLocation] = useState(initialLatitude != null && initialLongitude != null ? { latitude: initialLatitude, longitude: initialLongitude } : null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function saveWorkshopLocation() {
    if (!navigator.geolocation) {
      setMessage('Location is unavailable in this browser. Allow location access or use a supported browser.');
      return;
    }
    setBusy(true);
    setMessage('Getting your workshop location…');
    navigator.geolocation.getCurrentPosition(async (position) => {
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      try {
        const client = createClient();
        const { error } = await client
          .from('mechanics')
          .update({ latitude: point.latitude, longitude: point.longitude })
          .eq('id', userId);
        if (error) throw error;
        const { data: saved, error: readError } = await client
          .from('mechanics')
          .select('id,latitude,longitude')
          .eq('id', userId)
          .maybeSingle();
        if (readError) throw readError;
        if (!saved) {
          throw new Error('Your mechanic profile could not be found. Refresh the page and sign in again.');
        }
        if (Math.abs(Number(saved.latitude) - point.latitude) > 0.000001 || Math.abs(Number(saved.longitude) - point.longitude) > 0.000001) {
          throw new Error('Supabase did not save the workshop location. Check the mechanic self-update policy, then retry.');
        }
        setLocation({ latitude: saved.latitude, longitude: saved.longitude });
        setMessage('Service location saved. Nearby drivers can now find your workshop when you are online.');
        router.refresh();
      } catch (error) {
        const databaseError = error && typeof error === 'object' ? error as { code?: string; message?: string } : null;
        setMessage(databaseError?.code === '42501'
          ? 'Supabase blocked saving this location with its row security rules. Apply the mechanic availability migration, then retry.'
          : databaseError?.message || (error instanceof Error ? error.message : 'Could not save your workshop location.'));
      } finally {
        setBusy(false);
      }
    }, (error) => {
      setMessage(error.code === error.PERMISSION_DENIED
        ? 'Location permission was denied. Allow location access in your browser and try again.'
        : 'Could not get your location. Move somewhere with a GPS signal and retry.');
      setBusy(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  return <section className="mechanic-location-panel card">
    <span className="mechanic-location-icon"><MapPin size={18}/></span>
    <div className="mechanic-location-copy"><b>Workshop service location</b><small>{location ? `Saved · ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Set this while you are at your workshop so nearby drivers can find you.'}</small>{message && <small className="mechanic-location-message" role="status">{message}</small>}</div>
    <button type="button" className="btn btn-line btn-compact" disabled={busy} onClick={saveWorkshopLocation}><Navigation size={15}/>{busy ? 'Saving…' : location ? 'Update location' : 'Use current location'}</button>
  </section>;
}
