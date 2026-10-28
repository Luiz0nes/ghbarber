-- Roles: stored in a dedicated table, never on profiles/users
create type public.app_role as enum ('barbeiro');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

-- Helpers (security definer: avoids recursive RLS on user_roles)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_barbeiro()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'barbeiro'::public.app_role);
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.is_barbeiro() from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_barbeiro() to authenticated;

-- A barber sees and manages every booking and client contact
create policy "barbeiro select appointments" on public.appointments
  for select to authenticated using (public.has_role(auth.uid(), 'barbeiro'));

create policy "barbeiro update appointments" on public.appointments
  for update to authenticated
  using (public.has_role(auth.uid(), 'barbeiro'))
  with check (public.has_role(auth.uid(), 'barbeiro'));

create policy "barbeiro select profiles" on public.profiles
  for select to authenticated using (public.has_role(auth.uid(), 'barbeiro'));

-- Link bookings to client profiles so the panel can show name + WhatsApp
alter table public.appointments
  add constraint appointments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index appointments_starts_at_idx on public.appointments (starts_at);

-- Team management (security definer reads auth.users, guarded by a barber check)
create or replace function public.barbeiro_team()
returns table (user_id uuid, role public.app_role, full_name text, email text)
language sql stable security definer
set search_path = public
as $$
  select ur.user_id, ur.role, p.full_name, u.email
  from public.user_roles ur
  join auth.users u on u.id = ur.user_id
  left join public.profiles p on p.id = ur.user_id
  where public.has_role(auth.uid(), 'barbeiro')
  order by ur.created_at;
$$;

create or replace function public.add_barbeiro(_email text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare uid uuid;
begin
  if not public.has_role(auth.uid(), 'barbeiro') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select u.id into uid from auth.users u
    where lower(u.email) = lower(trim(coalesce(_email, ''))) limit 1;
  if uid is null then
    raise exception 'Nenhuma conta encontrada com esse e-mail. Peça para ele se cadastrar antes.' using errcode = 'P0001';
  end if;
  insert into public.user_roles (user_id, role) values (uid, 'barbeiro')
    on conflict (user_id, role) do nothing;
  return uid;
end;
$$;

create or replace function public.remove_barbeiro(_user_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'barbeiro') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if _user_id = auth.uid() then
    raise exception 'Você não pode remover a si mesmo.' using errcode = 'P0001';
  end if;
  delete from public.user_roles where user_id = _user_id and role = 'barbeiro';
end;
$$;

revoke all on function public.barbeiro_team() from public;
revoke all on function public.add_barbeiro(text) from public;
revoke all on function public.remove_barbeiro(uuid) from public;
grant execute on function public.barbeiro_team() to authenticated;
grant execute on function public.add_barbeiro(text) to authenticated;
grant execute on function public.remove_barbeiro(uuid) to authenticated;

-- First barber: the account that created the app
insert into public.user_roles (user_id, role)
select id, 'barbeiro' from auth.users where lower(email) = 'majinveg2016@gmail.com'
on conflict (user_id, role) do nothing;

-- Live updates for the panel
 do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments'
  ) then
    execute 'alter publication supabase_realtime add table public.appointments';
  end if;
exception when others then
  null;
end;
$$;