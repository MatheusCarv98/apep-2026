# Configurar o acesso da diretoria

O app usa contas individuais do Supabase Auth. A senha não fica no código do
site ou do aplicativo. O banco só permite escrita para contas cadastradas na
lista de diretores ativos.

## Preparar o Supabase

1. No Supabase do APEP, abra **SQL Editor** e execute o arquivo
   `supabase-setup.sql` atualizado. A migração mantém os registros existentes
   do campeonato, cria as tabelas de acesso/auditoria e remove as políticas de
   escrita pública anteriores.
2. Em **Authentication → Users**, crie uma conta para cada diretor. Use o
   e-mail individual da pessoa e defina uma senha forte.
3. No SQL Editor, associe cada conta à diretoria substituindo o e-mail e o
   nome neste comando:

   ```sql
   insert into public.apep_diretores (user_id, nome, ativo)
   select id, 'Nome do diretor', true
   from auth.users
   where email = lower('diretor@exemplo.com')
   on conflict (user_id) do update
     set nome = excluded.nome, ativo = true;
   ```

   O comando deve inserir uma linha. Se não inserir nenhuma, confira se o
   usuário foi criado em **Authentication → Users** e se o e-mail está correto.
4. Repita para cada diretor. Para remover acesso, defina `ativo = false` para
   o `user_id` correspondente ou exclua essa linha.

## Entrar no app

Na área **Diretoria**, cada pessoa usa o e-mail e a senha de sua conta. Contas
autenticadas que não estiverem ativas em `apep_diretores` não recebem acesso de
edição. A leitura dos dados do campeonato continua pública.

As contas existentes não são criadas automaticamente. Cadastre os diretores
antes de publicar a versão com login individual; a senha compartilhada antiga
deixa de funcionar nessa versão.
