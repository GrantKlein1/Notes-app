-- Leftover from one month is added onto the next month once.
-- carry_applied_from records which previous month was already rolled in.
alter table public.budget_allocations
  add column carry_applied_from text;

alter table public.budget_allocations
  add constraint budget_allocations_carry_from_check
  check (
    carry_applied_from is null
    or carry_applied_from ~ '^\d{4}-(0[1-9]|1[0-2])$'
  );

-- Standing amounts that are not tied to a month.
create table public.budget_long_term (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index budget_long_term_user_idx
  on public.budget_long_term (user_id, sort_order);

alter table public.budget_long_term enable row level security;

create policy budget_long_term_select_own
  on public.budget_long_term
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy budget_long_term_insert_own
  on public.budget_long_term
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy budget_long_term_update_own
  on public.budget_long_term
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy budget_long_term_delete_own
  on public.budget_long_term
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.budget_long_term from public, anon;
grant select, insert, update, delete on table public.budget_long_term to authenticated;
