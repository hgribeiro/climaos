# S1: cadastros em ambiente de teste

A rota /cadastros é independente da demonstração S0, que continua usando apenas o navegador. Os campos são provisórios. Use somente dados fictícios e um projeto Supabase separado de qualquer ambiente com dados reais. Não use esta versão em produção.

1. Crie um projeto Supabase de teste. Desabilite cadastro público no Auth. Configure as variáveis de .env.example em .env.local; DATABASE_URL pode usar o pooler de transações e DIRECT_URL precisa de conexão direta para migrações. Não publique credenciais.
2. Instale as dependências, execute npx prisma migrate deploy e depois npm run dev. Acesse /cadastros.
3. No Supabase Auth, convide ou crie um usuário de teste. Por conexão administrativa ao banco, insira uma Organization e uma Membership com o UUID desse usuário. IDs são UUIDs; gere o ID da organização fora do navegador. Um usuário pertence a uma única organização nesta etapa. Não há cadastro público nem interface administrativa.
4. Crie uma segunda organização e um segundo usuário para testar isolamento. Entre com cada conta: clientes e equipamentos da outra não devem aparecer. Uma tentativa de enviar o ID de cliente de outra organização deve falhar. Confira também que sair ou acessar sem sessão impede abrir /cadastros.
5. Cadastre, atualize e consulte um cliente; adicione um equipamento e recarregue para verificar persistência. Os dados do S0 não migram para o S1.

A autorização acontece no servidor com identidade verificada pelo Supabase e vínculo consultado no banco; o ID da organização não vem de formulários. A chave composta do banco impede associar equipamento e cliente de organizações diferentes. Papéis, gestão de usuários, seleção para OS, testes automatizados de isolamento e fluxo de recuperação de sessão ainda precisam ser concluídos antes de uso operacional.
