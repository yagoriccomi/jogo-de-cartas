interface Props {
  /** Quem palpita agora; `null` entre uma vez e outra (ou com a mesa pausada). */
  readonly nomeDaVez: string | null;
  readonly soma: number;
  readonly cartasNaRodada: number;
  readonly palpitaram: number;
  readonly vivos: number;
}

/** As duas metades do saldo ("Pediram 3 de 5", "sobram 2"): o painel apertado quebra entre elas. */
export function partesDoSaldo(soma: number, cartasNaRodada: number): readonly [string, string] {
  const saldo = cartasNaRodada - soma;
  const resto = saldo < 0 ? `passou ${-saldo}` : `sobram ${saldo}`;
  return [`Pediram ${soma} de ${cartasNaRodada}`, resto];
}

/** Saldo em palavras (cartas da rodada − soma dos palpites), o mesmo no painel e no feltro. */
export function descreverSaldo(soma: number, cartasNaRodada: number): string {
  return partesDoSaldo(soma, cartasNaRodada).join(' · ');
}

/** Centro do feltro enquanto os outros palpitam: de quem é a vez e como a soma está. */
export function AndamentoDosPalpites({
  nomeDaVez,
  soma,
  cartasNaRodada,
  palpitaram,
  vivos,
}: Props) {
  return (
    <div className="andamento" role="status">
      <p className="andamento__vez">
        {nomeDaVez === null ? (
          'Palpites em andamento…'
        ) : (
          <>
            <strong className="andamento__nome">{nomeDaVez}</strong> está palpitando…
          </>
        )}
      </p>
      <p className="neon neon--ciano andamento__saldo">{descreverSaldo(soma, cartasNaRodada)}</p>
      <p className="andamento__quantos">
        {palpitaram} de {vivos} já palpitaram
      </p>
    </div>
  );
}
