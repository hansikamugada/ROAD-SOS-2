-- Ensure every Supabase Auth account has a matching application profile.
-- Self-registration can only create the non-privileged user/mechanic roles.
create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, address, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      'ROAD SOS member'
    ),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'address', ''),
    case
      when new.raw_user_meta_data ->> 'account_type' = 'mechanic'
        then 'mechanic'::public.app_role
      else 'user'::public.app_role
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user_profile();

-- Repair Auth users created before the profile table/trigger existed.
insert into public.profiles (id, full_name, phone, address, role)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    'ROAD SOS member'
  ),
  nullif(u.raw_user_meta_data ->> 'phone', ''),
  nullif(u.raw_user_meta_data ->> 'address', ''),
  case
    when u.raw_user_meta_data ->> 'account_type' = 'mechanic'
      then 'mechanic'::public.app_role
    else 'user'::public.app_role
  end
from auth.users u
on conflict (id) do nothing;
