// Sistema de notificaciones tipo "toast": mensajes breves no bloqueantes,
// con animación de entrada/salida. Reemplaza al antiguo banner fijo de error.
const Toast = (() => {
  let container = null;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    return container;
  }

  function mostrar(mensaje, opciones = {}) {
    const { tipo = 'info', duracion = 3200, accion = null } = opciones;

    const el = document.createElement('div');
    el.className = `toast toast-${tipo}`;

    const texto = document.createElement('span');
    texto.className = 'toast-text';
    texto.textContent = mensaje;
    el.appendChild(texto);

    const cerrar = () => {
      el.classList.remove('toast-in');
      el.classList.add('toast-out');
      setTimeout(() => el.remove(), 220);
    };

    if (accion) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action';
      btn.textContent = accion.texto;
      btn.addEventListener('click', () => {
        accion.onClick();
        cerrar();
      });
      el.appendChild(btn);
    }

    getContainer().appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast-in'));

    if (duracion) {
      setTimeout(cerrar, duracion);
    }

    return { cerrar };
  }

  return { mostrar };
})();
