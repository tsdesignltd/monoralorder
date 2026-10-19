begin;
create unique index if not exists monoral_legacy_sale_unique on public.monoral_records(owner_id,(data->'legacy'->>'legacyInvoiceNumber')) where kind='order' and data ? 'legacy';
create or replace function public.monoral_protect_legacy() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if TG_OP='UPDATE' and OLD.kind='order' and OLD.data ? 'legacy' then
   raise exception 'Imported historical sales are read-only';
 end if;
 if NEW.kind='document' and exists(
   select 1 from public.monoral_records r where r.owner_id=NEW.owner_id and r.kind='order' and r.data ? 'legacy'
   and (r.id::text=NEW.data->>'orderId' or exists(select 1 from jsonb_array_elements(coalesce(NEW.data->'monthly'->'orders','[]'::jsonb)) x where x->>'id'=r.id::text))
 ) then raise exception 'Historical sales cannot be billed again'; end if;
 return NEW;
end; $$;
revoke all on function public.monoral_protect_legacy() from public,anon,authenticated;
create or replace trigger monoral_protect_legacy before insert or update on public.monoral_records for each row execute function public.monoral_protect_legacy();
commit;
