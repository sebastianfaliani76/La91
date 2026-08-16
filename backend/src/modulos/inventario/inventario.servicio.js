import { baseDatos } from '../../configuracion/base-datos.js';

export async function listarUbicaciones() {
  const [filas] = await baseDatos.query(
    `SELECT id, codigo, nombre, tipo FROM ubicaciones_stock
     WHERE esta_activa = TRUE ORDER BY nombre`,
  );
  return filas;
}

export async function listarStock(consulta) {
  const condiciones = ['p.esta_activo = TRUE'];
  const parametros = [];
  if (consulta.buscar) {
    condiciones.push(`(p.nombre LIKE ? OR EXISTS (
      SELECT 1 FROM productos_codigos_barra pcb
      WHERE pcb.producto_id = p.id AND pcb.codigo_barra LIKE ?))`);
    const patron = `%${consulta.buscar}%`;
    parametros.push(patron, patron);
  }
  if (consulta.solo_bajo_minimo) {
    condiciones.push('p.stock_minimo > 0 AND COALESCE(e.cantidad, 0) < p.stock_minimo');
  }
  if (consulta.categoria_id) {
    condiciones.push('p.categoria_id = ?');
    parametros.push(consulta.categoria_id);
  }
  if (consulta.marca_id) {
    condiciones.push('p.marca_id = ?');
    parametros.push(consulta.marca_id);
  }
  const desplazamiento = (consulta.pagina - 1) * consulta.limite;
  const desde = `FROM productos p
    CROSS JOIN ubicaciones_stock u
    LEFT JOIN existencias e ON e.producto_id = p.id AND e.ubicacion_id = u.id
    WHERE u.codigo = 'LOCAL_PRINCIPAL' AND ${condiciones.join(' AND ')}`;
  const [[datos], [conteo]] = await Promise.all([
    baseDatos.query(
      `SELECT p.id AS producto_id, u.id AS ubicacion_id, p.nombre, p.imagen_url,
       p.stock_minimo, p.es_pesable, COALESCE(e.cantidad, 0) AS cantidad,
       COALESCE(e.cantidad_reservada, 0) AS cantidad_reservada,
       (SELECT pcb.codigo_barra FROM productos_codigos_barra pcb
        WHERE pcb.producto_id = p.id ORDER BY pcb.es_principal DESC, pcb.id LIMIT 1) AS codigo_barra
       ${desde} ORDER BY p.nombre LIMIT ? OFFSET ?`,
      [...parametros, consulta.limite, desplazamiento],
    ),
    baseDatos.query(`SELECT COUNT(*) AS total ${desde}`, parametros),
  ]);
  return { datos, total: conteo[0].total, pagina: consulta.pagina, limite: consulta.limite };
}

export async function listarMovimientos(consulta) {
  const condiciones = [];
  const parametros = [];
  if (consulta.buscar) {
    const patron = `%${consulta.buscar}%`;
    condiciones.push(`(p.nombre LIKE ? OR pcb.codigo_barra LIKE ? OR ms.motivo LIKE ?
      OR us.nombre_usuario LIKE ? OR ms.referencia_tipo LIKE ?
      OR CAST(ms.referencia_id AS CHAR) LIKE ?)`);
    parametros.push(patron, patron, patron, patron, patron, patron);
  }
  if (consulta.tipo) {
    condiciones.push('ms.tipo = ?');
    parametros.push(consulta.tipo);
  }
  if (consulta.sentido === 'entradas') condiciones.push('msd.variacion > 0');
  if (consulta.sentido === 'salidas') condiciones.push('msd.variacion < 0');
  if (consulta.fecha_desde) {
    condiciones.push('ms.fecha_creacion >= ?');
    parametros.push(consulta.fecha_desde);
  }
  if (consulta.fecha_hasta) {
    condiciones.push('ms.fecha_creacion < DATE_ADD(?, INTERVAL 1 DAY)');
    parametros.push(consulta.fecha_hasta);
  }
  const desde = `FROM movimientos_stock_detalles msd
    JOIN movimientos_stock ms ON ms.id = msd.movimiento_stock_id
    JOIN productos p ON p.id = msd.producto_id
    JOIN usuarios us ON us.id = ms.usuario_id
    JOIN ubicaciones_stock ub ON ub.id = ms.ubicacion_id
    LEFT JOIN productos_codigos_barra pcb
      ON pcb.producto_id = p.id AND pcb.es_principal = TRUE
    ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}`;
  const desplazamiento = (consulta.pagina - 1) * consulta.limite;
  const [[datos], [conteo], [tipos]] = await Promise.all([
    baseDatos.query(
      `SELECT msd.id, ms.id AS movimiento_id, ms.fecha_creacion, ms.tipo, ms.motivo,
       ms.referencia_tipo, ms.referencia_id,
       us.nombre_usuario, p.id AS producto_id, p.nombre AS producto,
       pcb.codigo_barra, msd.cantidad_anterior, msd.variacion,
       msd.cantidad_nueva, msd.costo_unitario, ub.nombre AS ubicacion
       ${desde}
       ORDER BY ms.fecha_creacion DESC, msd.id DESC LIMIT ? OFFSET ?`,
      [...parametros, consulta.limite, desplazamiento],
    ),
    baseDatos.query(`SELECT COUNT(*) AS total ${desde}`, parametros),
    baseDatos.query('SELECT DISTINCT tipo FROM movimientos_stock ORDER BY tipo'),
  ]);
  return {
    datos,
    total: conteo[0].total,
    tipos: tipos.map((fila) => fila.tipo),
    pagina: consulta.pagina,
    limite: consulta.limite,
  };
}

export async function ajustarStock(datos, usuarioId) {
  const conexion = await baseDatos.getConnection();
  try {
    await conexion.beginTransaction();
    const [[producto]] = await conexion.query(
      `SELECT precio_costo, es_pesable FROM productos WHERE id = ?`,
      [datos.producto_id],
    );
    if (!producto) throw new Error('No se encontró el producto');
    const permiteDecimales = Boolean(producto.es_pesable);
    if (!permiteDecimales && !Number.isInteger(datos.cantidad_nueva)) {
      const error = new Error('La cantidad debe ser un número entero');
      error.codigoPublico = 'CANTIDAD_ENTERA';
      throw error;
    }
    await conexion.query(
      `INSERT IGNORE INTO existencias (producto_id, ubicacion_id, cantidad)
       VALUES (?, ?, 0)`,
      [datos.producto_id, datos.ubicacion_id],
    );
    const [existencias] = await conexion.query(
      `SELECT cantidad FROM existencias
       WHERE producto_id = ? AND ubicacion_id = ? FOR UPDATE`,
      [datos.producto_id, datos.ubicacion_id],
    );
    if (!existencias[0]) throw new Error('No se encontró la existencia');
    const cantidadAnterior = Number(existencias[0].cantidad);
    const variacion = datos.cantidad_nueva - cantidadAnterior;
    if (variacion === 0) {
      const error = new Error('La cantidad nueva es igual a la actual');
      error.codigoPublico = 'SIN_CAMBIOS';
      throw error;
    }
    const [movimiento] = await conexion.query(
      `INSERT INTO movimientos_stock (ubicacion_id, usuario_id, tipo, motivo)
       VALUES (?, ?, 'ajuste_manual', ?)`,
      [datos.ubicacion_id, usuarioId, datos.motivo],
    );
    await conexion.query(
      `INSERT INTO movimientos_stock_detalles
       (movimiento_stock_id, producto_id, cantidad_anterior, variacion,
        cantidad_nueva, costo_unitario) VALUES (?, ?, ?, ?, ?, ?)`,
      [movimiento.insertId, datos.producto_id, cantidadAnterior, variacion,
        datos.cantidad_nueva, producto.precio_costo],
    );
    await conexion.query(
      `UPDATE existencias SET cantidad = ?
       WHERE producto_id = ? AND ubicacion_id = ?`,
      [datos.cantidad_nueva, datos.producto_id, datos.ubicacion_id],
    );
    await conexion.commit();
    return { movimiento_id: movimiento.insertId, cantidad_anterior: cantidadAnterior,
      variacion, cantidad_nueva: datos.cantidad_nueva };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

export async function ajustarStockMasivo(datos, usuarioId) {
  const conexion = await baseDatos.getConnection();
  try {
    await conexion.beginTransaction();
    const detalles = [];
    for (const ajuste of datos.ajustes) {
      const [[producto]] = await conexion.query(
        'SELECT precio_costo, es_pesable FROM productos WHERE id = ? AND esta_activo = TRUE',
        [ajuste.producto_id],
      );
      if (!producto) throw new Error('No se encontró uno de los productos');
      if (!producto.es_pesable && !Number.isInteger(ajuste.cantidad_nueva)) {
        const error = new Error('Las cantidades de productos no pesables deben ser enteras');
        error.codigoPublico = 'CANTIDAD_ENTERA';
        throw error;
      }
      await conexion.query(
        `INSERT IGNORE INTO existencias (producto_id, ubicacion_id, cantidad)
         VALUES (?, ?, 0)`,
        [ajuste.producto_id, datos.ubicacion_id],
      );
      const [[existencia]] = await conexion.query(
        `SELECT cantidad FROM existencias
         WHERE producto_id = ? AND ubicacion_id = ? FOR UPDATE`,
        [ajuste.producto_id, datos.ubicacion_id],
      );
      const cantidadAnterior = Number(existencia.cantidad);
      const variacion = ajuste.cantidad_nueva - cantidadAnterior;
      if (variacion !== 0) detalles.push({ ...ajuste, cantidadAnterior, variacion,
        costoUnitario: producto.precio_costo });
    }
    if (!detalles.length) {
      const error = new Error('No hay cantidades modificadas');
      error.codigoPublico = 'SIN_CAMBIOS';
      throw error;
    }
    const [movimiento] = await conexion.query(
      `INSERT INTO movimientos_stock (ubicacion_id, usuario_id, tipo, motivo)
       VALUES (?, ?, 'conteo_fisico', ?)`,
      [datos.ubicacion_id, usuarioId, datos.motivo],
    );
    for (const detalle of detalles) {
      await conexion.query(
        `INSERT INTO movimientos_stock_detalles
         (movimiento_stock_id, producto_id, cantidad_anterior, variacion,
          cantidad_nueva, costo_unitario) VALUES (?, ?, ?, ?, ?, ?)`,
        [movimiento.insertId, detalle.producto_id, detalle.cantidadAnterior,
          detalle.variacion, detalle.cantidad_nueva, detalle.costoUnitario],
      );
      await conexion.query(
        `UPDATE existencias SET cantidad = ?
         WHERE producto_id = ? AND ubicacion_id = ?`,
        [detalle.cantidad_nueva, detalle.producto_id, datos.ubicacion_id],
      );
    }
    await conexion.commit();
    return { movimiento_id: movimiento.insertId, productos_actualizados: detalles.length };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}
