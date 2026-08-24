// Flujo del escáner: se abre desde el ícono 📷 de UN carro puntual (ver
// window.escanearCarro en app.js). QR del carro (placa) -> cruce con
// parque_automotor -> debe coincidir con el carro esperado -> QR opcional del
// conductor -> elegir tipo (obligatorio) -> marcar lavada.
(() => {
  const modal = document.getElementById('scan-modal');
  const video = document.getElementById('scan-video');
  const frame = document.getElementById('scan-frame');
  const statusEl = document.getElementById('scan-status');
  const resultEl = document.getElementById('scan-result');
  const actionsEl = document.getElementById('scan-actions');
  const closeBtn = document.getElementById('scan-close');

  let contexto = {};

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function abrir(carroEsperado) {
    contexto = { carroEsperado };
    modal.hidden = false;
    iniciarEscaneoCarro();
  }

  function cerrar() {
    QrScanner.detener();
    modal.hidden = true;
    resultEl.hidden = true;
    actionsEl.hidden = true;
    actionsEl.innerHTML = '';
    frame.hidden = false;
    video.hidden = false;
  }

  function mostrarCamara(mensaje, botones) {
    statusEl.textContent = mensaje;
    resultEl.hidden = true;
    frame.hidden = false;
    video.hidden = false;

    actionsEl.innerHTML = '';
    if (botones && botones.length) {
      botones.forEach(({ texto, clase, onClick }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = clase;
        btn.textContent = texto;
        btn.addEventListener('click', onClick);
        actionsEl.appendChild(btn);
      });
      actionsEl.hidden = false;
    } else {
      actionsEl.hidden = true;
    }
  }

  function mostrarResultado(html, botones) {
    QrScanner.detener();
    frame.hidden = true;
    video.hidden = true;
    statusEl.textContent = '';
    resultEl.innerHTML = html;
    resultEl.hidden = false;
    actionsEl.innerHTML = '';
    botones.forEach(({ texto, clase, onClick }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = clase;
      btn.textContent = texto;
      btn.addEventListener('click', onClick);
      actionsEl.appendChild(btn);
    });
    actionsEl.hidden = false;
  }

  function onErrorCamara(mensaje) {
    mostrarResultado(`<p class="scan-msg scan-msg-error">${escapeHtml(mensaje)}</p>`, [
      { texto: 'Cerrar', clase: 'btn-primary', onClick: cerrar },
    ]);
  }

  function iniciarEscaneoCarro() {
    const esperado = contexto.carroEsperado;
    mostrarCamara(`Escanea la placa del móvil ${esperado.numero_interno}`);
    QrScanner.iniciar(video, onDetectarCarro, onErrorCamara);
  }

  function iniciarEscaneoConductor() {
    mostrarCamara('Apunta al QR del conductor (opcional)', [
      { texto: 'Omitir', clase: 'btn-ghost', onClick: omitirConductor },
    ]);
    QrScanner.iniciar(video, onDetectarConductor, onErrorCamara);
  }

  async function onDetectarCarro(textoQr) {
    QrScanner.detener();
    const placa = (textoQr || '').trim();
    const esperado = contexto.carroEsperado;

    if (!placa) {
      mostrarResultado('<p class="scan-msg scan-msg-error">El código QR no trae texto legible.</p>', [
        { texto: 'Reintentar', clase: 'btn-primary', onClick: iniciarEscaneoCarro },
      ]);
      return;
    }

    const { data: filas, error } = await supabaseClient.rpc('buscar_movil_por_placa', { p_placa: placa });
    const parque = filas && filas[0];

    if (error || !parque) {
      mostrarResultado(
        `<p class="scan-msg scan-msg-error">No se encontró la placa <strong>${escapeHtml(placa)}</strong> en el parque automotor.</p>`,
        [{ texto: 'Reintentar', clase: 'btn-primary', onClick: iniciarEscaneoCarro }]
      );
      return;
    }

    if (parque.numero_interno !== esperado.numero_interno) {
      mostrarResultado(
        `<p class="scan-msg scan-msg-error">Esa placa corresponde al móvil <strong>${escapeHtml(parque.numero_interno)}</strong>, no al móvil <strong>${escapeHtml(esperado.numero_interno)}</strong> que ibas a marcar.</p>`,
        [{ texto: 'Reintentar', clase: 'btn-primary', onClick: iniciarEscaneoCarro }]
      );
      return;
    }

    contexto.parque = parque;
    contexto.carro = esperado;
    iniciarEscaneoConductor();
  }

  function onDetectarConductor(textoQr) {
    QrScanner.detener();
    contexto.conductorNombre = (textoQr || '').trim() || null;
    mostrarConfirmacion();
  }

  function omitirConductor() {
    QrScanner.detener();
    contexto.conductorNombre = null;
    mostrarConfirmacion();
  }

  function mostrarConfirmacion() {
    const { parque, carro, conductorNombre } = contexto;
    const actual = lavadasHoyPorCarro.get(carro.id);

    let html = `
      <div class="scan-card">
        <p class="scan-card-num">Móvil ${escapeHtml(carro.numero_interno)}</p>
        <p class="scan-card-sub">Placa ${escapeHtml(parque.placa)}${parque.marca ? ' · ' + escapeHtml(parque.marca) : ''}</p>
        ${conductorNombre ? `<p class="scan-card-cond">Conductor: ${escapeHtml(conductorNombre)}</p>` : ''}
      </div>
    `;

    if (actual) {
      const tipoTexto = actual.tipo === 'sencilla' ? 'Sencilla' : 'Completa';
      html += `<p class="scan-msg">Ya estaba marcada como lavada hoy (${tipoTexto}).</p>`;
      mostrarResultado(html, [{ texto: 'Cerrar', clase: 'btn-primary', onClick: cerrar }]);
      return;
    }

    html += '<p class="scan-msg">¿Qué tipo de lavada?</p>';

    mostrarResultado(html, [
      { texto: 'Sencilla', clase: 'btn-primary', onClick: () => mostrarConfirmacionFinal('sencilla') },
      { texto: 'Completa', clase: 'btn-primary', onClick: () => mostrarConfirmacionFinal('completa') },
    ]);
  }

  // Último paso antes de escribir en la base de datos: muestra un resumen con
  // fecha/hora exactas y exige un toque más de confirmación, para evitar
  // marcar el carro equivocado por error.
  function mostrarConfirmacionFinal(tipo) {
    const { parque, carro, conductorNombre } = contexto;
    const ahora = new Date();
    const fechaTexto = ahora.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    const horaTexto = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const tipoTexto = tipo === 'sencilla' ? 'Sencilla' : 'Completa';

    const html = `
      <div class="scan-card">
        <p class="scan-card-num">Móvil ${escapeHtml(carro.numero_interno)}</p>
        <p class="scan-card-sub">Placa ${escapeHtml(parque.placa)}${parque.marca ? ' · ' + escapeHtml(parque.marca) : ''}</p>
        ${conductorNombre ? `<p class="scan-card-cond">Conductor: ${escapeHtml(conductorNombre)}</p>` : ''}
        <span class="tag-tipo tag-tipo-${tipo} scan-card-tipo-badge">${escapeHtml(tipoTexto)}</span>
        <p class="scan-card-fecha">${escapeHtml(fechaTexto)} · ${escapeHtml(horaTexto)}</p>
      </div>
      <p class="scan-msg scan-msg-confirm">¿Estás seguro que es lavada <strong>${escapeHtml(tipoTexto).toUpperCase()}</strong>?<br>Lee bien antes de confirmar.</p>
    `;

    mostrarResultado(html, [
      { texto: 'Confirmar', clase: 'btn-primary', onClick: () => confirmarLavada(tipo) },
      { texto: 'Cancelar', clase: 'btn-ghost', onClick: mostrarConfirmacion },
    ]);
  }

  async function confirmarLavada(tipo) {
    const { carro, conductorNombre } = contexto;
    const resultado = await marcarTipo(carro, tipo, conductorNombre);

    if (!resultado.ok) {
      // duplicado = se coló otra marca (otra pestaña/dispositivo) justo antes de este toque.
      const mensaje = resultado.duplicado
        ? 'Este carro ya había sido marcado como lavado hoy.'
        : 'No se pudo registrar la lavada.';
      mostrarResultado(`<p class="scan-msg scan-msg-error">${escapeHtml(mensaje)}</p>`, [
        { texto: 'Cerrar', clase: 'btn-primary', onClick: cerrar },
      ]);
      return;
    }

    mostrarResultado(
      `<p class="scan-msg scan-msg-ok">✔ Lavada registrada para el móvil ${escapeHtml(carro.numero_interno)}.</p>`,
      [{ texto: 'Cerrar', clase: 'btn-primary', onClick: cerrar }]
    );
  }

  closeBtn.addEventListener('click', cerrar);

  // Punto de entrada llamado desde app.js al tocar el ícono 📷 de un carro.
  window.escanearCarro = abrir;
})();
