-- Run after 001_monoral.sql. Only registered members can use the shared backend.
begin;
create table if not exists public.monoral_members (
 user_id uuid primary key references auth.users(id),
 workspace_id text not null check (workspace_id = 'monoral'),
 location text not null unique check (location in ('office','warehouse')),
 active boolean not null default true
);
alter table public.monoral_members enable row level security;
revoke all on public.monoral_members from public, anon, authenticated;
grant select on public.monoral_members to service_role;
commit;
