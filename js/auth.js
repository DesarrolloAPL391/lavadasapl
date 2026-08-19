// Lógica de la pantalla de login
const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorBox = document.getElementById('login-error');
const submitBtn = document.getElementById('login-submit');

function mostrarError(mensaje) {
  errorBox.textContent = mensaje;
  errorBox.hidden = false;
}

function ocultarError() {
  errorBox.hidden = true;
  errorBox.textContent = '';
}

async function redirigirSiYaHaySesion() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    window.location.replace('index.html');
  }
}

redirigirSiYaHaySesion();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  ocultarError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    mostrarError('Ingresa correo y contraseña.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Ingresando...';

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Ingresar';

  if (error) {
    mostrarError('Correo o contraseña incorrectos.');
    return;
  }

  // Este proyecto de Supabase es compartido con el sistema de despachos, que
  // implementa "sesión única" vía la función registrar_sesion() + una política
  // RESTRICTIVE que puede llegar a aplicarse a estas tablas en el futuro. Se
  // llama aquí para que esta app quede protegida si eso ocurre. Si la función
  // no existe o falla, se ignora (el builder de supabase-js no es una Promise
  // real, así que no soporta .catch() encadenado; hay que usar try/await).
  try {
    await supabaseClient.rpc('registrar_sesion');
  } catch (e) {
    // no bloquea el login
  }

  window.location.replace('index.html');
});
