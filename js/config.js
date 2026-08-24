// Configuración de conexión a Supabase
const SUPABASE_URL = 'https://ggbyeftqatnahlpunqek.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0F7QGgUjkWBI82qjfutdyQ_wF1e_6Jy';

// Versión de la app: única fuente de verdad para el nombre de caché del
// service worker (sw.js la lee vía importScripts) y para lo que se muestra
// en pantalla. Súbela cada vez que se publique un cambio: eso fuerza a
// todos los dispositivos a bajar los archivos nuevos en su próxima visita.
const APP_VERSION = '1.10.0';
