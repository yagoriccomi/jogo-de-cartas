interface Props {
  readonly mensagem: string;
  /** Saída de emergência: nenhuma espera pode ser infinita sem alternativa para o usuário. */
  readonly onCancelar?: () => void;
  readonly rotuloCancelar?: string;
}

export function TelaCarregando({ mensagem, onCancelar, rotuloCancelar = 'Cancelar' }: Props) {
  return (
    <div className="carregando" role="status">
      <div className="carregando__giro" aria-hidden="true" />
      <p>{mensagem}</p>
      {onCancelar && (
        <button type="button" className="botao" onClick={onCancelar}>
          {rotuloCancelar}
        </button>
      )}
    </div>
  );
}
