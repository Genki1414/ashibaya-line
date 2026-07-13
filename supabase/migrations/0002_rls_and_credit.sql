-- RLS ＋ 信用実績プロセッサ（docs/ashiba_platform_接続指示.md §5）
--
-- 方針:
--  ・取引/メッセージ/イベントは「関係者限定」（元請 or 協力 or 運営admin）。
--  ・会社の信用情報（companies）と案件（projects）は公開読み取り。
--  ・信用実績（companies.metrics）の更新はユーザー権限では不可。TransactionCompleted を
--    受けた SECURITY DEFINER 関数だけが書き換える（結果整合・冪等）。

-- ── 呼び出し元の会社ID集合 ───────────────────────────────────────────
-- company_users の所属（＝擬似ログイン切替で複数社に属せる）と、将来のJWTクレーム
-- app_metadata.company_id の両対応。認証方式が変わっても policy 側は無傷。
create or replace function public.current_company_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.company_users where auth_user_id = auth.uid()
  union
  select nullif(auth.jwt() -> 'app_metadata' ->> 'company_id', '')
$$;

create or replace function public.auth_is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
$$;

alter table companies enable row level security;
alter table projects enable row level security;
alter table transactions enable row level security;
alter table chats enable row level security;
alter table messages enable row level security;
alter table domain_events enable row level security;
alter table company_users enable row level security;

-- ── companies: 信用情報は公開読み取り、更新は自社/運営のみ ────────────
create policy companies_select_public on companies
  for select using (true);
create policy companies_update_own on companies
  for update using (id in (select current_company_ids()) or auth_is_admin())
  with check (id in (select current_company_ids()) or auth_is_admin());
create policy companies_insert_admin on companies
  for insert with check (auth_is_admin());

-- ── projects: 案件は公開読み取り、投稿/更新は元請/運営のみ ────────────
create policy projects_select_public on projects
  for select using (true);
create policy projects_write_prime on projects
  for all
  using (prime_id in (select current_company_ids()) or auth_is_admin())
  with check (prime_id in (select current_company_ids()) or auth_is_admin());

-- ── transactions: 関係者限定（SELECT/UPDATE/INSERT） ──────────────────
create policy transactions_related_only on transactions
  for all
  using (
    prime_id in (select current_company_ids())
    or partner_id in (select current_company_ids())
    or auth_is_admin()
  )
  with check (
    prime_id in (select current_company_ids())
    or partner_id in (select current_company_ids())
    or auth_is_admin()
  );

-- ── chats / messages: 案件・取引の関係者のみ ─────────────────────────
create policy chats_related_only on chats
  for all
  using (
    prime_id in (select current_company_ids())
    or partner_id in (select current_company_ids())
    or auth_is_admin()
  )
  with check (
    prime_id in (select current_company_ids())
    or partner_id in (select current_company_ids())
    or auth_is_admin()
  );

create policy messages_related_only on messages
  for all
  using (
    chat_key in (
      select key from chats
      where prime_id in (select current_company_ids())
         or partner_id in (select current_company_ids())
    )
    or auth_is_admin()
  )
  with check (
    chat_key in (
      select key from chats
      where prime_id in (select current_company_ids())
         or partner_id in (select current_company_ids())
    )
    or auth_is_admin()
  );

-- ── domain_events: 参照アグリゲート（取引）の関係者のみ ───────────────
create policy domain_events_related_only on domain_events
  for all
  using (
    aggregate_id in (
      select id from transactions
      where prime_id in (select current_company_ids())
         or partner_id in (select current_company_ids())
    )
    or auth_is_admin()
  )
  with check (
    aggregate_id in (
      select id from transactions
      where prime_id in (select current_company_ids())
         or partner_id in (select current_company_ids())
    )
    or auth_is_admin()
  );

-- ── company_users: 自分の所属のみ参照、変更は運営のみ ─────────────────
create policy company_users_select_self on company_users
  for select using (auth_user_id = auth.uid() or auth_is_admin());
create policy company_users_write_admin on company_users
  for all using (auth_is_admin()) with check (auth_is_admin());

-- ─────────────────────────────────────────────────────────────────────
-- 信用実績プロセッサ（特権・冪等）
-- TransactionCompleted イベントを受け、双方の companies.metrics を更新する。
-- ロジックは src/domain/credit/metrics.ts の applyCompletionAsPrime / asPartner に対応。
-- SECURITY DEFINER で RLS を越えて companies を更新する。processed_at 済みは無視（冪等）。
-- payload 形状: { transactionId, primeId, partnerId, onTime(bool), avgPayDays(int) }
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.apply_transaction_completion(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev         domain_events%rowtype;
  prime_id   text;
  partner_id text;
  on_time    boolean;
  pay_days   int;
  done_at    date;
  m          jsonb;
  old_paid   int;
  new_avg    int;
begin
  -- 未処理の TransactionCompleted を1件ロックして取得（冪等の要）。
  select * into ev
  from domain_events
  where id = p_event_id and type = 'TransactionCompleted' and processed_at is null
  for update;
  if not found then
    return;
  end if;

  prime_id   := ev.payload ->> 'primeId';
  partner_id := ev.payload ->> 'partnerId';
  on_time    := coalesce((ev.payload ->> 'onTime')::boolean, true);
  pay_days   := coalesce((ev.payload ->> 'avgPayDays')::int, 0);
  done_at    := ev.occurred_at;

  -- 元請: completed/paidCount/onTime|late/avgPayDays/lastTrade/継続 を更新。
  select metrics into m from companies where id = prime_id for update;
  if found then
    old_paid := coalesce((m ->> 'paidCount')::int, 0);
    new_avg  := round(((coalesce((m ->> 'avgPayDays')::numeric, 0) * old_paid) + pay_days) / (old_paid + 1));
    m := jsonb_set(m, '{completed}',   to_jsonb(coalesce((m ->> 'completed')::int, 0) + 1));
    m := jsonb_set(m, '{paidCount}',   to_jsonb(old_paid + 1));
    m := jsonb_set(m, '{onTimeCount}', to_jsonb(coalesce((m ->> 'onTimeCount')::int, 0) + (case when on_time then 1 else 0 end)));
    m := jsonb_set(m, '{lateCount}',   to_jsonb(coalesce((m ->> 'lateCount')::int, 0) + (case when on_time then 0 else 1 end)));
    m := jsonb_set(m, '{avgPayDays}',  to_jsonb(new_avg));
    m := jsonb_set(m, '{lastTrade}',   to_jsonb(done_at::text));
    if not (m -> 'continuousPartnerIds' ? partner_id) then
      m := jsonb_set(m, '{continuousPartnerIds}', (m -> 'continuousPartnerIds') || to_jsonb(partner_id));
    end if;
    update companies set metrics = m, updated_at = now() where id = prime_id;
  end if;

  -- 協力: completed/lastTrade/継続 を更新（支払い側の指標は増やさない）。
  select metrics into m from companies where id = partner_id for update;
  if found then
    m := jsonb_set(m, '{completed}', to_jsonb(coalesce((m ->> 'completed')::int, 0) + 1));
    m := jsonb_set(m, '{lastTrade}', to_jsonb(done_at::text));
    if not (m -> 'continuousPartnerIds' ? prime_id) then
      m := jsonb_set(m, '{continuousPartnerIds}', (m -> 'continuousPartnerIds') || to_jsonb(prime_id));
    end if;
    update companies set metrics = m, updated_at = now() where id = partner_id;
  end if;

  update domain_events set processed_at = now() where id = ev.id;
end;
$$;

-- TransactionCompleted の挿入で自動的に信用実績を反映（アプリは service-role 不要）。
create or replace function public.on_domain_event_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'TransactionCompleted' then
    perform public.apply_transaction_completion(new.id);
  end if;
  return new;
end;
$$;

create trigger trg_domain_events_completion
  after insert on domain_events
  for each row execute function public.on_domain_event_inserted();
