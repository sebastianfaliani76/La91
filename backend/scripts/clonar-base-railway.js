import { closeSync, openSync } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import mysql from 'mysql2/promise';

import { entorno } from '../src/configuracion/entorno.js';
import {
  argumentosConexion,
  ejecutar,
  encontrarEjecutable,
  nombreFecha,
} from './utilidades-respaldo.js';

const urlDestino = process.env.RAILWAY_MYSQL_PUBLIC_URL;
const confirmacion = process.argv.find((valor) =>
  valor.startsWith('--confirmar='),
);

if (!urlDestino) {
  console.error('Falta la variable temporal RAILWAY_MYSQL_PUBLIC_URL.');
  process.exit(1);
}

let destino;
try {
  const url = new URL(urlDestino);
  if (!['mysql:', 'mysql2:'].includes(url.protocol)) throw new Error();
  destino = {
    host: url.hostname,
    puerto: Number(url.port || 3306),
    nombre: decodeURIComponent(url.pathname.replace(/^\//, '')),
    usuario: decodeURIComponent(url.username),
    clave: decodeURIComponent(url.password),
  };
} catch {
  console.error('RAILWAY_MYSQL_PUBLIC_URL no es una URL válida de MySQL.');
  process.exit(1);
}

if (
  !destino.nombre ||
  ['localhost', '127.0.0.1', '::1'].includes(destino.host) ||
  confirmacion?.slice('--confirmar='.length) !== destino.nombre
) {
  console.error(
    `Para autorizar la sustitución remota repetí el comando con --confirmar=${destino.nombre}`,
  );
  process.exit(1);
}

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const directorio = resolve(raiz, 'base_datos/respaldos');
const marca = nombreFecha();
const respaldoLocal = resolve(
  directorio,
  `${entorno.baseDatos.nombre}_antes_de_railway_${marca}.sql`,
);
const respaldoRemoto = resolve(
  directorio,
  `${destino.nombre}_railway_antes_${marca}.sql`,
);

await mkdir(directorio, { recursive: true });
const utilidadDump = await encontrarEjecutable('dump');
const utilidadCliente = await encontrarEjecutable('cliente');

async function respaldar(configuracion, archivo) {
  const salida = openSync(archivo, 'wx');
  try {
    await ejecutar(
      utilidadDump,
      [
        ...argumentosConexion(configuracion),
        '--single-transaction',
        '--routines',
        '--triggers',
        '--events',
        '--hex-blob',
        '--add-drop-table',
        configuracion.nombre,
      ],
      { clave: configuracion.clave, stdio: ['ignore', salida, 'pipe'] },
    );
  } catch (error) {
    await unlink(archivo).catch(() => {});
    throw error;
  } finally {
    closeSync(salida);
  }
  if ((await stat(archivo)).size < 100) {
    await unlink(archivo).catch(() => {});
    throw new Error(`El respaldo ${archivo} quedó vacío.`);
  }
}

console.log('Creando respaldo de seguridad de la base local...');
await respaldar(entorno.baseDatos, respaldoLocal);
console.log(`Respaldo local: ${respaldoLocal}`);

console.log('Creando respaldo de seguridad de la base actual en Railway...');
await respaldar(destino, respaldoRemoto);
console.log(`Respaldo previo de Railway: ${respaldoRemoto}`);

console.log(`Clonando la base local sobre Railway (${destino.nombre})...`);
const entrada = openSync(respaldoLocal, 'r');
try {
  await ejecutar(
    utilidadCliente,
    [...argumentosConexion(destino), destino.nombre],
    { clave: destino.clave, stdio: [entrada, 'ignore', 'pipe'] },
  );
} finally {
  closeSync(entrada);
}

const conexion = await mysql.createConnection({
  host: destino.host,
  port: destino.puerto,
  database: destino.nombre,
  user: destino.usuario,
  password: destino.clave,
});
try {
  const [[tablas], [usuarios], [productos]] = await Promise.all([
    conexion.query(
      'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ?',
      [destino.nombre],
    ),
    conexion.query('SELECT COUNT(*) AS total FROM usuarios'),
    conexion.query('SELECT COUNT(*) AS total FROM productos'),
  ]);
  console.log(
    `Clonación verificada: ${tablas[0].total} tablas, ${usuarios[0].total} usuarios y ${productos[0].total} productos.`,
  );
} finally {
  await conexion.end();
}
