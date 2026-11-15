# Incremento S1: locais e papéis

Este incremento é experimental e requer ambiente Supabase de teste; não usar dados reais. A migração acrescenta papéis ADMIN e TECHNICIAN. Vínculos existentes recebem TECHNICIAN, sem promoção automática. Após aplicar as migrações, um operador autorizado deve atribuir ADMIN explicitamente ao vínculo de teste por conexão administrativa. Sem isso, /cadastros e suas ações negam acesso.

O servidor valida sessão e papel e deriva a organização do vínculo; a chave estrangeira composta impede associar um local a cliente de outra organização. A conexão Prisma é privilegiada: RLS não substitui essas verificações. Nenhum dado anterior é associado automaticamente a um local. Equipamentos ainda pertencem diretamente ao cliente, não ao local; criação e atribuição de OS permanecem pendentes.

Antes de uso, testar migrações em banco descartável e, com duas organizações e usuários admin e técnico, confirmar: criação e persistência de locais após recarga; rejeição de IDs de cliente de outra organização; técnico impedido de ler e invocar ações de cadastros; sessão ausente negada; acesso direto pelas APIs anon/authenticated negado. Repetir testes de isolamento dos cadastros existentes. Estes testes ainda não foram executados.
