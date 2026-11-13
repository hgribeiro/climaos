# ClimaOS — demonstração comercial

Site institucional e demonstração de uma OS fictícia, sem login ou servidor. Use somente dados fictícios. Alterações e relatório ficam no navegador quando o armazenamento estiver disponível; a impressão do navegador permite salvar em PDF.

## Desenvolvimento e verificação

Com Node.js 22: `npm install`, `npm run typecheck`, `npm run build`. A exportação estática fica em `out/`.

## Publicação no GitHub Pages

O workflow `.github/workflows/pages.yml` gera e publica a exportação com o prefixo `/climaos`. Em Settings → Pages, selecione GitHub Actions como origem e habilite Pages/Actions conforme as permissões e o plano do repositório. Após incorporar o workflow à branch padrão, execute-o em Actions → Deploy demo to GitHub Pages → Run workflow ou faça push em main. Confira o resultado do job e a URL informada pelo ambiente github-pages; a URL esperada é https://hgribeiro.github.io/climaos/ somente se a publicação estiver habilitada e concluída. Não há deploy automático em pull requests.

## Roteiro manual

Em celular e desktop, abra o site e a demo; confira cliente, equipamento, checklist e ilustrações. Altere uma observação e recarregue para verificar persistência. Revise, salve e imprima para PDF; confira dados, imagens e espaço de assinatura. Restaure o exemplo, confirme a substituição e recarregue. Repita com armazenamento bloqueado e confira o aviso. Não há testes de navegador automatizados neste repositório.
