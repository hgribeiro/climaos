# Validação do protótipo S0

Use apenas dados fictícios. Execute com Node.js 22: `npm install`, `npm run dev`. Abra http://localhost:3000.

1. Entre na demonstração; percorra clientes, detalhe e equipamentos.
2. No detalhe, escolha Nova OS, preencha data/técnico/objetivo e abra execução: três ações principais.
3. Marque checklist, adicione uma imagem JPEG/PNG/WebP de até 500 KB, edite legenda e posição antes/depois.
4. Espere aparecer "Rascunho salvo neste navegador"; recarregue e retome pela lista de OS.
5. Confirme que checklist, texto e imagens voltam. Em armazenamento indisponível/cheio, deve aparecer erro explícito, nunca confirmação de salvamento.
6. Revise, preencha responsável e desenhe assinatura. Limpe e refaça para testar.
7. Salve relatório demonstrativo. Volte à execução, altere observações e confira que a versão salva mantém o conteúdo original.
8. Abra a impressão e revise A4. O PDF via impressão é demonstração do navegador, não emissão no servidor.
9. Repita em viewport de 360 px e usando teclado. Confirme labels, foco, botões acessíveis e fotos sem cortes.
10. Tente revisar com objetivo vazio e salvar relatório sem nome/assinatura: ações bloqueadas.

## Limitações e próximos passos

Não há autenticação real, backend, autorização, upload remoto, PWA instalável ou PDF de servidor. Fotos e assinatura ficam somente neste navegador; limite de seis imagens de até 500 KB cada e aproximadamente 600 KB no conjunto para o piloto visual. Não há sincronização entre aparelhos. Limpar dados do navegador remove rascunhos/relatório. Não usar dados reais.

A demonstração cobre uma OS por vez, um cliente e um equipamento fictícios. Criar outra OS substitui o rascunho mediante confirmação explícita e preserva o último relatório. O último relatório salvo é um snapshot separado do rascunho. Cada nova emissão demonstrativa substitui a versão consultável; histórico completo entra em S3.

A CI executa TypeScript e build. Não há lockfile inicial: gerar e versionar package-lock.json no primeiro ambiente com npm para builds reproduzíveis. Nenhuma execução de build/testes locais foi realizada pelo agente; o ambiente de trabalho só fornece o conector GitHub.

11. Durante leitura de foto, crie outra OS: a imagem da OS anterior não deve ser anexada à nova.
12. Provoque erro de persistência e navegue entre telas: o aviso deve permanecer até um salvamento bem-sucedido.
