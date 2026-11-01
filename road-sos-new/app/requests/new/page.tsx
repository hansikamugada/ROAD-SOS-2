'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Point = { latitude: number; longitude: number };
type NearbyMechanic = { id: string; garage_name: string | null; mechanic_name: string; distance_km: number };

export default function NewRequest() {
  const [mechanics, setMechanics] = useState<NearbyMechanic[]>([]);
  const [vehicle, setVehicle] = useState('');
  const [loc, setLoc] = useState<Point | null>(null);
  const [msg, setMsg] = useState('Get your location to load verified nearby mechanics.');
  const [busy, setBusy] = useState(false);

  async function searchNearby(point: Point) {
    setLoc(point);
    try {
      const [response, client] = await Promise.all([
        fetch(`/api/mechanics?lat=${point.latitude}&lon=${point.longitude}`),
        Promise.resolve(createClient()),
      ]);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Mechanic search failed.');
      setMechanics(Array.isArray(result) ? result : []);
      setMsg(result.length
        ? 'Choose a nearby verified mechanic to send your request.'
        : 'No eligible mechanics found. Mechanics must be verified, online, and have a saved workshop location within your area.');

      const { data: { user } } = await client.auth.getUser();
      if (user) {
        const { data } = await client.from('vehicles').select('id').eq('user_id', user.id).limit(1).maybeSingle();
        setVehicle(data?.id || '');
      }
    } catch (error) {
      setMechanics([]);
      setMsg(error instanceof Error ? error.message : 'Mechanic search failed. Please retry.');
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setMsg('Location is unavailable in this browser. Enter coordinates on Find mechanics and retry.');
      return;
    }
    setBusy(true);
    setMsg('Getting your location and searching nearby…');
    navigator.geolocation.getCurrentPosition(async (position) => {
      await searchNearby({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setBusy(false);
    }, (error) => {
      setMsg(error.code === error.PERMISSION_DENIED
        ? 'Location permission was denied. Allow location access and try again.'
        : 'Could not get your location. Check your signal and retry.');
      setBusy(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loc) {
      setMsg('Set your location before sending a request.');
      return;
    }
    if (!mechanics.length) {
      setMsg('No eligible mechanic is available near your location yet.');
      return;
    }
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mechanic_id: form.get('mechanic_id'),
          vehicle_id: vehicle || null,
          breakdown_type: form.get('breakdown_type'),
          description: form.get('description'),
          ...loc,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The assistance request could not be sent.');
      window.location.href = `/requests/${result.id}`;
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="container section">
    <div className="eyebrow">REQUEST ASSISTANCE</div>
    <h1>Tell us what happened</h1>
    <button className="btn btn-line" type="button" onClick={locate} disabled={busy}>{busy ? 'Searching…' : 'Use my current location'}</button>
    <p role="status" className="muted">{msg}</p>
    <form className="card form-card" style={{ maxWidth: 720, margin: '18px 0' }} onSubmit={send}>
      <div className="field"><label htmlFor="breakdown_type">Breakdown type</label><select id="breakdown_type" name="breakdown_type" required>{['Flat Tyre', 'Battery Problem', 'Engine Problem', 'Fuel Empty', 'Overheating', 'Brake Problem', 'Electrical Problem', 'Accident', 'Vehicle Not Starting', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></div>
      <div className="field"><label htmlFor="description">Describe the issue</label><textarea id="description" name="description" maxLength={1500}/></div>
      <div className="field"><label htmlFor="mechanic_id">Choose mechanic</label><select id="mechanic_id" name="mechanic_id" required defaultValue="" disabled={!mechanics.length}><option value="" disabled>{mechanics.length ? 'Select a nearby mechanic' : 'No eligible mechanics found'}</option>{mechanics.map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanic.garage_name || mechanic.mechanic_name} · {mechanic.distance_km.toFixed(1)} km</option>)}</select></div>
      <button className="btn btn-orange" disabled={busy || !mechanics.length || !loc}>{busy ? 'Sending…' : 'Send assistance request'}</button>
    </form>
  </main>;
}
