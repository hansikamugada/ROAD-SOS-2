-- ROAD SOS initial schema. Apply with the Supabase SQL editor or Supabase CLI.
create extension if not exists pgcrypto;
create type public.app_role as enum ('user','mechanic','admin');
create type public.request_status as enum ('waiting','accepted','rejected','on_the_way','arrived','in_progress','completed','cancelled');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null, phone text, address text, role public.app_role not null default 'user',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.vehicles (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 vehicle_type text not null, model text not null, registration_number text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,registration_number)
);
create table public.mechanics (
 id uuid primary key references public.profiles(id) on delete cascade, mechanic_name text not null, phone text not null,
 garage_name text not null, services text[] not null default '{}', address text not null,
 service_radius_km numeric not null default 15 check(service_radius_km between 1 and 300),
 working_hours text, vehicle_types text[] not null default '{}', available boolean not null default false,
 verified boolean not null default false, latitude double precision check(latitude between -90 and 90),
 longitude double precision check(longitude between -180 and 180), average_rating numeric(3,2) not null default 0 check(average_rating between 0 and 5),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.emergency_contacts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 name text not null, phone text not null, relationship text not null, created_at timestamptz not null default now(), unique(user_id,phone)
);
create table public.assistance_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), mechanic_id uuid not null references public.mechanics(id),
 vehicle_id uuid references public.vehicles(id) on delete set null,
 breakdown_type text not null check(breakdown_type in ('Flat Tyre','Battery Problem','Engine Problem','Fuel Empty','Overheating','Brake Problem','Electrical Problem','Accident','Vehicle Not Starting','Other')),
 description text check(length(description)<=1500), latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
 status public.request_status not null default 'waiting', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.request_status_history (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.assistance_requests(id) on delete cascade,
 actor_id uuid references public.profiles(id), status public.request_status not null, note text, created_at timestamptz not null default now()
);
create table public.sos_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 vehicle_id uuid references public.vehicles(id) on delete set null,
 latitude double precision check(latitude between -90 and 90), longitude double precision check(longitude between -180 and 180), accuracy_m numeric,
 status text not null default 'active' check(status in ('active','resolved','cancelled')), created_at timestamptz not null default now()
);
create table public.locations (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete cascade,
 mechanic_id uuid references public.mechanics(id) on delete cascade, latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180), accuracy_m numeric, recorded_at timestamptz not null default now(), check(user_id is not null or mechanic_id is not null)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id) on delete cascade,
 title text not null, body text not null, href text, read_at timestamptz, created_at timestamptz not null default now()
);
create table public.ratings (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique references public.assistance_requests(id) on delete cascade,
 user_id uuid not null references public.profiles(id), mechanic_id uuid not null references public.mechanics(id), score int not null check(score between 1 and 5),
 created_at timestamptz not null default now()
);
create table public.feedback (
 id uuid primary key default gen_random_uuid(), rating_id uuid not null unique references public.ratings(id) on delete cascade,
 message text not null check(length(message)<=2000), created_at timestamptz not null default now()
);
create index vehicles_user_idx on public.vehicles(user_id);
create index mechanics_eligible_idx on public.mechanics(verified,available);
create index requests_user_created_idx on public.assistance_requests(user_id,created_at desc);
create index requests_mechanic_status_idx on public.assistance_requests(mechanic_id,status);
create index sos_active_idx on public.sos_requests(status,created_at desc);
create index notifications_recipient_idx on public.notifications(recipient_id,created_at desc);

-- Authorization uses database profile roles, never user-editable user_metadata.
-- The narrow helper lives outside the exposed schema to avoid profiles RLS recursion.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
create or replace function private.refresh_mechanic_rating() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if (select auth.uid()) is null or (select auth.uid()) <> new.user_id then
   raise exception 'Rating actor must match the authenticated user';
 end if;
 update public.mechanics m set average_rating=(select coalesce(round(avg(r.score)::numeric,2),0) from public.ratings r where r.mechanic_id=new.mechanic_id) where m.id=new.mechanic_id;
 return new;
end
$$;
revoke all on function private.refresh_mechanic_rating() from public, anon, authenticated;
create trigger rating_refresh_average after insert on public.ratings for each row execute function private.refresh_mechanic_rating();
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
 begin new.updated_at=now(); return new; end
$$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger vehicles_updated before update on public.vehicles for each row execute function public.set_updated_at();
create trigger mechanics_updated before update on public.mechanics for each row execute function public.set_updated_at();
create trigger requests_updated before update on public.assistance_requests for each row execute function public.set_updated_at();

-- Profile records are created by registration clients, but users cannot elevate their own role.
alter table public.profiles enable row level security;
create policy "profile read self or admin" on public.profiles for select to authenticated using(id=(select auth.uid()) or (select private.is_admin()));
create policy "profile insert self as non-admin" on public.profiles for insert to authenticated with check(id=(select auth.uid()) and role in ('user','mechanic'));
create policy "profile update self without role change" on public.profiles for update to authenticated using(id=(select auth.uid()) or (select private.is_admin())) with check((id=(select auth.uid()) and role in ('user','mechanic')) or (select private.is_admin()));
alter table public.vehicles enable row level security;
create policy "vehicle owner access" on public.vehicles for all to authenticated using(user_id=(select auth.uid()) or (select private.is_admin())) with check(user_id=(select auth.uid()) or (select private.is_admin()));
alter table public.mechanics enable row level security;
create policy "verified mechanics discoverable" on public.mechanics for select to anon,authenticated using(verified and available or id=(select auth.uid()) or (select private.is_admin()));
create policy "mechanic signup self" on public.mechanics for insert to authenticated with check(id=(select auth.uid()) and verified=false and available=false);
create policy "mechanic update self or admin" on public.mechanics for update to authenticated using(id=(select auth.uid()) or (select private.is_admin())) with check((id=(select auth.uid()) and verified=false) or (select private.is_admin()));
alter table public.emergency_contacts enable row level security;
create policy "contacts owner access" on public.emergency_contacts for all to authenticated using(user_id=(select auth.uid()) or (select private.is_admin())) with check(user_id=(select auth.uid()) or (select private.is_admin()));
alter table public.assistance_requests enable row level security;
create policy "request participants read" on public.assistance_requests for select to authenticated using(user_id=(select auth.uid()) or mechanic_id=(select auth.uid()) or (select private.is_admin()));
create policy "customer creates own request" on public.assistance_requests for insert to authenticated with check(user_id=(select auth.uid()) and status='waiting');
create policy "request participant updates" on public.assistance_requests for update to authenticated using(user_id=(select auth.uid()) or mechanic_id=(select auth.uid()) or (select private.is_admin())) with check(user_id=(select auth.uid()) or mechanic_id=(select auth.uid()) or (select private.is_admin()));
alter table public.request_status_history enable row level security;
create policy "status history participants read" on public.request_status_history for select to authenticated using(exists(select 1 from public.assistance_requests r where r.id=request_id and (r.user_id=(select auth.uid()) or r.mechanic_id=(select auth.uid()) or (select private.is_admin()))));
create policy "status history participants add" on public.request_status_history for insert to authenticated with check(actor_id=(select auth.uid()) and exists(select 1 from public.assistance_requests r where r.id=request_id and (r.user_id=(select auth.uid()) or r.mechanic_id=(select auth.uid()) or (select private.is_admin()))));
alter table public.sos_requests enable row level security;
create policy "SOS owner and admin read" on public.sos_requests for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy "SOS owner create" on public.sos_requests for insert to authenticated with check(user_id=(select auth.uid()));
create policy "SOS owner update" on public.sos_requests for update to authenticated using(user_id=(select auth.uid()) or (select private.is_admin())) with check(user_id=(select auth.uid()) or (select private.is_admin()));
alter table public.locations enable row level security;
create policy "location owner access" on public.locations for all to authenticated using(user_id=(select auth.uid()) or mechanic_id=(select auth.uid()) or (select private.is_admin())) with check(user_id=(select auth.uid()) or mechanic_id=(select auth.uid()) or (select private.is_admin()));
alter table public.notifications enable row level security;
create policy "notifications recipient" on public.notifications for select to authenticated using(recipient_id=(select auth.uid()) or (select private.is_admin()));
create policy "notifications recipient update" on public.notifications for update to authenticated using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
create policy "request participants create notifications" on public.notifications for insert to authenticated with check(exists(select 1 from public.assistance_requests r where (r.user_id=(select auth.uid()) and recipient_id=r.mechanic_id) or (r.mechanic_id=(select auth.uid()) and recipient_id=r.user_id)));
alter table public.ratings enable row level security;
create policy "ratings participant read" on public.ratings for select to authenticated using(user_id=(select auth.uid()) or mechanic_id=(select auth.uid()) or (select private.is_admin()));
create policy "customer rates completed own request" on public.ratings for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.assistance_requests r where r.id=request_id and r.user_id=(select auth.uid()) and r.mechanic_id=mechanic_id and r.status='completed'));
alter table public.feedback enable row level security;
create policy "feedback participant read" on public.feedback for select to authenticated using(exists(select 1 from public.ratings r where r.id=rating_id and (r.user_id=(select auth.uid()) or r.mechanic_id=(select auth.uid()) or (select private.is_admin()))));
create policy "feedback create own rating" on public.feedback for insert to authenticated with check(exists(select 1 from public.ratings r where r.id=rating_id and r.user_id=(select auth.uid())));

-- Authenticated users read/write only their authorized rows through RLS.
grant usage on schema public to anon,authenticated;
grant select on public.mechanics to anon,authenticated;
grant select on public.ratings,public.feedback to authenticated;
grant select,insert,update,delete on public.profiles,public.vehicles,public.mechanics,public.emergency_contacts,public.assistance_requests,public.request_status_history,public.sos_requests,public.locations,public.notifications,public.ratings,public.feedback to authenticated;
grant usage,select on all sequences in schema public to authenticated;
