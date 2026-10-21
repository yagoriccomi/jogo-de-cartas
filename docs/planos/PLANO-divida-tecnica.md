# PLANO DE EXECUÇÃO — divida-tecnica

| Campo | Valor |
|---|---|
| **Tarefa** | `divida-tecnica` |
| **Origem** | Descrição livre (auditoria `/engineering:tech-debt`) |
| **Tipo** | Melhoria |
| **Modo de execução** | 🔁 Loop (sem confirmação) |
| **Data** | 2026-10-21 |
| **Branch** | `feature/correcoes` |

---

## 1. Enunciado Canônico

- **Problema:** a auditoria apontou dívidas de teste (web sem testes unitários), dependências (esbuild vulnerável, tipos do Node 22, atualizações majoritárias), documentação (CLAUDE.md desatualizado), CSS monolítico e pequenas violações de arquitetura.
- **Resultado esperado:** as quatro fases do plano de remediação executadas, cada uma fechada com lint, typecheck, testes, build e testes de tela verdes.
- **Como validar:** `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e` verdes ao fim de cada fase; a mesa continua idêntica (capturas antes/depois).

## 2. Escopo

**Vou fazer:**
- Fase 1: `npm audit fix`; `@types/node` 24 e `engines >=24`; Dependabot + `npm audit` no CI; CLAUDE.md (sons no escopo, parágrafo da mesa em tópicos).
- Fase 2: Vitest no web com testes unitários dos módulos puros (`leque`, `ordemDeJogo`, `tempo`, `dicaDoGesto`, estado); teste de coerência do roteiro do tutorial.
- Fase 3: dividir `mesa.css` por área sem mudar a cascata; payload `unknown` validado na borda (gateway) antes da aplicação; projeção `visaoPara` extraída de `Partida`.
- Fase 4: React 19, ESLint 10 (e companhia), TypeScript 7 — um por commit; o que travar fica registrado e a fase segue.

**NÃO vou fazer** [#8]:
- Item 11 (Redis/escala horizontal): fase 2 do produto.
- Qualquer mudança visual ou de regra do jogo.
- Push, PR ou deploy.

## 3. Premissas Assumidas

| # | Premissa | Por quê | Se estiver errada… |
|---|---|---|---|
| P1 | Commits locais em `feature/correcoes`, sem push | Commits atômicos e reversíveis [#31][#84]; push é ação externa | `git reset` local antes de publicar |
| P2 | Vitest do web em ambiente `node`, só para módulos puros (sem jsdom/Testing Library) | KISS, sem dependência nova [#7]; os componentes já têm e2e [#43] | Adicionar jsdom depois, se quiserem testar componentes |
| P3 | `engines` passa para `>=24`, igual a Dockerfile, compose, CI e Render | Paridade de ambientes [#81] | Voltar para `>=22` |
| P4 | Dividir `mesa.css` mantendo a ordem original dos blocos (importados em sequência) | Cascata idêntica = zero mudança visual | Reverter o commit |
| P5 | Atualização majoritária que quebrar a ferramenta (ex.: TS 7 sem suporte no typescript-eslint) é abandonada e registrada | O usuário pediu: se travar, siga para a próxima | Reabrir quando o ecossistema suportar |
| P6 | O domínio continua checando invariantes; a borda converte `unknown` em tipo antes da aplicação | Regra do CLAUDE.md "validar na borda" [#51] sem perder defesa no domínio [#30] | — |

## 4. Decisão Visual

- **Tem superfície visual?** Não intencional. A divisão do CSS e o React 19 não podem mudar nada na tela.
- **Precisa de mockup?** Não, porque não há tela nova nem layout alterado.
- **`design-de-interface-projeto` acionada?** Não aplicável. A verificação é feita pelos testes de tela (5 tamanhos) e por capturas antes/depois do cenário `?cenario=10x13`.

## 5. Terreno

| Arquivo | Papel hoje | O que muda |
|---|---|---|
| `package-lock.json`, `package.json`, `apps/server/package.json` | dependências | audit fix, `@types/node`, engines |
| `.github/dependabot.yml`, `.github/workflows/ci.yml` | CI | criar Dependabot; passo `npm audit` |
| `CLAUDE.md` | regras vivas | sons no escopo; mesa em tópicos |
| `apps/web/package.json`, `apps/web/vitest.config.ts`, `apps/web/test/**` | — | Vitest e testes unitários |
| `apps/web/src/features/mesa/mesa.css` | estilo da mesa (2.294 linhas) | dividido em arquivos por área |
| `apps/server/src/infrastructure/socket/gateway.ts`, `application/servico-de-salas.ts`, `domain/sala.ts` | borda/caso de uso/domínio | tipos validados na borda |
| `apps/server/src/domain/partida.ts` | regras + projeção | projeção em módulo próprio |

**Reaproveitamento** [#6]: `validarConfiguracao`/`validarMortosVeemCartas` já existem; os testes de domínio cobrem `visaoPara`.
**Convenções** [#5][#13]: PT-BR no domínio, testes em `test/` espelhando `src/`, Conventional Commits em PT-BR.

## 6. Passos Atômicos

| # | Arquivo alvo | O que muda | Prática | Como verificar |
|---|---|---|---|---|
| 1 | `package-lock.json` | `npm audit fix` (esbuild) | [#62] | `npm audit` sem achados |
| 2 | `package.json`s | `@types/node` 24 e `engines >=24` | [#81][#11] | typecheck |
| 3 | `.github/*` | Dependabot semanal + `npm audit --audit-level=high` no CI | [#62][#76] | YAML válido |
| 4 | `CLAUDE.md` | sons no escopo; parágrafo da mesa em tópicos | [#96] | leitura |
| 5 | `apps/web` | Vitest + testes de `leque`, `ordemDeJogo`, `tempo`, `dicaDoGesto` e estado | [#41][#47] | `npm test` |
| 6 | `apps/web/test` | coerência do roteiro do tutorial | [#41] | `npm test` |
| 7 | `mesa.css` | dividido por área, mesma ordem | [#13] | e2e + capturas |
| 8 | gateway/serviço/sala | `unknown` validado na borda | [#51][#30] | testes do servidor |
| 9 | `partida.ts` | projeção extraída | [#16][#13] | testes de domínio |
| 10 | web | React 19 | [#62] | gate + e2e |
| 11 | raiz | ESLint 10 + config/globals | [#62] | lint |
| 12 | raiz | TypeScript 7 (travado: ficou no 6.0, ver ENTREGA) | [#62] | gate |

## 7. Impacto em Dados e Contratos

- **Banco de dados:** nenhum.
- **Contrato de API (`@fodinha/shared`):** nenhum.
- **Configuração:** nenhuma variável nova.
- **LGPD:** nenhum.

## 8. Plano de Testes

| Nível | O que cobre | Caminho de falha |
|---|---|---|
| Unidade [#41] | leque, ordem de jogo, prazos, dica do gesto, estado, roteiro | limites (1 carta, 39+ cartas, sem prazo, localStorage indisponível) |
| Integração [#42] | gateway com payload inválido | tipos errados recusados com erro limpo |
| E2E [#43] | mesa, palpite, tutorial em 5 tamanhos | — |

**Comando:** `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`

## 9. Riscos e Rollback

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Cascata do CSS muda | Média | layout quebrado | mesma ordem de blocos; e2e + capturas |
| React 19 muda o comportamento de efeitos/refs | Média | animações | e2e + uso real no cenário |
| TS 7 sem suporte no typescript-eslint | Alta | lint quebra | abandonar e registrar (P5) |

**Rollback** [#84]: um commit por passo; `git revert <hash>`.

## 10. Definição de Pronto

- [x] Passos 1–12 executados ou registrados como bloqueados
- [x] lint, typecheck, test, build verdes
- [x] e2e verdes
- [x] Mesa conferida no navegador
- [x] Commits atômicos (Conventional Commits)
- [x] `docs/planos/ENTREGA-divida-tecnica.md` escrito
- [x] `CLAUDE.md`/README atualizados quando aplicável
