# ENTREGA — divida-tecnica

| Campo | Valor |
|---|---|
| **Tarefa** | `divida-tecnica` (plano em `docs/planos/PLANO-divida-tecnica.md`) |
| **Modo** | 🔁 Loop (sem confirmação) |
| **Branch** | `feature/correcoes` (commits locais, sem push) |
| **Data** | 2026-10-21 |

## Resultado

As quatro fases foram executadas. Dos 12 passos, 11 foram entregues como planejado. O passo 12 (TypeScript 7) ficou travado e foi trocado pelo TypeScript 6.0 (ver "Travado").

| Fase | Commits | Verificação ao fim |
|---|---|---|
| 1 — dependências, CI e documentação | `2b0cd11`, `59eae46`, `224d10d` | gate verde; 90 e2e |
| 2 — testes de unidade no web | `42dce07`, `4d63fab`, `0106cb1` | gate verde; 51 testes no web, conferidos por mutação |
| 3 — arquitetura | `d17f2da`, `8222dfa`, `e630d68` | gate verde; 185 testes no servidor; 90 e2e |
| 4 — atualizações majoritárias | `3ac2730`, `f0f0877`, `bf1d269` | gate verde; 90 e2e; mesa conferida no navegador |

O "gate" é `npm run lint`, `typecheck`, `test` e `build`.

## O que mudou

- **Dependências:**
  - esbuild vulnerável corrigido por `overrides`.
  - `@types/node` 24 e `engines >=24`.
  - React 19: as refs viram `RefObject<T | null>` nos hooks da mesa.
  - ESLint 10, com `@eslint/js` 10, `eslint-config-prettier` 10, `globals` 17 e `typescript-eslint` 8.72. A configuração não mudou; uma checagem com `any` e variável sem uso confirmou que as regras continuam valendo.
  - TypeScript 6.0.
  - Ao fim, `npm ls` não acusa mais pacote "invalid".
- **CI:** Dependabot semanal (npm) e mensal (actions); `npm audit --audit-level=high` antes do lint.
- **Testes no web:** Vitest em ambiente node, cobrindo:
  - os cálculos puros: leque, ordem de jogo, tempo, pixel, volume e sessão;
  - a coerência do roteiro do tutorial com as regras.
- **CSS da mesa:** `mesa.css` virou 14 arquivos em `features/mesa/estilos/`. A ordem da cascata foi preservada, e o CSS do build ficou idêntico byte a byte.
- **Validação na borda:**
  - `infrastructure/socket/entradas.ts` converte o `unknown` de cada evento em tipos.
  - Serviço, normalizadores e `Sala` passam a receber tipos. Faixas e regras continuam na aplicação e no domínio.
  - Os códigos de erro não mudaram, inclusive o token inválido, que segue como "Sessão expirada".
  - Os testes de tipo errado foram para `test/infrastructure/entradas.test.ts`.
- **Projeção:**
  - `domain/projecao.ts` concentra quem vê o quê: carta na testa, mão dos eliminados, mão oculta na rodada cega e palpite proibido só para o pé.
  - A `Partida` monta um retrato privado e chama `projetarPara`.
  - Duas mutações nas regras de visibilidade foram pegas pelos testes.
- **Documentação:**
  - CLAUDE.md: som no escopo, mesa em tópicos, testes do web, projeção e entradas na árvore.
  - README: o comando de testes.

## Travado

- **TypeScript 7:** o `typescript-eslint` 8.72 aceita TypeScript `>=4.8.4 <6.1.0`, e o TS 7 não traz mais a API de compilador em JavaScript de que ele depende. Pela premissa P5, a atualização foi abandonada e o projeto foi para o 6.0.3, o maior suportado.
  - Reabrir quando o `typescript-eslint` anunciar suporte ao TS 7.

## Observações

- **Na fase 2, os e2e não rodaram ao fim da fase:** ela só acrescentou testes de unidade, sem tocar em código de tela. Os e2e rodaram ao fim das fases 3 e 4.
- **Item 11 (Redis/escala horizontal):** fora do escopo, por ser a fase 2 do produto.
- **Ainda desatualizados, de propósito:**
  - `@fastify/cors` 11, `concurrently` 10 e `@types/node` 26 não estavam no plano. O `@types/node` 26 nem é desejável, porque o runtime é o Node 24.
  - Ficam com o Dependabot.

## Como validar

```
npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
```

## Próximo passo

Revisar os commits e publicar a branch (push/PR), o que depende do aval do dono do projeto.
