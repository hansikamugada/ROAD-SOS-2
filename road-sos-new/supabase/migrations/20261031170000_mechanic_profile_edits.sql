-- Let mechanics maintain their own business details without granting them
-- permission to approve themselves or change their online availability.
create policy "mechanic maintain own details"
  on public.mechanics
  for update
  to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

create or replace function private.protect_mechanic_review_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) and (
    new.verified is distinct from old.verified
    or new.available is distinct from old.available
  ) then
    raise exception 'Only ROAD SOS administrators can verify mechanics or change availability';
  end if;
  return new;
end;
$$;

create trigger protect_mechanic_review_fields
  before update on public.mechanics
  for each row execute function private.protect_mechanic_review_fields();

revoke all on function private.protect_mechanic_review_fields() from public, anon, authenticated;

-- Recover details captured at signup for accounts whose auth trigger created
-- a profile before the email-confirmation callback returned early.
-- Some older triggers also left mechanic signups with the default `user` role.
-- Promote only accounts whose signup metadata identifies a mechanic; admins
-- and all other roles are left untouched.
update public.profiles p
set role = 'mechanic'::public.app_role
from auth.users u
where u.id = p.id
  and p.role = 'user'::public.app_role
  and u.raw_user_meta_data ->> 'account_type' = 'mechanic';

insert into public.mechanics (
  id, mechanic_name, phone, garage_name, services, address,
  service_radius_km, working_hours, vehicle_types
)
select
  p.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'mechanic_name', ''), nullif(p.full_name, ''), 'Mechanic'),
  coalesce(nullif(u.raw_user_meta_data ->> 'phone', ''), p.phone, ''),
  coalesce(nullif(u.raw_user_meta_data ->> 'garage_name', ''), ''),
  coalesce(array(select trim(item) from unnest(string_to_array(coalesce(u.raw_user_meta_data ->> 'services', ''), ',')) as items(item) where trim(item) <> ''), '{}'),
  coalesce(nullif(u.raw_user_meta_data ->> 'address', ''), p.address, ''),
  case when coalesce(u.raw_user_meta_data ->> 'service_radius_km', '') ~ '^\d+(\.\d+)?$'
       then greatest(1, least(300, (u.raw_user_meta_data ->> 'service_radius_km')::numeric)) else 15 end,
  coalesce(nullif(u.raw_user_meta_data ->> 'working_hours', ''), ''),
  coalesce(array(select trim(item) from unnest(string_to_array(coalesce(u.raw_user_meta_data ->> 'vehicle_types', ''), ',')) as items(item) where trim(item) <> ''), '{}')
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'mechanic'
on conflict (id) do nothing;

insert into public.vehicles (user_id, vehicle_type, model, registration_number)
select
  p.id,
  u.raw_user_meta_data ->> 'vehicle_type',
  u.raw_user_meta_data ->> 'vehicle_model',
  u.raw_user_meta_data ->> 'vehicle_registration'
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'user'
  and nullif(u.raw_user_meta_data ->> 'vehicle_type', '') is not null
  and nullif(u.raw_user_meta_data ->> 'vehicle_model', '') is not null
  and nullif(u.raw_user_meta_data ->> 'vehicle_registration', '') is not null
on conflict (user_id, registration_number) do nothing;

insert into public.emergency_contacts (user_id, name, phone, relationship)
select p.id, u.raw_user_meta_data ->> ('contact' || n || '_name'),
  u.raw_user_meta_data ->> ('contact' || n || '_phone'),
  coalesce(nullif(u.raw_user_meta_data ->> ('contact' || n || '_relationship'), ''), 'Other')
from public.profiles p
join auth.users u on u.id = p.id
cross join (values ('1'), ('2')) as contacts(n)
where p.role = 'user'
  and nullif(u.raw_user_meta_data ->> ('contact' || n || '_name'), '') is not null
  and nullif(u.raw_user_meta_data ->> ('contact' || n || '_phone'), '') is not null
on conflict (user_id, phone) do nothing;
