import { registerSW } from 'virtual:pwa-register';

/**
 * Registro do service worker.
 *
 * É o que faz o PDV **abrir** sem internet: na primeira visita o app inteiro é
 * guardado no dispositivo, e a partir daí o quiosque levanta o caixa mesmo com
 * o link caído. Atualização é automática e silenciosa — o terminal nunca fica
 * numa versão velha porque alguém esqueceu de recarregar.
 */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return;

  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      // Confere atualização de hora em hora, sem atrapalhar quem está vendendo.
      setInterval(() => void registration?.update(), 60 * 60 * 1000);
    },
  });
}
