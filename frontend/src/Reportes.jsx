import { useCallback, useEffect, useState } from 'react';
import { formatearFecha } from './utilidades/fechas.js';
import { useActualizacionAutomatica } from './hooks/useActualizacionAutomatica.js';

const moneda = (valor) =>
  Number(valor).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const fechaLocal = (fecha) => {
  const copia = new Date(fecha);
  copia.setMinutes(copia.getMinutes() - copia.getTimezoneOffset());
  return copia.toISOString().slice(0, 10);
};

export function Reportes({ token }) {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const [desde, setDesde] = useState(fechaLocal(inicio));
  const [hasta, setHasta] = useState(fechaLocal(hoy));
  const [datos, setDatos] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const cargar = useCallback(async () => {
    try {
      const respuesta = await fetch(
        `/api/reportes/ventas?fecha_desde=${desde}&fecha_hasta=${hasta}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const contenido = await respuesta.json();
      if (!respuesta.ok) throw new Error(contenido.mensaje);
      setDatos(contenido.dato);
      setMensaje('');
    } catch (error) {
      setMensaje(error.message || 'No se pudo generar el reporte');
    }
  }, [token, desde, hasta]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useActualizacionAutomatica(cargar, true, 30000);
  return (
    <section className="modulo">
      <div className="modulo__encabezado">
        <div>
          <p className="etiqueta">ANÁLISIS COMERCIAL</p>
          <h2>Reportes</h2>
        </div>
      </div>
      <div className="barra-filtros">
        <div>
          <label>Desde</label>
          <input
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div>
          <label>Hasta</label>
          <input
            type="date"
            value={hasta}
            min={desde}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
      </div>
      {mensaje && <p className="mensaje">{mensaje}</p>}
      {datos && (
        <>
          <div className="grupos-resumen-reporte">
            <article className="panel resumen-reporte resumen-reporte--ancho">
              <h3>Ventas del período</h3>
              <div className="tarjetas-resumen tarjetas-reporte">
                <div><span>Ventas</span><strong>{moneda(datos.resumen.ventas)}</strong></div>
                <div><span>Operaciones</span><strong>{datos.resumen.operaciones}</strong></div>
                <div><span>Ticket promedio</span><strong>{moneda(datos.resumen.ticket_promedio)}</strong></div>
                <div><span>Costo</span><strong>{moneda(datos.resumen.costo)}</strong></div>
                <div><span>Margen bruto</span><strong>{moneda(datos.resumen.margen)}</strong></div>
                <div><span>Crédito otorgado</span><strong>{moneda(datos.resumen.credito_otorgado)}</strong></div>
              </div>
            </article>
            <article className="panel resumen-reporte">
              <h3>Personal del período</h3>
              <div className="tarjetas-resumen tarjetas-reporte">
                <div><span>Sueldos pagados</span><strong>{moneda(datos.resumen.sueldos_pagados)}</strong></div>
                <div><span>Adelantos pagados</span><strong>{moneda(datos.resumen.adelantos_pagados)}</strong></div>
                <div><span>Total pagado</span><strong>{moneda(datos.resumen.total_personal_pagado)}</strong></div>
              </div>
            </article>
            <article className="panel resumen-reporte">
              <h3>Gastos del período</h3>
              <div className="tarjetas-resumen tarjetas-reporte">
                <div><span>Gastos pagados</span><strong>{moneda(datos.resumen.gastos_pagados)}</strong></div>
              </div>
            </article>
            <article className="panel resumen-reporte resumen-reporte--ancho">
              <h3>Situación actual</h3>
              <div className="tarjetas-resumen tarjetas-reporte">
                <div><span>Cuentas por cobrar</span><strong>{moneda(datos.resumen.cuentas_por_cobrar)}</strong></div>
                <div><span>Deuda vencida</span><strong>{moneda(datos.resumen.deuda_vencida)}</strong></div>
                <div><span>Cuentas por pagar</span><strong>{moneda(datos.resumen.cuentas_por_pagar)}</strong></div>
                <div><span>Proveedores vencido</span><strong>{moneda(datos.resumen.proveedores_vencido)}</strong></div>
                <div><span>Gastos pendientes</span><strong>{moneda(datos.resumen.gastos_pendientes)}</strong></div>
                <div><span>Gastos vencidos</span><strong>{moneda(datos.resumen.gastos_vencidos)}</strong></div>
                <div><span>Sueldos pendientes</span><strong>{moneda(datos.resumen.sueldos_pendientes)}</strong></div>
              </div>
            </article>
          </div>
          <div className="rejilla-reportes">
            <article className="panel">
              <h3>Productos más vendidos</h3>
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Unidades</th>
                      <th>Ventas</th>
                      <th>Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.productos.map((item) => (
                      <tr key={item.nombre}>
                        <td>{item.nombre}</td>
                        <td>{Number(item.cantidad).toLocaleString('es-AR')}</td>
                        <td>{moneda(item.ventas)}</td>
                        <td>{moneda(item.margen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
            <article className="panel">
              <h3>Ventas por categoría</h3>
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th>Ventas</th>
                      <th>Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.categorias.map((item) => (
                      <tr key={item.nombre}>
                        <td>{item.nombre}</td>
                        <td>{moneda(item.ventas)}</td>
                        <td>{moneda(item.margen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className="subtitulo-reporte">Medios de pago</h3>
              {datos.medios.map((item) => (
                <div className="fila-reporte" key={item.medio}>
                  <span>{item.medio}</span>
                  <strong>{moneda(item.total)}</strong>
                </div>
              ))}
            </article>
          </div>
          <article className="panel panel-reporte-diario">
            <h3>Evolución diaria</h3>
            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Operaciones</th>
                    <th>Ventas</th>
                    <th>Margen bruto</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.por_dia.map((item) => (
                    <tr key={item.fecha}>
                      <td>
                        {formatearFecha(item.fecha)}
                      </td>
                      <td>{item.operaciones}</td>
                      <td>{moneda(item.ventas)}</td>
                      <td>
                        {moneda(Number(item.ventas) - Number(item.costo))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}
    </section>
  );
}
