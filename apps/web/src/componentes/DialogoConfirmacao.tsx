import { Dialogo } from './Dialogo';

interface Props {
  readonly titulo: string;
  readonly texto: string;
  readonly rotuloConfirmar: string;
  readonly ocupado?: boolean;
  readonly onConfirmar: () => void;
  readonly onCancelar: () => void;
}

/** Confirmação de ações sem volta (expulsar, reiniciar, sair). O foco inicial fica em "Cancelar". */
export function DialogoConfirmacao({
  titulo,
  texto,
  rotuloConfirmar,
  ocupado = false,
  onConfirmar,
  onCancelar,
}: Props) {
  return (
    <Dialogo
      idTitulo="titulo-confirmacao"
      papel="alertdialog"
      destaque="rosa"
      onFechar={onCancelar}
    >
      <h2 id="titulo-confirmacao" className="neon dialogo__titulo">
        {titulo}
      </h2>
      <p className="dialogo__texto">{texto}</p>
      <div className="dialogo__acoes">
        <button type="button" className="botao" onClick={onCancelar}>
          Cancelar
        </button>
        <button
          type="button"
          className="botao botao--perigo"
          disabled={ocupado}
          onClick={onConfirmar}
        >
          {rotuloConfirmar}
        </button>
      </div>
    </Dialogo>
  );
}
