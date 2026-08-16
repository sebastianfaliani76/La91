import { useCallback, useEffect, useState } from 'react';
import { useActualizacionAutomatica } from './hooks/useActualizacionAutomatica.js';
import { Modal } from './componentes/Modal.jsx';
import { fechaParaInput, formatearFecha, formatearFechaHora } from './utilidades/fechas.js';
const moneda = (v) => Number(v).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const hoy = fechaParaInput;
const claseEstadoLiquidacion = (estado) => `estado-liquidacion estado-liquidacion--${estado}`;
async function api(url, token, opt = {}) {
  const r = await fetch(url, {
    ...opt,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opt.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.mensaje || 'No se pudo completar');
  return d;
}

const escaparHtml = (valor) =>
  String(valor ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function imprimirComprobanteLaboral({ titulo, numero, empleado, fecha, estado, conceptos, observaciones }) {
  const ventana = window.open('', '_blank', 'width=900,height=700');
  if (!ventana) return;
  const filas = conceptos.map(([concepto, importe]) => `<tr><td>${escaparHtml(concepto)}</td><td>${escaparHtml(importe)}</td></tr>`).join('');
  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escaparHtml(titulo)} #${numero}</title><style>
    @page{size:A4;margin:18mm}*{box-sizing:border-box}body{margin:0;color:#003b46;font:12pt Arial,sans-serif}.cabecera{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #07575b;padding-bottom:12px}.cabecera img{width:210px;max-height:70px;object-fit:contain}.cabecera div{text-align:right}h1{margin:22px 0 4px;font-size:20pt}h2{margin:0 0 20px;color:#07575b;font-size:12pt;font-weight:normal}.datos{display:grid;grid-template-columns:1fr 1fr;gap:8px 28px;margin:18px 0;padding:14px;background:#f3f8f9}.datos p{margin:0}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{padding:9px;border-bottom:1px solid #c4dfe6;text-align:left}th:last-child,td:last-child{text-align:right}.observaciones{min-height:55px;margin-top:18px}.firmas{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:85px}.firma{padding-top:8px;border-top:1px solid #003b46;text-align:center}.pie{margin-top:35px;color:#52656a;font-size:9pt;text-align:center}
  </style></head><body><div class="cabecera"><img src="${window.location.origin}/marca/logo-horizontal-claro.png" alt="La 91 Supermercado"><div><strong>Comprobante interno</strong><br>N.º ${numero}</div></div><h1>${escaparHtml(titulo)}</h1><h2>Constancia de pago y recepción</h2><div class="datos"><p><strong>Empleado:</strong> ${escaparHtml(`${empleado.apellidos}, ${empleado.nombres}`)}</p><p><strong>DNI:</strong> ${escaparHtml(empleado.numero_documento || '—')}</p><p><strong>Cargo:</strong> ${escaparHtml(empleado.cargo || '—')}</p><p><strong>Modalidad:</strong> ${escaparHtml(empleado.modalidad_pago || '—')}</p><p><strong>Fecha / período:</strong> ${escaparHtml(fecha)}</p><p><strong>Estado:</strong> ${escaparHtml(estado)}</p></div><table><thead><tr><th>Concepto</th><th>Importe / detalle</th></tr></thead><tbody>${filas}</tbody></table>${observaciones ? `<div class="observaciones"><strong>Observaciones:</strong> ${escaparHtml(observaciones)}</div>` : ''}<div class="firmas"><div class="firma">Firma del empleado<br><small>Aclaración y DNI</small></div><div class="firma">Firma del empleador<br><small>Aclaración</small></div></div><p class="pie">Se emite por duplicado como constancia interna. Una copia corresponde al empleado.</p><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250))</script></body></html>`);
  ventana.document.close();
}
export function Empleados({ token, permisos }) {
  const [datos, setDatos] = useState([]),
    [total, setTotal] = useState(0),
    [resumen, setResumen] = useState({ activos: 0, nomina_base: 0 }),
    [buscar, setBuscar] = useState(''),
    [estado, setEstado] = useState('activos'),
    [modal, setModal] = useState(false),
    [editar, setEditar] = useState(null),
    [detalle, setDetalle] = useState(null),
    [adelanto, setAdelanto] = useState(false),
    [liquidar, setLiquidar] = useState(null),
    [liquidacion, setLiquidacion] = useState(null),
    [pagar, setPagar] = useState(false),
    [mensaje, setMensaje] = useState(''),
    [procesando, setProcesando] = useState(false),
    [cuentas, setCuentas] = useState([]),
    [medioPago, setMedioPago] = useState('transferencia'),
    [origenEfectivo, setOrigenEfectivo] = useState('tesoreria');
  const gestionar = permisos.includes('empleados.gestionar');
  const cargar = useCallback(async () => {
    try {
      const p = new URLSearchParams({ estado, limite: 100 });
      if (buscar) p.set('buscar', buscar);
      const d = await api(`/api/empleados?${p}`, token);
      setDatos(d.datos);
      setTotal(d.total);
      setResumen({ activos: d.activos, nomina_base: d.nomina_base });
    } catch (e) {
      setMensaje(e.message);
    }
  }, [token, buscar, estado]);
  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
  }, [cargar]);
  useActualizacionAutomatica(
    cargar,
    !modal && !editar && !detalle && !adelanto && !liquidar && !liquidacion && !pagar && !procesando,
  );
  useEffect(() => {
    if (!adelanto && !pagar) return;
    setMensaje('');
    setMedioPago('transferencia');
    setOrigenEfectivo('tesoreria');
    api('/api/tesoreria/cuentas', token)
      .then((r) => setCuentas(r.datos))
      .catch((e) => setMensaje(e.message));
  }, [adelanto, pagar, token]);
  async function guardar(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      d = {
        legajo: f.get('legajo') || null,
        numero_documento: f.get('numero_documento') || null,
        nombres: f.get('nombres'),
        apellidos: f.get('apellidos'),
        correo_electronico: f.get('correo_electronico') || null,
        telefono: f.get('telefono') || null,
        direccion: f.get('direccion') || null,
        cargo: f.get('cargo') || null,
        modalidad_pago: f.get('modalidad_pago'),
        sueldo_base: Number(f.get('sueldo_base')),
        cbu_alias: f.get('cbu_alias') || null,
        fecha_ingreso: f.get('fecha_ingreso'),
        fecha_egreso: f.get('fecha_egreso') || null,
        esta_activo: f.get('esta_activo') === 'on',
      };
    setProcesando(true);
    try {
      await api(editar ? `/api/empleados/${editar.id}` : '/api/empleados', token, { method: editar ? 'PUT' : 'POST', body: JSON.stringify(d) });
      setModal(false);
      setEditar(null);
      await cargar();
      setMensaje('Empleado guardado correctamente.');
    } catch (x) {
      setMensaje(x.message);
    } finally {
      setProcesando(false);
    }
  }
  async function abrir(id) {
    try {
      setDetalle((await api(`/api/empleados/${id}`, token)).dato);
    } catch (e) {
      setMensaje(e.message);
    }
  }
  async function crearAdelanto(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      usaCaja = medioPago === 'efectivo' && origenEfectivo === 'caja';
    setProcesando(true);
    try {
      await api(`/api/empleados/${detalle.id}/adelantos`, token, {
        method: 'POST',
        body: JSON.stringify({
          fecha: f.get('fecha'),
          monto: Number(f.get('monto')),
          medio: medioPago,
          origen_efectivo: medioPago === 'efectivo' ? origenEfectivo : null,
          cuenta_tesoreria_id: usaCaja ? null : Number(f.get('cuenta_tesoreria_id')),
          referencia: f.get('referencia') || null,
          observaciones: f.get('observaciones') || null,
        }),
      });
      setAdelanto(false);
      await Promise.all([abrir(detalle.id), cargar()]);
      setMensaje('Adelanto registrado.');
    } catch (x) {
      setMensaje(x.message);
    } finally {
      setProcesando(false);
    }
  }
  async function crearLiquidacion(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      empleadoId = liquidar.id;
    setProcesando(true);
    try {
      const r = await api('/api/empleados/liquidaciones', token, {
        method: 'POST',
        body: JSON.stringify({
          empleado_id: empleadoId,
          periodo_desde: f.get('periodo_desde'),
          periodo_hasta: f.get('periodo_hasta'),
          sueldo_base: Number(f.get('sueldo_base')),
          adicionales: Number(f.get('adicionales') || 0),
          descuentos: Number(f.get('descuentos') || 0),
          aplicar_adelantos: f.get('aplicar_adelantos') === 'on',
          observaciones: f.get('observaciones') || null,
        }),
      });
      setLiquidar(null);
      await Promise.all([abrir(empleadoId), cargar()]);
      setMensaje(`Liquidación #${r.dato.id} creada. Neto ${moneda(r.dato.total_neto)}.`);
    } catch (x) {
      setMensaje(x.message);
    } finally {
      setProcesando(false);
    }
  }
  async function abrirLiquidacion(id) {
    setLiquidacion((await api(`/api/empleados/liquidaciones/${id}`, token)).dato);
  }
  async function pagarSueldo(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      usaCaja = medioPago === 'efectivo' && origenEfectivo === 'caja',
      empleadoId = detalle?.id;
    setProcesando(true);
    try {
      await api(`/api/empleados/liquidaciones/${liquidacion.id}/pagos`, token, {
        method: 'POST',
        body: JSON.stringify({
          monto: Number(f.get('monto')),
          medio: medioPago,
          origen_efectivo: medioPago === 'efectivo' ? origenEfectivo : null,
          cuenta_tesoreria_id: usaCaja ? null : Number(f.get('cuenta_tesoreria_id')),
          referencia: f.get('referencia') || null,
        }),
      });
      setPagar(false);
      await Promise.all([
        abrirLiquidacion(liquidacion.id),
        empleadoId ? abrir(empleadoId) : Promise.resolve(),
        cargar(),
      ]);
      setMensaje('Pago de sueldo registrado.');
    } catch (x) {
      setMensaje(x.message);
    } finally {
      setProcesando(false);
    }
  }
  function imprimirAdelanto(item) {
    imprimirComprobanteLaboral({
      titulo: 'Constancia de adelanto de sueldo',
      numero: item.id,
      empleado: detalle,
      fecha: formatearFecha(item.fecha),
      estado: item.estado,
      conceptos: [
        ['Importe entregado', moneda(item.monto)],
        ['Medio de pago', item.medio],
        ['Origen', item.caja || item.cuenta_tesoreria || 'Sin especificar'],
        ['Referencia', item.referencia || '—'],
        ['Registrado por', item.nombre_usuario],
      ],
      observaciones: item.observaciones,
    });
  }
  function imprimirReciboLiquidacion() {
    const totalPagado = liquidacion.pagos.reduce((suma, pago) => suma + Number(pago.monto), 0);
    imprimirComprobanteLaboral({
      titulo: 'Recibo de liquidación de sueldo',
      numero: liquidacion.id,
      empleado: detalle,
      fecha: `${formatearFecha(liquidacion.periodo_desde)} al ${formatearFecha(liquidacion.periodo_hasta)}`,
      estado: liquidacion.estado,
      conceptos: [
        ['Sueldo base', moneda(liquidacion.sueldo_base)],
        ['Adicionales', moneda(liquidacion.adicionales)],
        ['Otros descuentos', `- ${moneda(liquidacion.descuentos)}`],
        ['Adelantos aplicados', `- ${moneda(liquidacion.adelantos_aplicados)}`],
        ['Neto liquidado', moneda(liquidacion.total_neto)],
        ['Total pagado', moneda(totalPagado)],
        ['Saldo pendiente', moneda(liquidacion.saldo_pendiente)],
        ...liquidacion.pagos.map((pago, indice) => [
          `Pago ${indice + 1} · ${formatearFechaHora(pago.fecha_creacion)}`,
          `${pago.medio} · ${pago.caja || pago.cuenta_tesoreria || 'Sin origen'} · ${moneda(pago.monto)}`,
        ]),
      ],
      observaciones: liquidacion.observaciones,
    });
  }
  const formulario = (base = {}) => (
    <form className="formulario-modal" onSubmit={guardar}>
      <div className="campos-producto">
        <div className="campo">
          <label>Legajo</label>
          <input name="legajo" defaultValue={base.legajo || ''} />
        </div>
        <div className="campo">
          <label>DNI</label>
          <input name="numero_documento" defaultValue={base.numero_documento || ''} />
        </div>
        <div className="campo">
          <label>Nombres</label>
          <input name="nombres" defaultValue={base.nombres || ''} required />
        </div>
        <div className="campo">
          <label>Apellidos</label>
          <input name="apellidos" defaultValue={base.apellidos || ''} required />
        </div>
        <div className="campo">
          <label>Cargo</label>
          <input name="cargo" defaultValue={base.cargo || ''} />
        </div>
        <div className="campo">
          <label>Modalidad</label>
          <select name="modalidad_pago" defaultValue={base.modalidad_pago || 'mensual'}>
            <option value="diaria">Diaria</option>
            <option value="semanal">Semanal</option>
            <option value="quincenal">Quincenal</option>
            <option value="mensual">Mensual</option>
          </select>
        </div>
        <div className="campo">
          <label>Sueldo base por período</label>
          <input name="sueldo_base" type="number" min="0" step="0.01" defaultValue={base.sueldo_base || 0} required />
        </div>
        <div className="campo">
          <label>Fecha de ingreso</label>
          <input name="fecha_ingreso" type="date" defaultValue={String(base.fecha_ingreso || hoy()).slice(0, 10)} required />
        </div>
        <div className="campo">
          <label>Correo</label>
          <input name="correo_electronico" type="email" defaultValue={base.correo_electronico || ''} />
        </div>
        <div className="campo">
          <label>Teléfono</label>
          <input name="telefono" defaultValue={base.telefono || ''} />
        </div>
        <div className="campo">
          <label>CBU o alias</label>
          <input name="cbu_alias" defaultValue={base.cbu_alias || ''} />
        </div>
        <div className="campo">
          <label>Fecha de egreso</label>
          <input name="fecha_egreso" type="date" defaultValue={String(base.fecha_egreso || '').slice(0, 10)} />
        </div>
        <div className="campo campo--ancho">
          <label>Dirección</label>
          <input name="direccion" defaultValue={base.direccion || ''} />
        </div>
        <label className="filtro-verificacion">
          <input name="esta_activo" type="checkbox" defaultChecked={base.esta_activo !== false} /> Activo
        </label>
      </div>
      <div className="modal__acciones">
        <button
          type="button"
          className="boton boton--secundario"
          onClick={() => {
            setModal(false);
            setEditar(null);
          }}
        >
          Cancelar
        </button>
        <button className="boton" disabled={procesando}>
          Guardar
        </button>
      </div>
    </form>
  );
  const usaCuenta = medioPago !== 'efectivo' || origenEfectivo === 'tesoreria';
  const cuentasDisponibles = medioPago === 'efectivo' ? cuentas.filter((c) => c.tipo === 'efectivo') : cuentas;
  return (
    <section className="modulo">
      <div className="modulo__encabezado">
        <div>
          <p className="etiqueta">PERSONAL Y NÓMINA</p>
          <h2>Empleados</h2>
        </div>
        {gestionar && (
          <button className="boton" onClick={() => setModal(true)}>
            Nuevo empleado
          </button>
        )}
      </div>
      <div className="tarjetas-resumen">
        <div>
          <span>Empleados activos</span>
          <strong>{resumen.activos}</strong>
        </div>
        <div>
          <span>Nómina base</span>
          <strong>{moneda(resumen.nomina_base)}</strong>
        </div>
        <div>
          <span>Resultados</span>
          <strong>{total}</strong>
        </div>
      </div>
      <div className="barra-filtros">
        <input placeholder="Buscar empleado, legajo, DNI o cargo" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </select>
      </div>
      {mensaje && <p className="mensaje">{mensaje}</p>}
      <article className="panel">
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Legajo / DNI</th>
                <th>Cargo</th>
                <th>Modalidad</th>
                <th>Sueldo base</th>
                <th>Adelantos</th>
                <th>Saldo sueldo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {datos.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.apellidos}, {e.nombres}
                  </td>
                  <td>
                    {e.legajo || '—'}
                    <small className="dato-secundario">{e.numero_documento || ''}</small>
                  </td>
                  <td>{e.cargo || '—'}</td>
                  <td>{e.modalidad_pago}</td>
                  <td>{moneda(e.sueldo_base)}</td>
                  <td>{moneda(e.adelantos)}</td>
                  <td>{moneda(e.saldo_sueldo)}</td>
                  <td>
                    <div className="acciones-tabla">
                      <button className="boton-tabla" onClick={() => abrir(e.id)}>
                        Ver
                      </button>
                      {gestionar && (
                        <button
                          className="boton-tabla"
                          onClick={() => {
                            setEditar(e);
                            setModal(true);
                          }}
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      <Modal
        abierto={modal}
        titulo={editar ? 'Editar empleado' : 'Nuevo empleado'}
        ancho="grande"
        alCerrar={() => {
          setModal(false);
          setEditar(null);
        }}
      >
        {formulario(editar || {})}
      </Modal>
      <Modal abierto={Boolean(detalle)} titulo={detalle ? `${detalle.apellidos}, ${detalle.nombres}` : 'Empleado'} ancho="grande" alCerrar={() => setDetalle(null)}>
        {detalle && (
          <div>
            <div className="tarjetas-resumen">
              <div>
                <span>Sueldo base</span>
                <strong>{moneda(detalle.sueldo_base)}</strong>
              </div>
              <div>
                <span>Modalidad</span>
                <strong>{detalle.modalidad_pago}</strong>
              </div>
              <div>
                <span>Cargo</span>
                <strong>{detalle.cargo || '—'}</strong>
              </div>
            </div>
            <h3>Liquidaciones</h3>
            {detalle.liquidaciones.length ? (
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th>Base</th>
                      <th>Adelantos</th>
                      <th>Neto</th>
                      <th>Saldo</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.liquidaciones.map((l) => (
                      <tr key={l.id}>
                        <td>
                          {formatearFecha(l.periodo_desde)} al {formatearFecha(l.periodo_hasta)}
                        </td>
                        <td>{moneda(l.sueldo_base)}</td>
                        <td>{moneda(l.adelantos_aplicados)}</td>
                        <td>{moneda(l.total_neto)}</td>
                        <td>{moneda(l.saldo_pendiente)}</td>
                        <td>
                          <span className={claseEstadoLiquidacion(l.estado)}>{l.estado}</span>
                        </td>
                        <td>
                          <button className="boton-tabla" onClick={() => abrirLiquidacion(l.id)}>
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="vacio">Sin liquidaciones.</p>
            )}
            <h3>Adelantos</h3>
            {detalle.adelantos.length ? (
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Medio</th>
                      <th>Importe</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.adelantos.map((a) => (
                      <tr key={a.id}>
                        <td>{formatearFecha(a.fecha)}</td>
                        <td>{a.medio}</td>
                        <td>{moneda(a.monto)}</td>
                        <td>{a.estado}</td>
                        <td>
                          <button className="boton-tabla" onClick={() => imprimirAdelanto(a)}>
                            Imprimir constancia
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="vacio">Sin adelantos.</p>
            )}
            <div className="modal__acciones">
              <button className="boton boton--secundario" onClick={() => setDetalle(null)}>
                Cerrar
              </button>
              {gestionar && (
                <button className="boton boton--secundario" onClick={() => setAdelanto(true)}>
                  Nuevo adelanto
                </button>
              )}
              {gestionar && (
                <button className="boton" onClick={() => setLiquidar(detalle)}>
                  Liquidar sueldo
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal abierto={adelanto} titulo="Registrar adelanto" alCerrar={() => setAdelanto(false)}>
        <form className="formulario-modal" onSubmit={crearAdelanto}>
          {mensaje && (
            <p className="mensaje" role="alert">
              {mensaje}
            </p>
          )}
          <div>
            <label>Fecha</label>
            <input name="fecha" type="date" defaultValue={hoy()} required />
          </div>
          <div>
            <label>Importe</label>
            <input name="monto" type="number" min="0.01" step="0.01" onFocus={(e) => e.currentTarget.select()} required />
          </div>
          <div>
            <label>Medio</label>
            <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="debito">Débito bancario</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          {medioPago === 'efectivo' && (
            <div>
              <label>Origen del efectivo</label>
              <select value={origenEfectivo} onChange={(e) => setOrigenEfectivo(e.target.value)}>
                <option value="tesoreria">Cuenta de efectivo de Tesorería</option>
                <option value="caja">Mi caja abierta</option>
              </select>
            </div>
          )}
          {usaCuenta && (
            <div>
              <label>Cuenta de Tesorería</label>
              <select name="cuenta_tesoreria_id" required defaultValue="">
                <option value="" disabled>
                  Seleccionar cuenta de origen
                </option>
                {cuentasDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} · {moneda(c.saldo)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label>Referencia</label>
            <input name="referencia" />
          </div>
          <div>
            <label>Observaciones</label>
            <textarea name="observaciones" />
          </div>
          <div className="modal__acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setAdelanto(false)}>
              Cancelar
            </button>
            <button className="boton" disabled={procesando}>
              {procesando ? 'Registrando…' : 'Registrar'}
            </button>
          </div>
        </form>
      </Modal>
      <Modal abierto={Boolean(liquidar)} titulo="Nueva liquidación" alCerrar={() => setLiquidar(null)}>
        <form className="formulario-modal" onSubmit={crearLiquidacion}>
          <div>
            <label>Desde</label>
            <input name="periodo_desde" type="date" required />
          </div>
          <div>
            <label>Hasta</label>
            <input name="periodo_hasta" type="date" required />
          </div>
          <div>
            <label>Sueldo base</label>
            <input name="sueldo_base" type="number" min="0" step=".01" defaultValue={liquidar?.sueldo_base || 0} />
          </div>
          <div>
            <label>Adicionales</label>
            <input name="adicionales" type="number" min="0" step=".01" defaultValue="0" />
          </div>
          <div>
            <label>Otros descuentos</label>
            <input name="descuentos" type="number" min="0" step=".01" defaultValue="0" />
          </div>
          <label className="filtro-verificacion">
            <input name="aplicar_adelantos" type="checkbox" defaultChecked /> Aplicar adelantos pendientes
          </label>
          <div>
            <label>Observaciones</label>
            <textarea name="observaciones" />
          </div>
          <div className="modal__acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setLiquidar(null)}>
              Cancelar
            </button>
            <button className="boton">Crear liquidación</button>
          </div>
        </form>
      </Modal>
      <Modal abierto={Boolean(liquidacion)} titulo={liquidacion ? `Liquidación #${liquidacion.id}` : 'Liquidación'} alCerrar={() => setLiquidacion(null)}>
        {liquidacion && (
          <div>
            <p>
              <strong>{liquidacion.empleado}</strong>
            </p>
            <div className="tarjetas-resumen">
              <div>
                <span>Neto</span>
                <strong>{moneda(liquidacion.total_neto)}</strong>
              </div>
              <div>
                <span>Saldo</span>
                <strong>{moneda(liquidacion.saldo_pendiente)}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong className={claseEstadoLiquidacion(liquidacion.estado)}>{liquidacion.estado}</strong>
              </div>
            </div>
            <h3>Pagos</h3>
            {liquidacion.pagos.map((p) => (
              <p key={p.id}>
                {formatearFechaHora(p.fecha_creacion)} · {p.medio} · {p.caja || p.cuenta_tesoreria || 'Sin origen'} · {moneda(p.monto)}
              </p>
            ))}
            <div className="modal__acciones">
              <button className="boton boton--secundario" onClick={() => setLiquidacion(null)}>
                Cerrar
              </button>
              <button className="boton boton--secundario" onClick={imprimirReciboLiquidacion}>
                Imprimir recibo
              </button>
              {gestionar && liquidacion.saldo_pendiente > 0 && (
                <button className="boton" onClick={() => setPagar(true)}>
                  Registrar pago
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal abierto={pagar} titulo="Pagar liquidación" alCerrar={() => setPagar(false)}>
        <form className="formulario-modal" onSubmit={pagarSueldo}>
          {mensaje && (
            <p className="mensaje" role="alert">
              {mensaje}
            </p>
          )}
          <p>
            Saldo: <strong>{moneda(liquidacion?.saldo_pendiente || 0)}</strong>
          </p>
          <div>
            <label>Importe</label>
            <input name="monto" type="number" min=".01" max={liquidacion?.saldo_pendiente} step=".01" defaultValue={liquidacion?.saldo_pendiente} onFocus={(e) => e.currentTarget.select()} />
          </div>
          <div>
            <label>Medio</label>
            <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="debito">Débito bancario</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          {medioPago === 'efectivo' && (
            <div>
              <label>Origen del efectivo</label>
              <select value={origenEfectivo} onChange={(e) => setOrigenEfectivo(e.target.value)}>
                <option value="tesoreria">Cuenta de efectivo de Tesorería</option>
                <option value="caja">Mi caja abierta</option>
              </select>
            </div>
          )}
          {usaCuenta && (
            <div>
              <label>Cuenta de Tesorería</label>
              <select name="cuenta_tesoreria_id" required defaultValue="">
                <option value="" disabled>
                  Seleccionar cuenta de origen
                </option>
                {cuentasDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} · {moneda(c.saldo)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label>Referencia</label>
            <input name="referencia" placeholder="Referencia" />
          </div>
          <div className="modal__acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setPagar(false)}>
              Cancelar
            </button>
            <button className="boton" disabled={procesando}>
              {procesando ? 'Procesando…' : 'Confirmar pago'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
