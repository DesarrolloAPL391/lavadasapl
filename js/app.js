// Lógica principal del dashboard (Hoy / Programación / Historial)

const WEEK_DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DAY_LABELS = {
  domingo: 'Domingo', lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado',
};
const DAY_KEY_BY_INDEX = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const IVA = 0.19;
const PRECIOS_BASE = { sencilla: 40000, completa: 110000 };

function precioConIva(tipo) {
  const base = PRECIOS_BASE[tipo];
  return base ? Math.round(base * (1 + IVA)) : 0;
}

function formatoPesos(valor) {
  return valor.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

let carros = []; // { id, numero_interno, dias }
let lavadasHoyPorCarro = new Map(); // carro_id -> { id, tipo }

function localISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayDayKey() {
  return DAY_KEY_BY_INDEX[new Date().getDay()];
}

function mostrarErrorGlobal(mensaje) {
  Toast.mostrar(mensaje, { tipo: 'error' });
}

// --- Autenticación ---

async function protegerPagina() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.replace('login.html');
    return false;
  }
  return true;
}

supabaseClient.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    window.location.replace('login.html');
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.replace('login.html');
});

// --- Tabs ---

const tabIndicator = document.getElementById('tab-indicator');

function moverIndicadorTabs(btn) {
  if (!tabIndicator) return;
  tabIndicator.style.width = `${btn.offsetWidth}px`;
  tabIndicator.style.transform = `translateX(${btn.offsetLeft}px)`;
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    moverIndicadorTabs(btn);

    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

    // El historial puede quedar desactualizado si se marcaron lavadas desde que
    // se cargó la página (o desde otra pestaña/dispositivo); se refresca al entrar.
    if (btn.dataset.tab === 'historial' && historialFechaInput.value) {
      renderHistorial(historialFechaInput.value);
    }
  });
});

const tabInicial = document.querySelector('.tab-btn.active');
if (tabInicial) moverIndicadorTabs(tabInicial);
window.addEventListener('resize', () => {
  const activo = document.querySelector('.tab-btn.active');
  if (activo) moverIndicadorTabs(activo);
});

// --- Carga de datos ---

async function cargarCarros() {
  const { data, error } = await supabaseClient
    .from('carros')
    .select('id, numero_interno, dias')
    .eq('activo', true)
    .order('numero_interno');

  if (error) {
    mostrarErrorGlobal('No se pudo cargar la lista de carros.');
    return [];
  }
  return data;
}

async function cargarLavadasDeFecha(fecha) {
  const { data, error } = await supabaseClient
    .from('lavadas')
    .select('id, carro_id, tipo, created_at, conductor_nombre, carros ( numero_interno )')
    .eq('fecha', fecha)
    .order('created_at', { ascending: true });

  if (error) {
    mostrarErrorGlobal('No se pudo cargar el historial de esa fecha.');
    return [];
  }
  return data;
}

// --- Vista "Hoy" ---

function renderHoyTitulo() {
  const hoy = new Date();
  const dia = DAY_LABELS[todayDayKey()];
  const fechaTexto = hoy.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('fecha-hoy').textContent = `${dia}, ${fechaTexto}`;
  document.getElementById('hoy-titulo').textContent = `Carros de hoy · ${dia}`;
}

function actualizarContadorHoy(totalHoy) {
  const hechos = lavadasHoyPorCarro.size;
  document.getElementById('hoy-contador').textContent = `${hechos} / ${totalHoy}`;
  const pct = totalHoy > 0 ? Math.round((hechos / totalHoy) * 100) : 0;
  document.getElementById('hoy-progress-fill').style.width = `${pct}%`;
}

// Control de lavada de un carro: si no se ha marcado, un ícono de cámara que
// abre el escáner (obligatorio escanear la placa del carro para poder elegir
// Sencilla/Completa); si ya se marcó, una etiqueta con el tipo que al tocarla
// la desmarca. Se usa tanto en "Hoy" como en la columna de hoy de "Programación":
// ambas instancias quedan sincronizadas vía [data-carro-control].
function crearControlLavada(carro) {
  const actual = lavadasHoyPorCarro.get(carro.id);

  if (actual) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tag-tipo tag-tipo-${actual.tipo} tag-tipo-btn`;
    btn.textContent = `✔ ${actual.tipo === 'sencilla' ? 'Sencilla' : 'Completa'}`;
    btn.title = 'Toca para desmarcar';
    btn.addEventListener('click', () => desmarcarLavada(carro));
    return btn;
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'scan-icon-btn';
  btn.setAttribute('aria-label', `Escanear carro ${carro.numero_interno}`);
  btn.textContent = '📷';
  btn.addEventListener('click', () => {
    if (typeof window.escanearCarro === 'function') {
      window.escanearCarro(carro);
    }
  });
  return btn;
}

function montarControlLavada(container, carro) {
  container.dataset.carroControl = carro.id;
  container.innerHTML = '';
  container.appendChild(crearControlLavada(carro));
}

function refrescarControlesLavada(carroId) {
  const carro = carros.find((c) => c.id === carroId);
  if (!carro) return;
  document.querySelectorAll(`[data-carro-control="${carroId}"]`).forEach((container) => {
    montarControlLavada(container, carro);
  });
}

async function desmarcarLavada(carro) {
  const actual = lavadasHoyPorCarro.get(carro.id);
  if (!actual) return;

  const { error } = await supabaseClient.from('lavadas').delete().eq('id', actual.id);
  if (error) {
    mostrarErrorGlobal('No se pudo desmarcar la lavada.');
    return;
  }

  lavadasHoyPorCarro.delete(carro.id);
  renderHoyLista(); // el carro vuelve a la lista de pendientes
  refrescarControlesLavada(carro.id); // sincroniza la columna de hoy en Programación
}

// Registra la lavada de un carro (solo se llama tras un escaneo exitoso, ver scan.js).
// Devuelve { ok: true } o { ok: false, duplicado: bool } (duplicado = ya existía
// una lavada de este carro hoy, ej. por otra pestaña/dispositivo).
async function marcarTipo(carro, tipo, conductorNombre) {
  const fecha = localISODate();

  const { data, error } = await supabaseClient
    .from('lavadas')
    .insert({ carro_id: carro.id, fecha, tipo, conductor_nombre: conductorNombre || null })
    .select('id')
    .single();

  if (error) {
    const duplicado = error.code === '23505'; // unique_violation (carro_id, fecha)
    mostrarErrorGlobal(duplicado ? 'Este carro ya había sido marcado como lavado hoy.' : 'No se pudo marcar la lavada.');
    return { ok: false, duplicado };
  }

  lavadasHoyPorCarro.set(carro.id, { id: data.id, tipo });
  renderHoyLista(); // el carro pasa de pendientes a "ya lavados"
  refrescarControlesLavada(carro.id); // sincroniza la columna de hoy en Programación
  return { ok: true };
}

// Construye las listas de "Hoy" (pendientes / ya lavados) a partir de los datos
// ya cargados en memoria (carros y lavadasHoyPorCarro). No consulta la base de
// datos: se llama tras cada marcar/desmarcar para una respuesta instantánea.
function renderHoyLista() {
  const dia = todayDayKey();
  const listaPendientes = document.getElementById('hoy-lista');
  const vacio = document.getElementById('hoy-vacio');
  const pendientesVacio = document.getElementById('hoy-pendientes-vacio');
  const hechosWrap = document.getElementById('hoy-hechos-wrap');
  const listaHechos = document.getElementById('hoy-lista-hechos');

  listaPendientes.innerHTML = '';
  listaHechos.innerHTML = '';

  const carrosHoy = carros.filter((c) => c.dias.includes(dia));

  if (carrosHoy.length === 0) {
    vacio.hidden = false;
    pendientesVacio.hidden = true;
    hechosWrap.hidden = true;
    actualizarContadorHoy(0);
    return;
  }
  vacio.hidden = true;

  const pendientes = carrosHoy.filter((c) => !lavadasHoyPorCarro.has(c.id));
  const hechos = carrosHoy.filter((c) => lavadasHoyPorCarro.has(c.id));

  // El primer pendiente se destaca aparte en la tarjeta "Siguiente"; el resto
  // de la lista sigue numerado a partir de 2 para mantener claro el orden.
  heroCarroActual = pendientes[0] || null;
  const resto = pendientes.slice(1);

  const heroCard = document.getElementById('hoy-siguiente-card');
  if (heroCarroActual) {
    document.getElementById('hoy-siguiente-placa').textContent = heroCarroActual.numero_interno;
    heroCard.hidden = false;
  } else {
    heroCard.hidden = true;
  }

  pendientesVacio.hidden = pendientes.length > 0;
  resto.forEach((carro, i) => listaPendientes.appendChild(crearFilaCarro(carro, { numero: i + 2 })));

  hechosWrap.hidden = hechos.length === 0;
  hechos.forEach((carro) => listaHechos.appendChild(crearFilaCarro(carro)));

  actualizarContadorHoy(carrosHoy.length);
}

let heroCarroActual = null;
document.getElementById('hoy-siguiente-btn').addEventListener('click', () => {
  if (heroCarroActual && typeof window.escanearCarro === 'function') {
    window.escanearCarro(heroCarroActual);
  }
});

// opciones: { numero } — número de orden mostrado en la fila (el carro #1
// se muestra aparte en la tarjeta "Siguiente", por eso esta lista arranca en 2).
function crearFilaCarro(carro, opciones) {
  const { numero } = opciones || {};

  const li = document.createElement('li');
  li.className = 'car-item';

  if (numero) {
    const orden = document.createElement('span');
    orden.className = 'car-orden';
    orden.textContent = numero;
    li.appendChild(orden);
  }

  const span = document.createElement('span');
  span.className = 'car-placa';
  span.textContent = carro.numero_interno;

  const control = document.createElement('span');
  control.className = 'car-control';
  montarControlLavada(control, carro);

  li.appendChild(span);
  li.appendChild(control);
  return li;
}

async function renderHoy() {
  renderHoyTitulo();
  const lavadasHoy = await cargarLavadasDeFecha(localISODate());
  lavadasHoyPorCarro = new Map(lavadasHoy.map((l) => [l.carro_id, { id: l.id, tipo: l.tipo }]));
  renderHoyLista();
}

// --- Vista "Programación semanal" ---

function renderProgramacion() {
  const grid = document.getElementById('programacion-grid');
  grid.innerHTML = '';
  const hoy = todayDayKey();

  WEEK_DAYS.forEach((dia) => {
    const esHoy = dia === hoy;
    const col = document.createElement('div');
    col.className = 'week-col' + (esHoy ? ' week-col-hoy' : '');

    const h3 = document.createElement('h3');
    h3.textContent = DAY_LABELS[dia] + (esHoy ? ' · hoy' : '');
    col.appendChild(h3);

    const carrosDia = carros
      .filter((c) => c.dias.includes(dia))
      .sort((a, b) => a.numero_interno.localeCompare(b.numero_interno));

    if (carrosDia.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty-msg';
      p.textContent = 'Sin carros';
      col.appendChild(p);
    } else if (esHoy) {
      // Columna de hoy: además de listar los carros, deja marcar la lavada
      // (sincronizado con la pestaña "Hoy" vía [data-carro-control]).
      const ul = document.createElement('ul');
      ul.className = 'week-col-list week-col-list-hoy';
      carrosDia.forEach((carro) => {
        const li = document.createElement('li');
        li.className = 'week-col-item';
        const span = document.createElement('span');
        span.textContent = carro.numero_interno;
        const control = document.createElement('span');
        control.className = 'car-control';
        montarControlLavada(control, carro);
        li.appendChild(span);
        li.appendChild(control);
        ul.appendChild(li);
      });
      col.appendChild(ul);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'week-col-list';
      carrosDia.forEach((carro) => {
        const li = document.createElement('li');
        li.textContent = carro.numero_interno;
        ul.appendChild(li);
      });
      col.appendChild(ul);
    }

    grid.appendChild(col);
  });
}

// --- Vista "Historial" ---

async function renderHistorial(fecha) {
  const lista = document.getElementById('historial-lista');
  const vacio = document.getElementById('historial-vacio');
  const totalEl = document.getElementById('historial-total');
  lista.innerHTML = '';

  const lavadas = await cargarLavadasDeFecha(fecha);

  if (lavadas.length === 0) {
    vacio.hidden = false;
    totalEl.hidden = true;
    return;
  }
  vacio.hidden = true;

  let total = 0;

  lavadas.forEach((l) => {
    const precio = precioConIva(l.tipo);
    total += precio;

    const li = document.createElement('li');
    li.className = 'car-item';

    const info = document.createElement('span');
    info.className = 'car-info';
    const span = document.createElement('span');
    span.className = 'car-placa';
    span.textContent = l.carros ? l.carros.numero_interno : '(carro eliminado)';
    info.appendChild(span);

    if (l.tipo) {
      const tipo = document.createElement('span');
      tipo.className = `tag-tipo tag-tipo-${l.tipo}`;
      tipo.textContent = l.tipo === 'sencilla' ? 'Sencilla' : 'Completa';
      info.appendChild(tipo);
    }

    if (l.conductor_nombre) {
      const cond = document.createElement('span');
      cond.className = 'car-conductor';
      cond.textContent = l.conductor_nombre;
      info.appendChild(cond);
    }

    const right = document.createElement('span');
    right.className = 'car-right';

    const hora = document.createElement('span');
    hora.className = 'car-hora';
    hora.textContent = new Date(l.created_at).toLocaleTimeString('es-CO', {
      hour: '2-digit', minute: '2-digit',
    });
    right.appendChild(hora);

    if (precio > 0) {
      const precioEl = document.createElement('span');
      precioEl.className = 'car-precio';
      precioEl.textContent = formatoPesos(precio);
      right.appendChild(precioEl);
    }

    li.appendChild(info);
    li.appendChild(right);
    lista.appendChild(li);
  });

  totalEl.textContent = `Total del día (IVA incluido): ${formatoPesos(total)} · ${lavadas.length} lavada${lavadas.length === 1 ? '' : 's'}`;
  totalEl.hidden = false;
}

const historialFechaInput = document.getElementById('historial-fecha');
historialFechaInput.addEventListener('change', () => {
  if (historialFechaInput.value) {
    renderHistorial(historialFechaInput.value);
  }
});

// --- Inicio ---

async function init() {
  const autenticado = await protegerPagina();
  if (!autenticado) return;

  carros = await cargarCarros();

  historialFechaInput.value = localISODate();

  await renderHoy();
  renderProgramacion();
  await renderHistorial(localISODate());
}

init();
