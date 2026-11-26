-- Dowit database. Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run more than once.

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  friend_code text not null unique check (friend_code ~ '^[A-Z0-9]{6}$'),
  points int not null default 0 check (points >= 0),
  streak int not null default 0 check (streak >= 0),
  title text check (char_length(title) <= 30),
  updated_at timestamptz not null default now()
);

-- ---------- Friendships ----------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles on delete cascade,
  addressee uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted' and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

-- Friends, or a pending request either way (so you can see who asked).
create or replace function public.are_connected(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where (requester = a and addressee = b) or (requester = b and addressee = a)
  );
$$;

-- Look someone up by friend code without exposing every profile.
create or replace function public.find_profile_by_code(code text) returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name from profiles p where p.friend_code = upper(trim(code)) limit 1;
$$;

revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.are_connected(uuid, uuid) from public, anon;
revoke execute on function public.find_profile_by_code(text) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.are_connected(uuid, uuid) to authenticated;
grant execute on function public.find_profile_by_code(text) to authenticated;

-- ---------- Dares and sabotages ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null default auth.uid() references public.profiles on delete cascade,
  recipient uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('dare', 'sabotage')),
  payload jsonb not null check (pg_column_size(payload) < 2000),
  status text not null default 'sent' check (status in ('sent', 'delivered', 'blocked', 'completed')),
  result jsonb check (result is null or pg_column_size(result) < 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists messages_recipient on public.messages (recipient, status);
create index if not exists messages_sender on public.messages (sender, updated_at);

-- Server-side safety net against sabotage spam (the app allows 1 free a day plus tokens).
create or replace function public.limit_sabotage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'sabotage' and (
    select count(*) from messages
    where sender = new.sender and kind = 'sabotage' and created_at > now() - interval '1 day'
  ) >= 5 then
    raise exception 'Sabotage limit reached for today';
  end if;
  return new;
end;
$$;
drop trigger if exists limit_sabotage on public.messages;
create trigger limit_sabotage before insert on public.messages for each row execute function public.limit_sabotage();

-- ---------- Proof posts (photos/videos friends can see) ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  title text not null check (char_length(title) <= 80),
  kind text not null check (kind in ('image', 'video')),
  path text not null,
  created_at timestamptz not null default now()
);
create index if not exists posts_user on public.posts (user_id, created_at desc);

-- ---------- Row level security ----------
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.messages enable row level security;
alter table public.posts enable row level security;

drop policy if exists "profiles read" on public.profiles;
drop policy if exists "profiles insert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (id = auth.uid() or public.are_connected(id, auth.uid()));
create policy "profiles insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "friendships read" on public.friendships;
drop policy if exists "friendships request" on public.friendships;
drop policy if exists "friendships accept" on public.friendships;
drop policy if exists "friendships remove" on public.friendships;
create policy "friendships read" on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));
create policy "friendships request" on public.friendships for insert to authenticated with check (requester = auth.uid() and status = 'pending');
create policy "friendships accept" on public.friendships for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
create policy "friendships remove" on public.friendships for delete to authenticated using (auth.uid() in (requester, addressee));

drop policy if exists "messages read" on public.messages;
drop policy if exists "messages send" on public.messages;
drop policy if exists "messages respond" on public.messages;
create policy "messages read" on public.messages for select to authenticated using (auth.uid() in (sender, recipient));
create policy "messages send" on public.messages for insert to authenticated
  with check (sender = auth.uid() and status = 'sent' and result is null and public.are_friends(sender, recipient));
create policy "messages respond" on public.messages for update to authenticated using (recipient = auth.uid()) with check (recipient = auth.uid());
-- Recipients may only change the status/result, never who sent it or what it says.
revoke update on public.messages from authenticated;
grant update (status, result, updated_at) on public.messages to authenticated;

drop policy if exists "posts read" on public.posts;
drop policy if exists "posts create" on public.posts;
drop policy if exists "posts delete" on public.posts;
create policy "posts read" on public.posts for select to authenticated using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));
create policy "posts create" on public.posts for insert to authenticated with check (user_id = auth.uid() and path like auth.uid()::text || '/%');
create policy "posts delete" on public.posts for delete to authenticated using (user_id = auth.uid());

-- ---------- Storage for proof files ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('proofs', 'proofs', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "proofs upload own" on storage.objects;
drop policy if exists "proofs read own and friends" on storage.objects;
drop policy if exists "proofs delete own" on storage.objects;
create policy "proofs upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "proofs read own and friends" on storage.objects for select to authenticated
  using (
    bucket_id = 'proofs' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.posts p where p.path = name and public.are_friends(p.user_id, auth.uid()))
    )
  );
create policy "proofs delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Live updates ----------
do $$
begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.friendships; exception when duplicate_object then null; end;
end $$;
