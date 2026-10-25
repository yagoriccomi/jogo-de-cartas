import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { iniciarConexao } from './estado/acoes';
import { iniciarLogin } from './features/login/login';
import { registrarServiceWorker } from './lib/pwa';
import './estilos/tokens.css';
import './estilos/base.css';

iniciarConexao();
void iniciarLogin();
registrarServiceWorker();

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz não encontrado em index.html');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
