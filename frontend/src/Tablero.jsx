import { useCallback, useEffect, useState } from 'react';
import { formatearFechaHora } from './utilidades/fechas.js';
import { useActualizacionAutomatica } from './hooks/useActualizacionAutomatica.js';

const moneda = (valor) =>
  Number(valor).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

export function Tablero({ token, permisos, alNavegar }) {
  const [datos, setDatos] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const cargar = useCallback(async () => {
    try {
      const respuesta = await fetch('/api/tablero', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const contenido = await respuesta.json();
      if (!respuesta.ok) throw new Error(contenido.mensaje);
      setDatos(contenido.dato);
      setMensaje('');
    } catch (error) {
      setMensaje(error.message || 'No se pudo cargar el inicio');
    }
  }, [token]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useActualizacionAutomatica(cargar);
  if (!datos)
    return (
      <section className="modulo">
        <p>{mensaje || 'Cargando resumen…'}</p>
      </section>
    );
  return (
    <section className="modulo tablero">
      <div className="modulo__encabezado">
        <div>
          <p className="etiqueta">RESUMEN OPERATIVO</p>
          <h2>Inicio</h2>
        </div>
        <button className="boton boton--secundario" onClick={cargar}>
          Actualizar
        </button>
      </div>
      {mensaje && <p className="mensaje">{mensaje}</p>}
      <div className="tarjetas-tablero">
        <article>
          <span>Ventas de hoy</span>
          <strong>{moneda(datos.ventas_hoy.total)}</strong>
          <small>{datos.ventas_hoy.operaciones} operaciones</small>
        </article>
        <article>
          <span>Productos activos</span>
          <strong>{datos.inventario.productos.toLocaleString('es-AR')}</strong>
          <small>Valor al costo {moneda(datos.inventario.valor_costo)}</small>
        </article>
        <article
          className={datos.inventario.bajo_minimo ? 'tarjeta-alerta' : ''}
        >
          <span>Bajo el mínimo</span>
          <strong>
            {datos.inventario.bajo_minimo.toLocaleString('es-AR')}
          </strong>
          <button onClick={() => alNavegar('inventario')}>
            Ver inventario
          </button>
        </article>
        <article>
          <span>Compras pendientes</span>
          <strong>{datos.compras.pendientes}</strong>
          <small>{datos.compras.demoradas} demoradas</small>
        </article>
      <article>
        <span>Cajas abiertas</span>
          <strong>{datos.cajas_abiertas}</strong>
          <button onClick={() => alNavegar('ventas')}>Ir a cajas</button>
      </article>
      {permisos.includes('cuentas_clientes.ver') && <article className={datos.cuentas_clientes.vencido ? 'tarjeta-alerta' : ''}><span>Cuentas por cobrar</span><strong>{moneda(datos.cuentas_clientes.saldo)}</strong><small>Vencido {moneda(datos.cuentas_clientes.vencido)}</small><button onClick={() => alNavegar('clientes')}>Ver clientes</button></article>}
      {permisos.includes('cuentas_proveedores.ver') && <article className={datos.cuentas_proveedores.vencido ? 'tarjeta-alerta' : ''}><span>Cuentas por pagar</span><strong>{moneda(datos.cuentas_proveedores.saldo)}</strong><small>Vencido {moneda(datos.cuentas_proveedores.vencido)}</small><button onClick={() => alNavegar('proveedores')}>Ver proveedores</button></article>}
      {permisos.includes('gastos.ver') && <article className={datos.gastos.vencido ? 'tarjeta-alerta' : ''}><span>Gastos pendientes</span><strong>{moneda(datos.gastos.saldo)}</strong><small>Vencido {moneda(datos.gastos.vencido)} · {datos.gastos.proximos} próximos</small><button onClick={() => alNavegar('gastos')}>Ver gastos</button></article>}
      {permisos.includes('empleados.ver') && <article><span>Sueldos pendientes</span><strong>{moneda(datos.sueldos.saldo)}</strong><small>{datos.sueldos.liquidaciones} liquidaciones</small><button onClick={() => alNavegar('empleados')}>Ver empleados</button></article>}
      </div>
      <div className="rejilla-tablero">
        <article className="panel">
          <div className="panel__encabezado">
            <h3>Últimas ventas</h3>
            {permisos.includes('ventas.crear') && (
              <button
                className="boton-tabla"
                onClick={() => alNavegar('ventas')}
              >
                Ver ventas
              </button>
            )}
          </div>
          {datos.ultimas_ventas.length ? (
            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Venta</th>
                    <th>Caja</th>
                    <th>Usuario</th>
                    <th>Fecha</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.ultimas_ventas.map((venta) => (
                    <tr key={venta.id}>
                      <td>#{venta.id}</td>
                      <td>{venta.caja}</td>
                      <td>{venta.nombre_usuario}</td>
                      <td>
                        {formatearFechaHora(venta.fecha_creacion)}
                      </td>
                      <td>{moneda(venta.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="vacio">Todavía no hay ventas registradas.</p>
          )}
        </article>
        <article className="panel accesos-rapidos">
          <h3>Accesos rápidos</h3>
          {permisos.includes('ventas.crear') && (
            <button onClick={() => alNavegar('ventas')}>Nueva venta</button>
          )}
          {permisos.includes('compras.ver') && (
            <button onClick={() => alNavegar('compras')}>
              Órdenes de compra
            </button>
          )}
          {permisos.includes('gastos.ver') && <button onClick={() => alNavegar('gastos')}>Gastos y servicios</button>}
          <button onClick={() => alNavegar('catalogo')}>Buscar producto</button>
          <button onClick={() => alNavegar('inventario')}>
            Controlar existencias
          </button>
        </article>
      </div>
    </section>
  );
}
