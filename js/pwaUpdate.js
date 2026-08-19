// Registro del service worker + aviso de actualización disponible + versión visible.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-app-version]').forEach((el) => {
    el.textContent = `v${APP_VERSION}`;
  });
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // Chequeo activo al entrar (no depende solo del chequeo periódico del navegador)
      reg.update().catch(() => {});

      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing;
        if (!nuevo) return;

        nuevo.addEventListener('statechange', () => {
          // installed + ya había un controller = es una ACTUALIZACIÓN, no la primera instalación
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
            if (typeof Toast !== 'undefined') {
              Toast.mostrar('Hay una versión nueva de la app.', {
                tipo: 'info',
                duracion: 0,
                accion: { texto: 'Actualizar', onClick: () => window.location.reload() },
              });
            }
          }
        });
      });
    }).catch(() => {});
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then((reg) => reg && reg.update().catch(() => {}));
    }
  });
}
