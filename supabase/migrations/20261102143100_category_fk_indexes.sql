create index budget_allocations_category_id_idx
  on public.budget_allocations (category_id);

create index budget_transactions_category_id_idx
  on public.budget_transactions (category_id);
