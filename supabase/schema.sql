-- Run in the Supabase SQL Editor for EasyChurchNotes.
create table if not exists public.notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topic text not null default '', preacher text not null default '',
  tags text[] not null default '{}',
  kind text not null default 'sermon' check (kind in ('sermon','study','personal')),
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}',
  plain_text text not null default '', pinned boolean not null default false,
  deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists notes_owner_updated on public.notes(user_id, updated_at desc);
alter table public.notes enable row level security;
revoke all on public.notes from anon;
revoke all on public.notes from authenticated;
grant select, insert, update, delete on public.notes to authenticated;
drop policy if exists notes_select_own on public.notes;
create policy notes_select_own on public.notes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists notes_insert_own on public.notes;
create policy notes_insert_own on public.notes for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists notes_update_own on public.notes;
create policy notes_update_own on public.notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists notes_delete_own on public.notes;
create policy notes_delete_own on public.notes for delete to authenticated using ((select auth.uid()) = user_id);
