import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { comprobarBaseDatos } from './configuracion/base-datos.js';
import { entorno } from './configuracion/entorno.js';
import { rutasAutenticacion } from './modulos/seguridad/autenticacion.rutas.js';
import { rutasCatalogo } from './modulos/catalogo/catalogo.rutas.js';
import { rutasInventario } from './modulos/inventario/inventario.rutas.js';
import { rutasUsuarios } from './modulos/usuarios/usuarios.rutas.js';
import { rutasProveedores } from './modulos/proveedores/proveedores.rutas.js';
import { rutasCompras } from './modulos/compras/compras.rutas.js';
import { rutasVentas } from './modulos/ventas/ventas.rutas.js';
import { rutasTablero } from './modulos/tablero/tablero.rutas.js';
import { rutasReportes } from './modulos/reportes/reportes.rutas.js';
import { rutasClientes } from './modulos/clientes/clientes.rutas.js';
import { rutasGastos } from './modulos/gastos/gastos.rutas.js';
import { rutasEmpleados } from './modulos/empleados/empleados.rutas.js';
import { rutasTesoreria } from './modulos/tesoreria/tesoreria.rutas.js';
import { rutasEcommerce } from './modulos/ecommerce/ecommerce.rutas.js';

export const aplicacion = express();
const carpetaProyecto = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const carpetaFrontend = resolve(carpetaProyecto, 'frontend/dist');

aplicacion.disable('x-powered-by');
aplicacion.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://*.tile.openstreetmap.org',
        ],
        connectSrc: [
          "'self'",
          'https://router.project-osrm.org',
          'https://nominatim.openstreetmap.org',
        ],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  }),
);
aplicacion.use(cors({ origin: entorno.origenFrontend }));
aplicacion.use(express.json({ limit: '1mb' }));
aplicacion.use(
  '/imagenes_productos',
  express.static(resolve(carpetaProyecto, 'storage/imagenes_productos')),
);
aplicacion.use('/api/autenticacion', rutasAutenticacion);
aplicacion.use('/api/catalogo', rutasCatalogo);
aplicacion.use('/api/inventario', rutasInventario);
aplicacion.use('/api/usuarios', rutasUsuarios);
aplicacion.use('/api/proveedores', rutasProveedores);
aplicacion.use('/api/compras', rutasCompras);
aplicacion.use('/api/ventas', rutasVentas);
aplicacion.use('/api/tablero', rutasTablero);
aplicacion.use('/api/reportes', rutasReportes);
aplicacion.use('/api/clientes', rutasClientes);
aplicacion.use('/api/gastos', rutasGastos);
aplicacion.use('/api/empleados', rutasEmpleados);
aplicacion.use('/api/tesoreria', rutasTesoreria);
aplicacion.use('/api/ecommerce', rutasEcommerce);

aplicacion.get('/api/salud', async (_solicitud, respuesta) => {
  try {
    await comprobarBaseDatos();
    respuesta.json({ estado: 'ok', base_datos: 'conectada' });
  } catch {
    respuesta.status(503).json({ estado: 'degradado', base_datos: 'sin_conexion' });
  }
});

if (existsSync(carpetaFrontend)) {
  aplicacion.use(express.static(carpetaFrontend));
  aplicacion.use((solicitud, respuesta, siguiente) => {
    if (solicitud.method !== 'GET' || !solicitud.accepts('html')) {
      siguiente();
      return;
    }
    respuesta.sendFile(resolve(carpetaFrontend, 'index.html'));
  });
}

aplicacion.use((_solicitud, respuesta) => {
  respuesta.status(404).json({ mensaje: 'Ruta no encontrada' });
});

aplicacion.use((error, _solicitud, respuesta, _siguiente) => {
  void _siguiente;
  if (error.code === 'ER_DUP_ENTRY') {
    return respuesta.status(409).json({ mensaje: 'Ya existe un registro con ese código o nombre' });
  }
  console.error(error);
  respuesta.status(500).json({ mensaje: 'Ocurrió un error interno' });
});
