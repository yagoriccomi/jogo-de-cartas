// Log estruturado do cliente. Nunca recebe apelidos nem tokens: só códigos e mensagens técnicas.
type Nivel = 'warn' | 'error';

export function registrar(
  nivel: Nivel,
  evento: string,
  contexto: Record<string, unknown> = {},
): void {
  const linha = JSON.stringify({ nivel, evento, ...contexto, em: new Date().toISOString() });
  if (nivel === 'error') console.error(linha);
  else console.warn(linha);
}

export function descreverErro(erro: unknown): { mensagemTecnica: string } {
  return { mensagemTecnica: erro instanceof Error ? erro.message : String(erro) };
}
