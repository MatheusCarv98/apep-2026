-- Rode isso no SQL Editor do Supabase (Menu lateral > SQL Editor > New query)

create table if not exists apep_dados (
  id text primary key,
  pescadores jsonb default '[]'::jsonb,
  etapas jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Libera leitura e escrita pública (sem login), já que o app usa
-- uma senha própria (APEP2026) dentro da tela pra proteger a edição.
alter table apep_dados enable row level security;

create policy "Leitura publica" on apep_dados
  for select using (true);

create policy "Escrita publica" on apep_dados
  for insert with check (true);

create policy "Atualizacao publica" on apep_dados
  for update using (true);
