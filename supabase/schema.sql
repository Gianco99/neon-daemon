create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 32),
  look jsonb not null default '{}'::jsonb check (jsonb_typeof(look) = 'object' and pg_column_size(look) <= 4096),
  status_text text not null default '' check (char_length(status_text) <= 80),
  chips integer not null default 500 check (chips >= 0),
  chips_topped_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.lobbies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name text not null check (char_length(name) between 1 and 40),
  is_private boolean not null default false,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  max_members integer not null default 50,
  created_at timestamptz not null default now()
);

create table public.lobby_secrets (
  lobby_id uuid primary key references public.lobbies (id) on delete cascade,
  key_hash text not null
);

create table public.lobby_members (
  lobby_id uuid not null references public.lobbies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (lobby_id, user_id)
);
create index lobby_members_user_idx on public.lobby_members (user_id);

create table public.user_status (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_lobby uuid references public.lobbies (id) on delete set null,
  last_seen timestamptz not null default now()
);
create index user_status_lobby_idx on public.user_status (current_lobby);

create table public.lobby_messages (
  id bigint generated always as identity primary key,
  lobby_id uuid not null references public.lobbies (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  encrypted boolean not null default false,
  created_at timestamptz not null default now()
);
create index lobby_messages_lobby_idx on public.lobby_messages (lobby_id, id desc);

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_user_b_idx on public.friendships (user_b);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'Claude Code' check (char_length(name) <= 40),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen timestamptz
);
create index devices_user_idx on public.devices (user_id);

create table public.pairing_codes (
  code text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null
);

create table public.agent_sessions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_key text not null check (char_length(session_key) between 8 and 64),
  device_id uuid references public.devices (id) on delete cascade,
  state text not null check (state in ('idle', 'working', 'waiting', 'offline')),
  label text check (char_length(label) <= 32),
  tool text check (char_length(tool) <= 24),
  turn_no integer not null default 0,
  turn_started_at timestamptz,
  asked_permission boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, session_key)
);
create index agent_sessions_updated_idx on public.agent_sessions (updated_at);

create table public.bets (
  id bigint generated always as identity primary key,
  bettor_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  session_key text not null,
  turn_no integer not null,
  pick text not null check (pick in ('flash', 'grind', 'marathon', 'permission', 'clean')),
  amount integer not null check (amount between 1 and 1000),
  payout integer,
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'refunded')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create unique index bets_one_per_turn on public.bets (bettor_id, owner_id, session_key, turn_no);
create index bets_owner_idx on public.bets (owner_id, session_key, turn_no);

create table public.scores (
  id bigint generated always as identity primary key,
  game text not null check (game in ('darts')),
  lobby_id uuid references public.lobbies (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  score integer not null check (score between 0 and 1000),
  created_at timestamptz not null default now()
);
create index scores_lobby_idx on public.scores (lobby_id, game, score desc);

create table public.login_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  secret_hash text not null,
  client text not null default '',
  client_ip text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved')),
  token_hash text,
  approved_user uuid references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now()
);

create or replace function public.normalize_code(p_code text)
returns text language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function public.random_code(p_len integer)
returns text language plpgsql volatile set search_path = '' as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(p_len);
  v_out text := '';
  i integer;
begin
  for i in 0 .. p_len - 1 loop
    v_out := v_out || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
  end loop;
  return v_out;
end $$;

create or replace function public.sha256_hex(p_text text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(coalesce(p_text, ''), 'sha256'), 'hex')
$$;

create or replace function public.is_member(p_lobby uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_lobby is not null and p_user is not null and exists (
    select 1 from public.lobby_members m where m.lobby_id = p_lobby and m.user_id = p_user
  )
$$;

create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_a is not null and p_b is not null and exists (
    select 1 from public.friendships f
    where f.user_a = least(p_a, p_b) and f.user_b = greatest(p_a, p_b) and f.status = 'accepted'
  )
$$;

create or replace function public.shares_lobby(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_a is not null and p_b is not null and exists (
    select 1 from public.lobby_members m1
    join public.lobby_members m2 on m2.lobby_id = m1.lobby_id
    where m1.user_id = p_a and m2.user_id = p_b
  )
$$;

create or replace function public.can_see_agents(p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_owner = auth.uid() or public.are_friends(auth.uid(), p_owner) or public.shares_lobby(auth.uid(), p_owner)
$$;

create or replace function public.lobby_from_topic(p_topic text)
returns uuid language sql immutable set search_path = '' as $$
  select case
    when p_topic ~ '^lobby:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then substr(p_topic, 7)::uuid
  end
$$;

create or replace function public.require_user()
returns uuid language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '28000';
  end if;
  return auth.uid();
end $$;

create or replace function public.device_for_token(p_token text)
returns public.devices language plpgsql security definer set search_path = '' as $$
declare
  v_dev public.devices;
begin
  select * into v_dev from public.devices where token_hash = public.sha256_hex(p_token);
  if not found then
    raise exception 'unknown device token, run /neon link again' using errcode = '28000';
  end if;
  update public.devices set last_seen = now() where id = v_dev.id;
  return v_dev;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_handle text := left(lower(regexp_replace(coalesce(
    new.raw_user_meta_data ->> 'handle',
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username',
    ''), '[^A-Za-z0-9_]', '_', 'g')), 20);
  v_name text := left(coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    ''), 32);
begin
  if v_handle !~ '^[a-z0-9_]{3,20}$' or exists (select 1 from public.profiles where handle = v_handle) then
    v_handle := 'daemon_' || substr(md5(new.id::text), 1, 8);
  end if;
  insert into public.profiles (id, handle, display_name) values (new.id, v_handle, coalesce(nullif(v_name, ''), v_handle));
  insert into public.user_status (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_available(p_handle text)
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(coalesce(p_handle, '')) ~ '^[a-z0-9_]{3,20}$'
    and not exists (select 1 from public.profiles where handle = lower(p_handle))
$$;

create or replace function public.lobby_json(p_lobby uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', l.id,
    'code', l.code,
    'name', l.name,
    'is_private', l.is_private,
    'owner_id', l.owner_id,
    'owner_handle', p.handle,
    'role', m.role,
    'members', (select count(*) from public.lobby_members x where x.lobby_id = l.id),
    'here', (select count(*) from public.user_status s where s.current_lobby = l.id and s.last_seen > now() - interval '2 minutes'),
    'created_at', l.created_at)
  from public.lobbies l
  join public.profiles p on p.id = l.owner_id
  left join public.lobby_members m on m.lobby_id = l.id and m.user_id = auth.uid()
  where l.id = p_lobby
$$;

create or replace function public.create_lobby(p_name text, p_private boolean, p_proof text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_code text;
  v_id uuid;
  v_private boolean := coalesce(p_private, false);
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 40 then
    raise exception 'bar names are 1 to 40 characters';
  end if;
  if (select count(*) from public.lobbies where owner_id = v_uid) >= 20 then
    raise exception 'you already run 20 bars, close one first';
  end if;
  if v_private and coalesce(p_proof, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'private bars need a key';
  end if;
  loop
    v_code := public.random_code(6);
    exit when not exists (select 1 from public.lobbies where code = v_code);
  end loop;
  insert into public.lobbies (code, name, is_private, owner_id)
    values (v_code, btrim(p_name), v_private, v_uid)
    returning id into v_id;
  if v_private then
    insert into public.lobby_secrets (lobby_id, key_hash) values (v_id, extensions.crypt(p_proof, extensions.gen_salt('bf', 8)));
  end if;
  insert into public.lobby_members (lobby_id, user_id, role) values (v_id, v_uid, 'owner');
  return public.lobby_json(v_id);
end $$;

create or replace function public.join_lobby(p_code text, p_proof text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_lobby public.lobbies;
  v_hash text;
begin
  select * into v_lobby from public.lobbies where code = public.normalize_code(p_code);
  if not found then
    raise exception 'no bar with that code';
  end if;
  if not public.is_member(v_lobby.id, v_uid) then
    if v_lobby.is_private then
      select key_hash into v_hash from public.lobby_secrets where lobby_id = v_lobby.id;
      if p_proof is null or v_hash is null or extensions.crypt(p_proof, v_hash) <> v_hash then
        raise exception 'wrong key for that bar' using errcode = '28P01';
      end if;
    end if;
    if (select count(*) from public.lobby_members where lobby_id = v_lobby.id) >= v_lobby.max_members then
      raise exception 'that bar is full';
    end if;
    insert into public.lobby_members (lobby_id, user_id) values (v_lobby.id, v_uid);
  end if;
  return public.lobby_json(v_lobby.id);
end $$;

create or replace function public.leave_lobby(p_lobby uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_next uuid;
begin
  delete from public.lobby_members where lobby_id = p_lobby and user_id = v_uid;
  update public.user_status set current_lobby = null where user_id = v_uid and current_lobby = p_lobby;
  if exists (select 1 from public.lobbies where id = p_lobby and owner_id = v_uid) then
    select user_id into v_next from public.lobby_members where lobby_id = p_lobby order by joined_at limit 1;
    if v_next is null then
      delete from public.lobbies where id = p_lobby;
    else
      update public.lobbies set owner_id = v_next where id = p_lobby;
      update public.lobby_members set role = 'owner' where lobby_id = p_lobby and user_id = v_next;
    end if;
  end if;
end $$;

create or replace function public.delete_lobby(p_lobby uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
begin
  delete from public.lobbies where id = p_lobby and owner_id = v_uid;
  if not found then
    raise exception 'only the owner can close this bar';
  end if;
end $$;

create or replace function public.kick_member(p_lobby uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
begin
  if not exists (select 1 from public.lobbies where id = p_lobby and owner_id = v_uid) then
    raise exception 'only the owner can kick';
  end if;
  if p_user = v_uid then
    raise exception 'you cannot kick yourself';
  end if;
  delete from public.lobby_members where lobby_id = p_lobby and user_id = p_user;
  update public.user_status set current_lobby = null where user_id = p_user and current_lobby = p_lobby;
end $$;

create or replace function public.list_public_lobbies()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.here desc, x.members desc, x.created_at desc), '[]'::jsonb)
  from (
    select public.lobby_json(l.id) as j,
      (select count(*) from public.user_status s where s.current_lobby = l.id and s.last_seen > now() - interval '2 minutes') as here,
      (select count(*) from public.lobby_members m where m.lobby_id = l.id) as members,
      l.created_at
    from public.lobbies l
    where not l.is_private
    order by here desc, members desc, l.created_at desc
    limit 60
  ) x
$$;

create or replace function public.my_lobbies()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.lobby_json(m.lobby_id) order by m.joined_at desc), '[]'::jsonb)
  from public.lobby_members m
  where m.user_id = auth.uid()
$$;

create or replace function public.touch(p_lobby uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
begin
  insert into public.user_status (user_id, current_lobby, last_seen)
    values (v_uid, case when public.is_member(p_lobby, v_uid) then p_lobby end, now())
    on conflict (user_id) do update set current_lobby = excluded.current_lobby, last_seen = excluded.last_seen;
end $$;

create or replace function public.send_friend_request(p_handle text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_other uuid;
  v_row public.friendships;
begin
  select id into v_other from public.profiles where handle = lower(btrim(coalesce(p_handle, '')));
  if v_other is null then
    raise exception 'no daemon goes by that handle';
  end if;
  if v_other = v_uid then
    raise exception 'that''s you';
  end if;
  select * into v_row from public.friendships where user_a = least(v_uid, v_other) and user_b = greatest(v_uid, v_other);
  if found then
    if v_row.status = 'accepted' then
      return 'already';
    end if;
    if v_row.requested_by <> v_uid then
      update public.friendships set status = 'accepted' where user_a = v_row.user_a and user_b = v_row.user_b;
      return 'accepted';
    end if;
    return 'pending';
  end if;
  if (select count(*) from public.friendships where requested_by = v_uid and status = 'pending') >= 50 then
    raise exception 'too many pending requests';
  end if;
  insert into public.friendships (user_a, user_b, requested_by) values (least(v_uid, v_other), greatest(v_uid, v_other), v_uid);
  return 'requested';
end $$;

create or replace function public.respond_friend_request(p_user uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
begin
  if p_accept then
    update public.friendships set status = 'accepted'
      where user_a = least(v_uid, p_user) and user_b = greatest(v_uid, p_user) and requested_by = p_user and status = 'pending';
    if not found then
      raise exception 'no pending request from them';
    end if;
  else
    delete from public.friendships
      where user_a = least(v_uid, p_user) and user_b = greatest(v_uid, p_user) and status = 'pending';
  end if;
end $$;

create or replace function public.remove_friend(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
begin
  delete from public.friendships where user_a = least(v_uid, p_user) and user_b = greatest(v_uid, p_user);
end $$;

create or replace function public.agents_json(p_owner uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'session_key', a.session_key,
      'state', a.state,
      'label', a.label,
      'tool', a.tool,
      'turn_no', a.turn_no,
      'turn_started_at', a.turn_started_at,
      'asked_permission', a.asked_permission,
      'updated_at', a.updated_at) order by a.updated_at desc), '[]'::jsonb)
  from public.agent_sessions a
  where a.user_id = p_owner and a.state <> 'offline' and a.updated_at > now() - interval '30 minutes'
$$;

create or replace function public.friends_overview()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.pending desc, x.online desc, x.handle), '[]'::jsonb)
  from (
    select
      p.handle,
      f.status = 'pending' as pending,
      coalesce(f.status = 'accepted' and s.last_seen > now() - interval '2 minutes', false) as online,
      jsonb_build_object(
        'id', p.id,
        'handle', p.handle,
        'display_name', p.display_name,
        'look', p.look,
        'status_text', p.status_text,
        'relation', case when f.status = 'accepted' then 'friend' when f.requested_by = auth.uid() then 'outgoing' else 'incoming' end,
        'online', coalesce(f.status = 'accepted' and s.last_seen > now() - interval '2 minutes', false),
        'last_seen', case when f.status = 'accepted' then s.last_seen end,
        'lobby', case
          when f.status = 'accepted' and s.last_seen > now() - interval '2 minutes' and l.id is not null
            and (not l.is_private or public.is_member(l.id, auth.uid()))
          then jsonb_build_object('id', l.id, 'code', l.code, 'name', l.name, 'is_private', l.is_private)
        end,
        'agents', case when f.status = 'accepted' then public.agents_json(p.id) else '[]'::jsonb end
      ) as j
    from public.friendships f
    join public.profiles p on p.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
    left join public.user_status s on s.user_id = p.id
    left join public.lobbies l on l.id = s.current_lobby
    where auth.uid() in (f.user_a, f.user_b)
  ) x
$$;

create or replace function public.create_pairing_code()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_code text;
  v_expires timestamptz := now() + interval '10 minutes';
begin
  delete from public.pairing_codes where user_id = v_uid or expires_at < now();
  if (select count(*) from public.devices where user_id = v_uid) >= 10 then
    raise exception 'ten devices linked already, revoke one first';
  end if;
  loop
    v_code := public.random_code(8);
    exit when not exists (select 1 from public.pairing_codes where code = v_code);
  end loop;
  insert into public.pairing_codes (code, user_id, expires_at) values (v_code, v_uid, v_expires);
  return jsonb_build_object('code', v_code, 'expires_at', v_expires);
end $$;

create or replace function public.claim_pairing_code(p_code text, p_device_name text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row public.pairing_codes;
  v_token text;
  v_device uuid;
begin
  delete from public.pairing_codes where expires_at < now();
  select * into v_row from public.pairing_codes where code = public.normalize_code(p_code);
  if not found then
    raise exception 'pairing code not found or expired' using errcode = '28000';
  end if;
  delete from public.pairing_codes where code = v_row.code;
  v_token := 'nd_' || encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.devices (user_id, name, token_hash)
    values (v_row.user_id, left(coalesce(nullif(btrim(p_device_name), ''), 'Claude Code'), 40), public.sha256_hex(v_token))
    returning id into v_device;
  return jsonb_build_object(
    'token', v_token,
    'device_id', v_device,
    'handle', (select handle from public.profiles where id = v_row.user_id));
end $$;

create or replace function public.settle_bets(p_owner uuid, p_session text, p_turn integer, p_bucket text, p_asked boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_bet public.bets;
  v_out jsonb := '[]'::jsonb;
  v_status text;
  v_payout integer;
begin
  for v_bet in
    select * from public.bets
    where owner_id = p_owner and session_key = p_session and turn_no = p_turn and status = 'open'
    for update
  loop
    if p_bucket is null then
      v_status := 'refunded';
      v_payout := v_bet.amount;
    elsif v_bet.pick in ('flash', 'grind', 'marathon') then
      v_status := case when v_bet.pick = p_bucket then 'won' else 'lost' end;
      v_payout := case when v_bet.pick = p_bucket then v_bet.amount * 3 else 0 end;
    else
      v_status := case when (v_bet.pick = 'permission') = coalesce(p_asked, false) then 'won' else 'lost' end;
      v_payout := case when v_status = 'won' then v_bet.amount * 2 else 0 end;
    end if;
    update public.bets set status = v_status, payout = v_payout, settled_at = now() where id = v_bet.id;
    if v_payout > 0 then
      update public.profiles set chips = chips + v_payout where id = v_bet.bettor_id;
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'bettor', (select handle from public.profiles where id = v_bet.bettor_id),
      'pick', v_bet.pick,
      'amount', v_bet.amount,
      'payout', v_payout,
      'status', v_status));
  end loop;
  return v_out;
end $$;

create or replace function public.agent_ping(p_token text, p_session text, p_state text, p_label text default null, p_tool text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_dev public.devices := public.device_for_token(p_token);
  v_prev public.agent_sessions;
  v_turn integer;
  v_started timestamptz;
  v_asked boolean;
  v_settled jsonb := '[]'::jsonb;
  v_duration double precision;
begin
  if p_state is null or p_state not in ('idle', 'working', 'waiting', 'offline') then
    raise exception 'state must be idle, working, waiting or offline';
  end if;
  if char_length(coalesce(p_session, '')) not between 8 and 64 then
    raise exception 'session key must be 8 to 64 characters';
  end if;
  select * into v_prev from public.agent_sessions where user_id = v_dev.user_id and session_key = p_session for update;
  v_turn := coalesce(v_prev.turn_no, 0);
  v_started := v_prev.turn_started_at;
  v_asked := coalesce(v_prev.asked_permission, false);
  if p_state in ('working', 'waiting') and (v_prev.state is null or v_prev.state in ('idle', 'offline')) then
    v_turn := v_turn + 1;
    v_started := now();
    v_asked := false;
  end if;
  if p_state = 'waiting' then
    v_asked := true;
  end if;
  if p_state in ('idle', 'offline') and v_prev.state in ('working', 'waiting') then
    v_duration := extract(epoch from now() - v_prev.turn_started_at);
    v_settled := public.settle_bets(
      v_dev.user_id, p_session, v_prev.turn_no,
      case
        when p_state = 'offline' then null
        when v_duration < 60 then 'flash'
        when v_duration < 300 then 'grind'
        else 'marathon'
      end,
      v_prev.asked_permission);
  end if;
  insert into public.agent_sessions (user_id, session_key, device_id, state, label, tool, turn_no, turn_started_at, asked_permission, updated_at)
    values (v_dev.user_id, p_session, v_dev.id, p_state, left(nullif(btrim(p_label), ''), 32), left(nullif(btrim(p_tool), ''), 24), v_turn, v_started, v_asked, now())
    on conflict (user_id, session_key) do update set
      device_id = excluded.device_id,
      state = excluded.state,
      label = excluded.label,
      tool = excluded.tool,
      turn_no = excluded.turn_no,
      turn_started_at = excluded.turn_started_at,
      asked_permission = excluded.asked_permission,
      updated_at = excluded.updated_at;
  return jsonb_build_object(
    'ok', true,
    'handle', (select handle from public.profiles where id = v_dev.user_id),
    'turn', v_turn,
    'open_bets', (select count(*) from public.bets b where b.owner_id = v_dev.user_id and b.session_key = p_session and b.turn_no = v_turn and b.status = 'open'),
    'duration_s', v_duration,
    'settled', v_settled);
end $$;

create or replace function public.device_overview(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_dev public.devices := public.device_for_token(p_token);
begin
  return (
    select jsonb_build_object(
      'handle', p.handle,
      'chips', p.chips,
      'friends_online', (
        select count(*) from public.friendships f
        join public.user_status s on s.user_id = case when f.user_a = p.id then f.user_b else f.user_a end
        where p.id in (f.user_a, f.user_b) and f.status = 'accepted' and s.last_seen > now() - interval '2 minutes'),
      'friends_working', (
        select count(distinct a.user_id) from public.friendships f
        join public.agent_sessions a on a.user_id = case when f.user_a = p.id then f.user_b else f.user_a end
        where p.id in (f.user_a, f.user_b) and f.status = 'accepted'
          and a.state in ('working', 'waiting') and a.updated_at > now() - interval '30 minutes'))
    from public.profiles p
    where p.id = v_dev.user_id);
end $$;

create or replace function public.place_bet(p_owner uuid, p_session text, p_pick text, p_amount integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_agent public.agent_sessions;
  v_chips integer;
begin
  if p_owner = v_uid then
    raise exception 'no betting on your own agent';
  end if;
  if not (public.are_friends(v_uid, p_owner) or public.shares_lobby(v_uid, p_owner)) then
    raise exception 'you can only bet on agents of friends and bar mates';
  end if;
  if p_pick is null or p_pick not in ('flash', 'grind', 'marathon', 'permission', 'clean') then
    raise exception 'unknown pick';
  end if;
  if p_amount is null or p_amount not between 1 and 1000 then
    raise exception 'bets are 1 to 1000 chips';
  end if;
  select * into v_agent from public.agent_sessions where user_id = p_owner and session_key = p_session;
  if not found or v_agent.state not in ('working', 'waiting') then
    raise exception 'that agent is not on a job right now';
  end if;
  if v_agent.turn_started_at < now() - interval '60 seconds' then
    raise exception 'betting closed for this job';
  end if;
  if p_pick in ('permission', 'clean') and v_agent.asked_permission then
    raise exception 'it already asked for permission, no bets on that';
  end if;
  if exists (
    select 1 from public.bets
    where bettor_id = v_uid and owner_id = p_owner and session_key = p_session and turn_no = v_agent.turn_no
  ) then
    raise exception 'one bet per job';
  end if;
  update public.profiles set chips = chips - p_amount where id = v_uid and chips >= p_amount returning chips into v_chips;
  if v_chips is null then
    raise exception 'not enough chips';
  end if;
  insert into public.bets (bettor_id, owner_id, session_key, turn_no, pick, amount)
    values (v_uid, p_owner, p_session, v_agent.turn_no, p_pick, p_amount);
  return jsonb_build_object('ok', true, 'chips', v_chips);
end $$;

create or replace function public.my_bets()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_bet public.bets;
begin
  for v_bet in
    select * from public.bets
    where bettor_id = v_uid and status = 'open' and created_at < now() - interval '3 hours'
    for update
  loop
    update public.bets set status = 'refunded', payout = v_bet.amount, settled_at = now() where id = v_bet.id;
    update public.profiles set chips = chips + v_bet.amount where id = v_uid;
  end loop;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id,
        'owner_id', b.owner_id,
        'owner_handle', p.handle,
        'session_key', b.session_key,
        'turn_no', b.turn_no,
        'pick', b.pick,
        'amount', b.amount,
        'payout', b.payout,
        'status', b.status,
        'created_at', b.created_at) order by b.created_at desc), '[]'::jsonb)
    from (
      select * from public.bets where bettor_id = v_uid order by created_at desc limit 20
    ) b
    join public.profiles p on p.id = b.owner_id);
end $$;

create or replace function public.top_up()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_chips integer;
begin
  update public.profiles
    set chips = chips + 250, chips_topped_at = now()
    where id = v_uid and chips < 100 and (chips_topped_at is null or chips_topped_at < now() - interval '12 hours')
    returning chips into v_chips;
  if v_chips is null then
    raise exception 'the bartender says come back later';
  end if;
  return v_chips;
end $$;

create or replace function public.top_scores(p_game text, p_lobby uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('handle', t.handle, 'score', t.best) order by t.best desc), '[]'::jsonb)
  from (
    select p.handle, max(s.score) as best
    from public.scores s
    join public.profiles p on p.id = s.user_id
    where s.game = p_game and s.lobby_id is not distinct from p_lobby
    group by p.handle
    order by best desc
    limit 10
  ) t
$$;

create or replace function public.start_claude_login(p_secret_hash text, p_client text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
  v_id uuid;
  v_expires timestamptz := now() + interval '10 minutes';
  v_ip text := btrim(split_part(coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for',
    nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
    ''), ',', 1));
begin
  if coalesce(p_secret_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'bad request';
  end if;
  delete from public.login_requests where expires_at < now();
  if v_ip <> '' and (select count(*) from public.login_requests where client_ip = v_ip) >= 5 then
    raise exception 'too many sign-ins from here, try again in a few minutes';
  end if;
  if (select count(*) from public.login_requests) >= 2000 then
    raise exception 'too many sign-ins in flight, try again in a minute';
  end if;
  loop
    v_code := public.random_code(8);
    exit when not exists (select 1 from public.login_requests where code = v_code);
  end loop;
  insert into public.login_requests (code, secret_hash, client, client_ip, expires_at)
    values (v_code, p_secret_hash, left(coalesce(p_client, ''), 80), left(v_ip, 64), v_expires)
    returning id into v_id;
  return jsonb_build_object('id', v_id, 'code', v_code, 'expires_at', v_expires);
end $$;

create or replace function public.poll_claude_login(p_id uuid, p_secret text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row public.login_requests;
begin
  select * into v_row from public.login_requests where id = p_id and secret_hash = public.sha256_hex(p_secret);
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;
  if v_row.expires_at < now() then
    delete from public.login_requests where id = p_id;
    return jsonb_build_object('status', 'expired');
  end if;
  if v_row.status = 'approved' then
    delete from public.login_requests where id = p_id;
    return jsonb_build_object('status', 'approved', 'token_hash', v_row.token_hash);
  end if;
  return jsonb_build_object('status', 'pending');
end $$;

create or replace function public.peek_login_request(p_token text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_dev public.devices := public.device_for_token(p_token);
  v_req public.login_requests;
begin
  select * into v_req from public.login_requests
    where code = public.normalize_code(p_code) and status = 'pending' and expires_at > now();
  if not found then
    raise exception 'sign-in code not found or expired';
  end if;
  return jsonb_build_object(
    'client', v_req.client,
    'created_at', v_req.created_at,
    'expires_at', v_req.expires_at,
    'handle', (select handle from public.profiles where id = v_dev.user_id));
end $$;

create or replace function public.resolve_login_request(p_token text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_dev public.devices := public.device_for_token(p_token);
  v_req public.login_requests;
begin
  select * into v_req from public.login_requests
    where code = public.normalize_code(p_code) and status = 'pending' and expires_at > now()
    for update;
  if not found then
    raise exception 'sign-in code not found or expired';
  end if;
  update public.login_requests set approved_user = v_dev.user_id where id = v_req.id;
  return jsonb_build_object(
    'request_id', v_req.id,
    'user_id', v_dev.user_id,
    'handle', (select handle from public.profiles where id = v_dev.user_id));
end $$;

create or replace function public.complete_login_request(p_id uuid, p_token_hash text)
returns void language sql security definer set search_path = '' as $$
  update public.login_requests set status = 'approved', token_hash = p_token_hash
  where id = p_id and status = 'pending' and approved_user is not null
$$;

alter table public.profiles enable row level security;
alter table public.lobbies enable row level security;
alter table public.lobby_secrets enable row level security;
alter table public.lobby_members enable row level security;
alter table public.user_status enable row level security;
alter table public.lobby_messages enable row level security;
alter table public.friendships enable row level security;
alter table public.devices enable row level security;
alter table public.pairing_codes enable row level security;
alter table public.agent_sessions enable row level security;
alter table public.bets enable row level security;
alter table public.scores enable row level security;
alter table public.login_requests enable row level security;

create policy "signed-in users see profiles" on public.profiles
  for select to authenticated using (true);
create policy "you edit your own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "public bars and your bars are visible" on public.lobbies
  for select to authenticated using (not is_private or public.is_member(id, (select auth.uid())));

create policy "members see each other" on public.lobby_members
  for select to authenticated using (public.is_member(lobby_id, (select auth.uid())));

create policy "you and your friends see your status" on public.user_status
  for select to authenticated using (user_id = (select auth.uid()) or public.are_friends((select auth.uid()), user_id));

create policy "members read bar chat" on public.lobby_messages
  for select to authenticated using (public.is_member(lobby_id, (select auth.uid())));
create policy "members post to bar chat" on public.lobby_messages
  for insert to authenticated with check (sender_id = (select auth.uid()) and public.is_member(lobby_id, (select auth.uid())));

create policy "you see your friendships" on public.friendships
  for select to authenticated using ((select auth.uid()) in (user_a, user_b));

create policy "you see your devices" on public.devices
  for select to authenticated using (user_id = (select auth.uid()));
create policy "you revoke your devices" on public.devices
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "friends and bar mates see agents" on public.agent_sessions
  for select to authenticated using (public.can_see_agents(user_id));

create policy "friends and bar mates see bets" on public.bets
  for select to authenticated using (bettor_id = (select auth.uid()) or public.can_see_agents(owner_id));

create policy "members see bar scores" on public.scores
  for select to authenticated using (lobby_id is null or public.is_member(lobby_id, (select auth.uid())));
create policy "you post your own scores" on public.scores
  for insert to authenticated with check (user_id = (select auth.uid()) and (lobby_id is null or public.is_member(lobby_id, (select auth.uid()))));

revoke all on public.lobby_secrets, public.pairing_codes, public.login_requests from anon, authenticated;
revoke insert, update, delete on public.profiles, public.lobbies, public.lobby_members, public.user_status,
  public.friendships, public.agent_sessions, public.bets from anon, authenticated;
revoke update, delete on public.lobby_messages, public.scores from anon, authenticated;
revoke insert, update on public.devices from anon, authenticated;
grant update (handle, display_name, look, status_text) on public.profiles to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_member(uuid, uuid),
  public.are_friends(uuid, uuid),
  public.shares_lobby(uuid, uuid),
  public.can_see_agents(uuid),
  public.lobby_from_topic(text),
  public.handle_available(text),
  public.claim_pairing_code(text, text),
  public.agent_ping(text, text, text, text, text),
  public.device_overview(text),
  public.start_claude_login(text, text),
  public.poll_claude_login(uuid, text),
  public.peek_login_request(text, text)
to anon, authenticated;

grant execute on function
  public.create_lobby(text, boolean, text),
  public.join_lobby(text, text),
  public.leave_lobby(uuid),
  public.delete_lobby(uuid),
  public.kick_member(uuid, uuid),
  public.list_public_lobbies(),
  public.my_lobbies(),
  public.touch(uuid),
  public.send_friend_request(text),
  public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid),
  public.friends_overview(),
  public.create_pairing_code(),
  public.place_bet(uuid, text, text, integer),
  public.my_bets(),
  public.top_up(),
  public.top_scores(text, uuid)
to authenticated;

grant execute on function
  public.resolve_login_request(text, text),
  public.complete_login_request(uuid, text)
to service_role;

alter publication supabase_realtime add table
  public.lobby_messages,
  public.agent_sessions,
  public.bets;

create policy "bar members use bar channels" on realtime.messages
  for select to authenticated using (public.is_member(public.lobby_from_topic(realtime.topic()), (select auth.uid())));
create policy "bar members send on bar channels" on realtime.messages
  for insert to authenticated with check (public.is_member(public.lobby_from_topic(realtime.topic()), (select auth.uid())));
