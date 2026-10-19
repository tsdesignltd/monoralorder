-- Apply once to a new dedicated MONORAL project. No customer data included.
begin;
create table public.monoral_records (
 id uuid primary key default gen_random_uuid(),
 seq bigint generated always as identity unique,
 owner_id text not null,
 kind text not null check(kind in ('customer','product','order','company','document')),
 data jsonb not null check(jsonb_typeof(data)='object'),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index monoral_records_owner_kind on public.monoral_records(owner_id,kind,seq desc);
create unique index monoral_company_owner on public.monoral_records(owner_id) where kind='company';
create unique index monoral_product_sku on public.monoral_records(owner_id,(data->>'sku')) where kind='product';
alter table public.monoral_records enable row level security;
revoke all on public.monoral_records from anon,authenticated;
grant select,insert,update on public.monoral_records to service_role;
grant usage,select on sequence public.monoral_records_seq_seq to service_role;
create unique index monoral_customer_legacy on public.monoral_records(owner_id,(data->>'legacyId')) where kind='customer' and coalesce(data->>'legacyId','')<>'';
create table public.monoral_billed_orders(
 owner_id text not null,
 order_id uuid not null references public.monoral_records(id),
 document_id uuid not null references public.monoral_records(id),
 primary key(owner_id,order_id)
);
alter table public.monoral_billed_orders enable row level security;
revoke all on public.monoral_billed_orders from anon,authenticated;
grant select,insert on public.monoral_billed_orders to service_role;
create function public.monoral_issue_document(p_owner text,p_data jsonb,p_order_ids uuid[])
returns setof public.monoral_records language plpgsql security invoker set search_path=public as $$
declare doc public.monoral_records;
begin
 if cardinality(p_order_ids)<1 then raise exception 'No orders'; end if;
 if exists(select 1 from unnest(p_order_ids) oid where not exists(select 1 from public.monoral_records where id=oid and owner_id=p_owner and kind='order')) then raise exception 'Order ownership mismatch'; end if;
 insert into public.monoral_records(owner_id,kind,data) values(p_owner,'document',p_data) returning * into doc;
 insert into public.monoral_billed_orders(owner_id,order_id,document_id) select p_owner,oid,doc.id from unnest(p_order_ids) oid;
 return next doc;
end;
$$;
revoke all on function public.monoral_issue_document(text,jsonb,uuid[]) from public,anon,authenticated;
grant execute on function public.monoral_issue_document(text,jsonb,uuid[]) to service_role;
create function public.monoral_import_customers(p_owner text,p_customers jsonb)
returns setof public.monoral_records language plpgsql security invoker set search_path=public as $$
begin
 return query insert into public.monoral_records(owner_id,kind,data)
 select p_owner,'customer',item from jsonb_array_elements(p_customers) item
 on conflict(owner_id,(data->>'legacyId')) where kind='customer' and coalesce(data->>'legacyId','')<>''
 do nothing returning *;
end;
$$;
revoke all on function public.monoral_import_customers(text,jsonb) from public,anon,authenticated;
grant execute on function public.monoral_import_customers(text,jsonb) to service_role;
commit;
