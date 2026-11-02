-- Personal notes, budget, and prayer.
-- Product columns match the app contract. updated_at and deleted_at are on
-- every table so devices can last-write-wins sync and propagate deletes.
-- Row level security allows only auth.uid() = user_id.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('note', 'prayer')),
  title text not null default '',
  content jsonb not null default '{}'::jsonb,
  pinned boolean not null default false,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  sort_order integer not null default 0,
  archived boolean not null default false,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.budget_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  category_id uuid not null references public.budget_categories (id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.budget_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  category_id uuid not null references public.budget_categories (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index budget_allocations_live_key
  on public.budget_allocations (user_id, month, category_id)
  where deleted_at is null;

create index notes_user_updated_idx
  on public.notes (user_id, updated_at);

create index budget_categories_user_idx
  on public.budget_categories (user_id, sort_order);

create index budget_allocations_user_month_idx
  on public.budget_allocations (user_id, month);

create index budget_transactions_user_month_idx
  on public.budget_transactions (user_id, month, created_at desc);

alter table public.notes enable row level security;
alter table public.budget_categories enable row level security;
alter table public.budget_allocations enable row level security;
alter table public.budget_transactions enable row level security;

create policy notes_select_own
  on public.notes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy notes_insert_own
  on public.notes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy notes_update_own
  on public.notes
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy notes_delete_own
  on public.notes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy budget_categories_select_own
  on public.budget_categories
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy budget_categories_insert_own
  on public.budget_categories
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy budget_categories_update_own
  on public.budget_categories
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy budget_categories_delete_own
  on public.budget_categories
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy budget_allocations_select_own
  on public.budget_allocations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy budget_allocations_insert_own
  on public.budget_allocations
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.budget_categories as category
      where category.id = category_id
        and category.user_id = (select auth.uid())
    )
  );

create policy budget_allocations_update_own
  on public.budget_allocations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.budget_categories as category
      where category.id = category_id
        and category.user_id = (select auth.uid())
    )
  );

create policy budget_allocations_delete_own
  on public.budget_allocations
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy budget_transactions_select_own
  on public.budget_transactions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy budget_transactions_insert_own
  on public.budget_transactions
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.budget_categories as category
      where category.id = category_id
        and category.user_id = (select auth.uid())
    )
  );

create policy budget_transactions_update_own
  on public.budget_transactions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.budget_categories as category
      where category.id = category_id
        and category.user_id = (select auth.uid())
    )
  );

create policy budget_transactions_delete_own
  on public.budget_transactions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.notes from public, anon;
revoke all on table public.budget_categories from public, anon;
revoke all on table public.budget_allocations from public, anon;
revoke all on table public.budget_transactions from public, anon;

grant select, insert, update, delete on table public.notes to authenticated;
grant select, insert, update, delete on table public.budget_categories to authenticated;
grant select, insert, update, delete on table public.budget_allocations to authenticated;
grant select, insert, update, delete on table public.budget_transactions to authenticated;
