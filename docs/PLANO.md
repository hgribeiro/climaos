# Plano de entrega ClimaOS

## Demonstração estática S0
Restaurar a demo da PR #3 após a reversão #5; a PR #6 não contém alterações. Integrar a PR de recuperação, habilitar GitHub Pages e verificar o deploy e a URL pública. Validar revisão, salvamento, recarga, restauração, impressão, falha de armazenamento, navegação por teclado e telas de 360 px e desktop. Usar dados fictícios; imagens remotas dependem de conexão. CI não substitui teste de navegador.

## S1: fluxo operacional mínimo
1. Base autenticada: build de servidor independente da exportação estática, autenticação e papéis admin/técnico, migrações reproduzíveis, ambiente de teste isolado e testes de acesso cruzado. A PR #2 usa Supabase Auth e Prisma com conexão de servidor privilegiada; RLS não substitui autorização no servidor. Validar sessão e renovação, escopo das consultas e operações de escrita, inclusive IDs adulterados.
2. Admin: cadastrar cliente, local e equipamentos vinculados à organização. Criar OS de cliente existente em até três etapas, com um ou mais equipamentos e técnico atribuído. Validar integridade entre organização, cliente, local, equipamento e técnico.
3. Técnico: acessar apenas OS atribuídas, registrar execução textual no servidor e revisar. Aplicar verificações de organização e atribuição em todas as leituras e escritas.
4. PDF privado e recuperável gerado no servidor: snapshot imutável com prestadora, cliente, local, equipamentos, objetivo/descrição, execução, período, responsável e observações ou ausência explícita. Persistir arquivo; falha não confirma emissão; retry idempotente. Proteger downloads por organização e atribuição. Testar falhas, repetição e acessos indevidos.

Estados do PRD: Rascunho → Agendada → Em execução → Concluída → Encerrada. Não presumir regras de reabertura ou encerramento; esclarecer quando necessárias.

## S2 e S3
S2: checklist e fotos por equipamento, com recuperação de rascunho. S3: assinatura e versionamento completo. Não tornar checklist obrigatório no PDF de S1. Comparação de equivalência Artcool depende do relatório original e validação real.

## Pendências transversais
Fixar dependências e gerar lockfile; testes automatizados de autorização entre organizações e técnicos, migrações em banco limpo, recuperação de sessão e falhas de persistência. Produto e design são especificações, ainda sem validação com usuários. Não usar dados reais até os controles e o ambiente serem verificados.
