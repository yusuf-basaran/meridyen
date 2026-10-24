begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  feed_url text unique not null check (feed_url ~ '^https://'),
  category text not null check (category in ('Gündem','Ekonomi','Dünya','Spor','Teknoloji','Bilim','Sağlık')),
  trust_level int not null default 2 check (trust_level between 1 and 3),
  active boolean not null default false,
  publisher_key text not null,
  terms_url text,
  terms_confirmed boolean not null default false,
  last_fetched_at timestamptz,
  check (not active or (terms_confirmed and terms_url ~ '^https://'))
);
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (length(slug) between 1 and 80),
  title text not null,
  summary text not null,
  body text,
  category text not null check (category in ('Gündem','Ekonomi','Dünya','Spor','Teknoloji','Bilim','Sağlık')),
  source_id uuid references public.sources(id) on delete set null,
  source_name text not null,
  source_url text unique not null check (source_url ~ '^https?://'),
  source_title text,
  source_excerpt text,
  source_published_at timestamptz,
  image_url text,
  status text not null default 'draft' check (status in ('pending','draft','published','rejected')),
  sensitivity text not null default 'normal' check (sensitivity in ('normal','hassas')),
  verdict text not null default 'pending' check (verdict in ('pending','auto_pass','needs_review','auto_reject')),
  confidence int check (confidence between 0 and 100),
  verification jsonb,
  corroborating_sources jsonb not null default '[]' check (jsonb_typeof(corroborating_sources) = 'array'),
  review_reason text,
  review_override boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by uuid,
  featured boolean not null default false,
  content_hash text unique,
  writer_provider text,
  writer_model text,
  writer_family text,
  rewrite_count int not null default 0 check (rewrite_count between 0 and 1),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.verification_log (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id) on delete cascade,
  role text not null check (role in ('denetci1','denetci2','kural','capraz','yazar_yeniden','editor')),
  provider text,
  model text,
  verdict text,
  issues jsonb,
  created_at timestamptz not null default now()
);
create table public.llm_usage (
  day date,
  provider text,
  count int not null default 0 check (count between 0 and 800),
  primary key (day, provider)
);
create table public.social_queue (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id) on delete cascade,
  channel text not null check (channel in ('telegram','bluesky')),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','uncertain')),
  attempts int not null default 0 check (attempts between 0 and 3),
  attempted_at timestamptz,
  sent_at timestamptz,
  unique (article_id, channel)
);
create table public.admin_users (email text primary key check (email = lower(email)));
create table public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  step text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  success boolean,
  summary jsonb not null default '{}'
);

create index articles_status_date on public.articles(status, published_at desc);
create index articles_category_date on public.articles(category, published_at desc);
create index articles_verdict_status on public.articles(verdict, status);
create index articles_source_date on public.articles(source_published_at);
create index articles_source_id on public.articles(source_id);
create index verification_log_article on public.verification_log(article_id, created_at desc);
create index social_queue_pending on public.social_queue(status, attempted_at);
create index pipeline_runs_started on public.pipeline_runs(started_at desc);

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from auth.users u join public.admin_users a on a.email = lower(u.email)
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  );
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated, service_role;
create function public.is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$ select private.is_admin(); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.verification_log enable row level security;
alter table public.llm_usage enable row level security;
alter table public.social_queue enable row level security;
alter table public.admin_users enable row level security;
alter table public.pipeline_runs enable row level security;
revoke all on public.sources, public.articles, public.verification_log, public.llm_usage, public.social_queue, public.admin_users, public.pipeline_runs from anon, authenticated;
grant select (id,name,active) on public.sources to anon;
grant select (id,slug,title,summary,body,category,source_id,source_name,source_url,image_url,corroborating_sources,featured,published_at,updated_at,status) on public.articles to anon;
grant select on public.articles, public.sources, public.verification_log, public.llm_usage, public.social_queue, public.pipeline_runs to authenticated;
grant update (title,summary,body,category,featured,status,review_reason,review_override) on public.articles to authenticated;
grant insert,update,delete on public.sources to authenticated;
grant update on public.verification_log, public.social_queue to authenticated;
grant all on public.sources, public.articles, public.verification_log, public.llm_usage, public.social_queue, public.admin_users, public.pipeline_runs to service_role;

create policy sources_public on public.sources for select to anon using (active);
create policy articles_public on public.articles for select to anon using (status = 'published');
create policy sources_admin on public.sources for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy articles_admin_read on public.articles for select to authenticated using ((select private.is_admin()));
create policy articles_admin_update on public.articles for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy logs_admin_read on public.verification_log for select to authenticated using ((select private.is_admin()));
create policy logs_admin_update on public.verification_log for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy usage_admin on public.llm_usage for select to authenticated using ((select private.is_admin()));
create policy queue_admin_read on public.social_queue for select to authenticated using ((select private.is_admin()));
create policy queue_admin_update on public.social_queue for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy runs_admin on public.pipeline_runs for select to authenticated using ((select private.is_admin()));

create function public.reserve_llm_request(p_day date, p_provider text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.llm_usage(day,provider,count) values (p_day,p_provider,1)
  on conflict (day,provider) do update set count = public.llm_usage.count + 1
  where public.llm_usage.count < 800 returning count into n;
  return n is not null;
end;
$$;
revoke all on function public.reserve_llm_request(date,text) from public, anon, authenticated;
grant execute on function public.reserve_llm_request(date,text) to service_role;

create function private.source_count(a public.articles) returns int
language sql stable security definer set search_path = '' as $$
  select count(distinct publisher_key)::int from (
    select s.publisher_key from public.sources s where s.id = a.source_id
    union all
    select s.publisher_key from jsonb_array_elements(a.corroborating_sources) c
      join public.sources s on s.id::text = c->>'source_id'
  ) x;
$$;
revoke all on function private.source_count(public.articles) from public;

create function private.article_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare human boolean := (select auth.uid()) is not null; evidence jsonb;
begin
  new.updated_at := now();
  if concat_ws(' ',new.source_title,new.source_excerpt,new.title,new.summary,new.body) ~* '(^|[^[:alpha:]])(ölüm[[:alpha:]]*|öldür[[:alpha:]]*|hayatını kaybet[[:alpha:]]*|saldırı[[:alpha:]]*|savaş[[:alpha:]]*|kaza(sı|sında|da|lar|nın|ya)?|yaralı[[:alpha:]]*|tıbbi|tedavi[[:alpha:]]*|ilaç[[:alpha:]]*|hastalık[[:alpha:]]*|aşı(sı|nın|ya|lar|ları|lama[[:alpha:]]*)?|seçim[[:alpha:]]*|suç[[:alpha:]]*|şüpheli[[:alpha:]]*|cinayet[[:alpha:]]*|death[[:alpha:]]*|killed|attack[[:alpha:]]*|election[[:alpha:]]*|murder[[:alpha:]]*|medical|vaccine[[:alpha:]]*|[0-9]+[[:space:]]*(milyon|milyar|lira|dolar|euro|yüzde|million|billion|dollar|percent))([^[:alpha:]]|$)' then
    new.sensitivity := 'hassas';
  end if;
  if tg_op = 'UPDATE' and (new.title,new.summary,new.body,new.category) is distinct from (old.title,old.summary,old.body,old.category) then
    if human then
      new.verdict := 'needs_review'; new.status := 'draft'; new.reviewed_at := null; new.reviewed_by := null;
      new.review_override := false; new.review_reason := null;
      new.verification := coalesce(new.verification,'{}'::jsonb) || '{"edited":true,"retry":false}'::jsonb;
      insert into public.verification_log(article_id,role,verdict,issues) values (new.id,'editor','edited','[]');
    end if;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if length(new.title) > 90 or length(trim(coalesce(new.body,''))) = 0 then raise exception 'Haber alanları eksik veya başlık çok uzun'; end if;
    if new.sensitivity = 'hassas' and private.source_count(new) < 2 then raise exception 'Hassas haber için iki bağımsız kaynak gerekir'; end if;
    if human then
      if not private.is_admin() then raise exception 'Yetkisiz yayın işlemi'; end if;
      if new.verdict <> 'auto_pass' and (not new.review_override or length(trim(coalesce(new.review_reason,''))) < 10) then raise exception 'İnceleme için gerekçe ve onay gerekir'; end if;
      new.reviewed_at := now(); new.reviewed_by := auth.uid();
      insert into public.verification_log(article_id,role,verdict,issues) values (new.id,'editor','published',jsonb_build_array(jsonb_build_object('text',new.review_reason,'reviewer',new.reviewed_by)));
    else
      evidence := coalesce(new.verification,'{}');
      if (select count(distinct v) from (values (new.writer_provider),(evidence->'reviewer1'->>'provider'),(evidence->'reviewer2'->>'provider')) p(v)) <> 3
        or (select count(distinct v) from (values (new.writer_family),(evidence->'reviewer1'->>'family'),(evidence->'reviewer2'->>'family')) p(v)) <> 3 then
        raise exception 'Yazar ve denetçiler bağımsız olmalıdır';
      end if;
      if new.sensitivity <> 'normal' or new.verdict <> 'auto_pass'
        or coalesce((evidence->>'eligible')::boolean,false) is not true
        or coalesce(evidence->'reviewer1'->>'verdict','') <> 'pass'
        or coalesce(evidence->'reviewer2'->>'verdict','') <> 'pass'
        or coalesce((evidence->'reviewer1'->>'score')::int,0) < 80
        or coalesce((evidence->'reviewer2'->>'score')::int,0) < 80
        or coalesce((evidence->>'independent')::boolean,false) is not true
        or coalesce(jsonb_array_length(evidence->'rules'),1) <> 0
        or not (private.source_count(new) >= 2 or exists(select 1 from public.sources where id = new.source_id and trust_level = 3)) then
          raise exception 'Haber yayın koşullarını karşılamıyor';
      end if;
    end if;
    new.published_at := coalesce(new.published_at,now());
  end if;
  return new;
end;
$$;
revoke all on function private.article_guard() from public;
create trigger articles_guard before insert or update on public.articles for each row execute function private.article_guard();

create function private.enqueue_article() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    insert into public.social_queue(article_id,channel) values (new.id,'telegram'),(new.id,'bluesky') on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.enqueue_article() from public;
create trigger articles_enqueue after insert or update on public.articles for each row execute function private.enqueue_article();

create function public.claim_social(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform pg_advisory_xact_lock(829137);
  if (select coalesce(sum(attempts),0) from public.social_queue where attempted_at >= now() - interval '1 hour') >= 6 then return false; end if;
  update public.social_queue set status='sending',attempts=attempts+1,attempted_at=now()
  where id=p_id and status='pending' and attempts < 3;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;
revoke all on function public.claim_social(uuid) from public,anon,authenticated;
grant execute on function public.claim_social(uuid) to service_role;
commit;
