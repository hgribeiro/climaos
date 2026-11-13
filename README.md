# ClimaOS — demonstração comercial

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
