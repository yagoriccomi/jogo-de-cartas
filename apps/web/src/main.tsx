import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { iniciarConexao } from './estado/acoes';
import { aplicarTemaSalvo } from './lib/tema';
import './estilos/tokens.css';
import './estilos/base.css';

aplicarTemaSalvo();
iniciarConexao();

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz não encontrado em index.html');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
