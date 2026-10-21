# Marca do Fodinha

O logo é o "F" cursivo neon do título (fonte Yellowtail). O verso das cartas leva uma estrela em
pixel, não o F: pequeno, ele era lido como um 7. O F está
convertido em contorno vetorial (não depende da fonte instalada) e centralizado pela caixa real do traço.

| Arquivo                | Uso                                                           |
| ---------------------- | ------------------------------------------------------------- |
| `logo-quadrado.svg`    | Fundo roxo quadrado, sem cantos (lojas, redes, capa).         |
| `logo-arredondado.svg` | Fundo com cantos arredondados (favicon e ícone do app).       |
| `logo-circular.svg`    | Fundo circular, transparente fora do círculo (avatar).        |
| `logo-sem-fundo.svg`   | Só o F com o brilho, fundo transparente (sobre fundo escuro). |

Cada um tem a versão PNG em 512 px. Os ícones do site (`apps/web/public`) saem destes arquivos.
Para regerar: `node gerar-logo.mjs <pasta com opentype.js e @fontsource/yellowtail instalados>`.
