import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

const rutaEntorno = fileURLToPath(new URL('../../.env', import.meta.url));
config({ path: rutaEntorno });

export const entorno = {
  puerto: Number(process.env.PORT ?? process.env.PUERTO ?? 3000),
  origenFrontend:
    process.env.ORIGEN_FRONTEND ??
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'http://localhost:5173'),
  baseDatos: {
    host: process.env.BD_HOST ?? process.env.MYSQLHOST ?? '127.0.0.1',
    puerto: Number(process.env.BD_PUERTO ?? process.env.MYSQLPORT ?? 3306),
    nombre:
      process.env.BD_NOMBRE ?? process.env.MYSQLDATABASE ?? 'supermercado',
    usuario:
      process.env.BD_USUARIO ?? process.env.MYSQLUSER ?? 'supermercado_app',
    clave: process.env.BD_CLAVE ?? process.env.MYSQLPASSWORD ?? '',
  },
  jwt: {
    secreto: process.env.JWT_SECRETO ?? '',
    duracion: process.env.JWT_DURACION ?? '8h',
  },
};
