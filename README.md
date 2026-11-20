# ClimaOS

## Área do técnico

Em `/campo/`, o técnico pode abrir um pedido de cliente com a primeira ordem de serviço, registrar visitas de retorno no mesmo pedido e anexar fotos e observações à OS de cada visita. No piloto, cada técnico acessa os pedidos que criou.

Para executar a área operacional localmente, use Node.js 22.13 ou superior, compile na raiz do domínio e inicie o servidor com SQLite. Defina `CLIMAOS_USERS` no ambiente do processo como um objeto JSON que associa cada usuário à respectiva senha. Exemplo para desenvolvimento local com credencial fictícia:

```sh
npm ci
npm run build
CLIMAOS_USERS='{"tecnico":"apenas-para-teste-local"}' HOST=127.0.0.1 npm run campo
```

Abra http://localhost:3000/campo/. O servidor lê `PORT` e `CLIMAOS_DB`. Por padrão, grava os dados em `server/climaos.sqlite`. Para uso em celular fora de localhost, disponibilize o servidor por HTTPS, configure `NODE_ENV=production` e `CLIMAOS_ORIGIN` com a origem pública exata (por exemplo, `https://campo.exemplo.com`) e mantenha o banco em um volume persistente. O GitHub Pages hospeda a demonstração estática. A área do técnico usa a API do processo Node na mesma origem.

### Verificação em campo

1. Entre com conexão, crie o pedido e abra a OS de diagnóstico. Aguarde a confirmação de acesso offline.
2. Desative a conexão, registre uma foto e uma observação e aguarde “Salvo neste aparelho”. Feche a aba e reabra `/campo/` no mesmo navegador.
3. Confira a evidência, reconecte com a área do técnico aberta e aguarde “Enviado”. Recarregue e confira que há apenas uma cópia.
4. No mesmo pedido, abra uma OS de retorno e registre o reparo. Confira que cada visita apresenta suas próprias evidências.

## Demonstração comercial

Site institucional e demonstração de uma OS fictícia, sem login ou servidor. Use somente dados fictícios. Alterações e relatório ficam no navegador quando o armazenamento estiver disponível; a impressão do navegador permite salvar em PDF.

## Desenvolvimento e verificação

Com Node.js 22: `npm install`, `npm run typecheck`, `npm run build`. A exportação estática fica em `out/`.

## Publicação no GitHub Pages

O workflow `.github/workflows/pages.yml` gera e publica a exportação com o prefixo `/climaos`. Em Settings → Pages, selecione GitHub Actions como origem e habilite Pages/Actions conforme as permissões e o plano do repositório. Após incorporar o workflow à branch padrão, execute-o em Actions → Deploy demo to GitHub Pages → Run workflow ou faça push em main. Confira o resultado do job e a URL informada pelo ambiente github-pages; a URL esperada é https://hgribeiro.github.io/climaos/ somente se a publicação estiver habilitada e concluída. Não há deploy automático em pull requests.

## Roteiro manual

Em celular e desktop, abra o site e a demo; confira cliente, equipamento, checklist e ilustrações. Altere uma observação e recarregue para verificar persistência. Revise, salve e imprima para PDF; confira dados, imagens e espaço de assinatura. Restaure o exemplo, confirme a substituição e recarregue. Repita com armazenamento bloqueado e confira o aviso. Não há testes de navegador automatizados neste repositório.


## Fontes e imagens

O cliente, o equipamento, o histórico, os sintomas e os resultados são fictícios; não descrevem visita real. O checklist foi inspirado no [guia ENERGY STAR de manutenção](https://www.energystar.gov/sites/default/files/asset/document/HeatingCoolingGuide%20FINAL_9-4-09.pdf), que menciona filtros e inspeção do dreno de condensado; detalhes do caso não foram retirados de uma OS real.

As fotografias são referências gerais e não comprovam o atendimento fictício. São carregadas remotamente do Wikimedia Commons e dependem de conexão. As versões exibidas foram redimensionadas pelo Commons:

- [Air Conditioner 1](https://commons.wikimedia.org/wiki/File:Air_Conditioner_1.jpg), Open Grid Scheduler / Grid Engine, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- [Aircon cleaning in the Philippines 02](https://commons.wikimedia.org/wiki/File:5233Aircon_cleaning_in_the_Philippines_02.jpg), Judgefloro, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

Para visualizar o exemplo atualizado em navegador que já tem um rascunho, use “Restaurar demonstração” após guardar o que deseja manter. A confirmação substitui o rascunho e o relatório locais.
