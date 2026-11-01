-- Mechanics may control their own online status after signing in. The RLS
-- policy scopes updates to the caller's own row; this trigger keeps approval
-- authority exclusively with ROAD SOS administrators.
create policy "mechanic self manage availability"
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
  if not (select private.is_admin())
     and new.verified is distinct from old.verified then
    raise exception 'Only ROAD SOS administrators can verify mechanics';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_mechanic_review_fields on public.mechanics;
create trigger protect_mechanic_review_fields
  before update on public.mechanics
  for each row execute function private.protect_mechanic_review_fields();

revoke all on function private.protect_mechanic_review_fields() from public, anon, authenticated;
