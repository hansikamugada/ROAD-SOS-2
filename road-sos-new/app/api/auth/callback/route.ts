import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const requested = url.searchParams.get('next') || '/dashboard';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard';
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!code || !projectUrl || !key) {
    return NextResponse.redirect(new URL('/auth/login?error=callback', url.origin));
  }

  const response = NextResponse.redirect(new URL(next, url.origin));
  const supabase = createServerClient(projectUrl, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => {
        request.cookies.set(name, value);
        response.cookies.set(name, value, options);
      }),
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    response.headers.set('location', new URL('/auth/login?error=callback', url.origin).toString());
    return response;
  }

  const user = data.user;
  const metadata = user.user_metadata || {};
  const { data: existing, error: lookupError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (lookupError) {
    response.headers.set('location', new URL('/auth/login?error=profile', url.origin).toString());
    return response;
  }

  // The auth trigger may have created this profile before email confirmation.
  // Do not return early: registration details in user metadata still need to be
  // copied into the vehicle, contact, or mechanic tables.
  const role = existing?.role || (metadata.account_type === 'mechanic' ? 'mechanic' : 'user');
  if (!existing) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: String(metadata.full_name || metadata.mechanic_name || user.email?.split('@')[0] || 'ROAD SOS member'),
      phone: metadata.phone ? String(metadata.phone) : null,
      address: metadata.address ? String(metadata.address) : null,
      role,
    });
    if (profileError) {
      response.headers.set('location', new URL('/auth/login?error=profile', url.origin).toString());
      return response;
    }
  }

  if (role === 'mechanic') {
    const requestedRadius = Number(metadata.service_radius_km || 15);
    const { error: mechanicError } = await supabase.from('mechanics').upsert({
      id: user.id,
      mechanic_name: String(metadata.mechanic_name || metadata.full_name || 'Mechanic'),
      phone: String(metadata.phone || ''),
      garage_name: String(metadata.garage_name || ''),
      services: String(metadata.services || '').split(',').map((item) => item.trim()).filter(Boolean),
      address: String(metadata.address || ''),
      service_radius_km: Number.isFinite(requestedRadius) && requestedRadius >= 1 && requestedRadius <= 300 ? requestedRadius : 15,
      working_hours: String(metadata.working_hours || ''),
      vehicle_types: String(metadata.vehicle_types || '').split(',').map((item) => item.trim()).filter(Boolean),
    }, { onConflict: 'id' });

    if (mechanicError) {
      response.headers.set('location', new URL('/auth/login?error=mechanic-profile', url.origin).toString());
      return response;
    }
  } else {
    if (metadata.vehicle_registration && metadata.vehicle_model && metadata.vehicle_type) {
      const { error: vehicleError } = await supabase.from('vehicles').upsert({
        user_id: user.id,
        vehicle_type: String(metadata.vehicle_type),
        model: String(metadata.vehicle_model),
        registration_number: String(metadata.vehicle_registration),
      }, { onConflict: 'user_id,registration_number' });
      if (vehicleError) {
        response.headers.set('location', new URL('/auth/login?error=vehicle', url.origin).toString());
        return response;
      }
    }

    for (const n of ['1', '2']) {
      const name = metadata[`contact${n}_name`];
      const phone = metadata[`contact${n}_phone`];
      if (!name || !phone) continue;
      const { error: contactError } = await supabase.from('emergency_contacts').upsert({
        user_id: user.id,
        name: String(name),
        phone: String(phone),
        relationship: String(metadata[`contact${n}_relationship`] || 'Other'),
      }, { onConflict: 'user_id,phone' });
      if (contactError) {
        response.headers.set('location', new URL('/auth/login?error=contacts', url.origin).toString());
        return response;
      }
    }
  }

  if (role === 'mechanic' && next === '/dashboard') {
    response.headers.set('location', new URL('/mechanic/dashboard', url.origin).toString());
  }
  return response;
}
