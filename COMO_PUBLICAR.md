# Como publicar o site do APEP 2026 (grátis)

Este projeto já vem pronto. Você só precisa: (1) criar o banco de dados
no Supabase, (2) subir o código no GitHub, (3) conectar na Vercel.
Leva uns 15-20 minutos e não custa nada.

## 1. Criar o banco de dados (Supabase)

1. Acesse **supabase.com** e crie uma conta grátis (dá pra entrar com o GitHub ou Google).
2. Clique em **New project**. Dê um nome (ex.: `apep-2026`) e uma senha para o banco
   (guarde essa senha em algum lugar, mas você não vai precisar dela no dia a dia).
3. Espere o projeto ser criado (leva 1-2 minutos).
4. No menu lateral, clique em **SQL Editor** → **New query**.
5. Abra o arquivo `supabase-setup.sql` (está junto com este projeto), copie todo o
   conteúdo, cole no editor e clique em **Run**.
6. No menu lateral, clique em **Project Settings** (ícone de engrenagem) → **API**.
7. Copie dois valores que vai usar no próximo passo:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public key** (uma chave longa)

## 2. Subir o código no GitHub

1. Crie uma conta grátis em **github.com**, se ainda não tiver.
2. Clique em **New repository**, dê um nome (ex.: `apep-2026`) e crie (pode deixar público ou privado).
3. Suba todos os arquivos desta pasta para esse repositório (pelo site do GitHub mesmo,
   arrastando os arquivos em "Add file" → "Upload files", ou usando o Git se preferir).

   **Importante:** não suba o arquivo `.env` (ele nem deve existir ainda — isso é
   só um lembrete, pois ele guarda uma chave que não deve ir pro GitHub).

## 3. Publicar na Vercel (grátis)

1. Acesse **vercel.com** e crie conta (dá pra entrar direto com o GitHub).
2. Clique em **Add New** → **Project**.
3. Selecione o repositório `apep-2026` que você acabou de subir.
4. Antes de clicar em Deploy, abra **Environment Variables** e adicione:
   - `VITE_SUPABASE_URL` → cole a Project URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` → cole a anon public key do Supabase
5. Clique em **Deploy**. Em cerca de 1 minuto o site estará no ar.
6. Você vai receber um link tipo `apep-2026.vercel.app` — esse é o site final,
   pode compartilhar com todo mundo.

## Testando localmente (opcional, se quiser mexer no código antes)

```bash
npm install
cp .env.example .env
# edite o .env e cole as suas chaves do Supabase
npm run dev
```

## Lembrete sobre a senha da diretoria

O app continua protegido pela senha `APEP2026` (a mesma que já existia) para
quem for cadastrar pescadores ou lançar as etapas — isso não muda com a
publicação. Se quiser trocar essa senha, procure por `ADMIN_PIN` dentro do
arquivo `src/App.jsx`.
