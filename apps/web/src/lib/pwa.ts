import { descreverErro, registrar } from './log';

/**
 * O service worker só existe para o navegador considerar o site instalável ("Adicionar à tela
 * inicial"). Em desenvolvimento ele atrapalharia o hot reload, então só registra em produção.
 */
export function registrarServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((erro: unknown) => {
      registrar('warn', 'pwa.registro_falhou', descreverErro(erro));
    });
  });
}
