/*
 * Service worker mínimo. Existe para o navegador oferecer "Adicionar à tela inicial": o jogo é
 * 100% online (servidor autoritativo), então nada é guardado em cache e toda requisição segue
 * direto para a rede.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (evento) => {
  evento.respondWith(fetch(evento.request));
});
