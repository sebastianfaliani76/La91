import { useCallback, useEffect, useState } from 'react';
import { useActualizacionAutomatica } from './hooks/useActualizacionAutomatica.js';
import { Modal } from './componentes/Modal.jsx';
import { Paginacion } from './componentes/Paginacion.jsx';
import {
  fechaCivilVencida,
  fechaParaInput,
  formatearFecha,
  formatearFechaHora,
} from './utilidades/fechas.js';

async function pedir(ruta, token, opciones = {}) {
  const respuesta = await fetch(ruta, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const datos = await respuesta.json();
  if (!respuesta.ok)
    throw new Error(datos.mensaje || 'No se pudo completar la operación');
  return datos;
}
const moneda = (valor) =>
  Number(valor).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const fechaSql = (valor) => String(valor || '').slice(0, 10);

function avanzarFecha(valor, frecuencia) {
  const fecha = new Date(`${fechaSql(valor)}T12:00:00`);
  if (frecuencia === 'semanal') fecha.setDate(fecha.getDate() + 7);
  else
    fecha.setMonth(
      fecha.getMonth() +
        ({ mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }[
          frecuencia
        ] || 1),
    );
  return fechaParaInput(fecha);
}

function FormularioGasto({
  base = {},
  referencias,
  recurrente,
  setRecurrente,
  procesando,
  alEnviar,
  alCancelar,
  tituloBoton,
}) {
  return (
    <form className="formulario-modal" onSubmit={alEnviar}>
      <div className="campos-producto">
        <div className="campo campo--ancho">
          <label>Concepto</label>
          <input
            name="concepto"
            defaultValue={base.concepto || ''}
            minLength="2"
            maxLength="180"
            required
            autoFocus
          />
        </div>
        <div className="campo">
          <label>Categoría</label>
          <select
            name="categoria_gasto_id"
            required
            defaultValue={base.categoria_gasto_id || ''}
          >
            <option value="" disabled>
              Seleccionar
            </option>
            {referencias.categorias.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>Proveedor / beneficiario</label>
          <select name="proveedor_id" defaultValue={base.proveedor_id || ''}>
            <option value="">Sin proveedor asociado</option>
            {referencias.proveedores.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>Número de comprobante</label>
          <input
            name="numero_comprobante"
            defaultValue={base.numero_comprobante || ''}
            maxLength="80"
          />
        </div>
        <div className="campo">
          <label>Total</label>
          <input
            name="total"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={base.total || ''}
            onFocus={(e) => e.currentTarget.select()}
            required
          />
        </div>
        <div className="campo">
          <label>Emisión</label>
          <input
            name="fecha_emision"
            type="date"
            defaultValue={fechaSql(base.fecha_emision) || fechaParaInput()}
            required
          />
        </div>
        <div className="campo">
          <label>Vencimiento</label>
          <input
            name="fecha_vencimiento"
            type="date"
            defaultValue={fechaSql(base.fecha_vencimiento) || fechaParaInput()}
            required
          />
        </div>
        <label className="filtro-verificacion campo--ancho">
          <input
            type="checkbox"
            checked={recurrente}
            onChange={(e) => setRecurrente(e.target.checked)}
          />{' '}
          Gasto o servicio recurrente
        </label>
        {recurrente && (
          <div className="campo">
            <label>Frecuencia</label>
            <select
              name="frecuencia"
              defaultValue={base.frecuencia || 'mensual'}
            >
              <option value="mensual">Mensual</option>
              <option value="semanal">Semanal</option>
              <option value="bimestral">Bimestral</option>
              <option value="trimestral">Trimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>
          </div>
        )}
        <div className="campo campo--ancho">
          <label>Observaciones</label>
          <textarea
            name="observaciones"
            defaultValue={base.observaciones || ''}
            maxLength="500"
            rows="2"
          />
        </div>
      </div>
      <div className="modal__acciones">
        <button
          type="button"
          className="boton boton--secundario"
          onClick={alCancelar}
        >
          Cancelar
        </button>
        <button className="boton" disabled={procesando}>
          {procesando ? 'Guardando…' : tituloBoton}
        </button>
      </div>
    </form>
  );
}

export function Gastos({ token, permisos }) {
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState({ pendiente: 0, vencido: 0 });
  const [referencias, setReferencias] = useState({
    categorias: [],
    proveedores: [],
  });
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState('pendientes');
  const [categoria, setCategoria] = useState('');
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [modalGasto, setModalGasto] = useState(null);
  const [modalCategoria, setModalCategoria] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [pagar, setPagar] = useState(false);
  const [anular, setAnular] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [recurrente, setRecurrente] = useState(false);
  const [cuentasTesoreria, setCuentasTesoreria] = useState([]);
  const [medioPago, setMedioPago] = useState('transferencia');
  const [origenEfectivo, setOrigenEfectivo] = useState('tesoreria');
  const [limite, setLimite] = useState(25);

  const cargar = useCallback(async () => {
    try {
      const parametros = new URLSearchParams({ pagina, limite, estado });
      if (buscar) parametros.set('buscar', buscar);
      if (categoria) parametros.set('categoria_id', categoria);
      const [lista, refs] = await Promise.all([
        pedir(`/api/gastos?${parametros}`, token),
        pedir('/api/gastos/referencias', token),
      ]);
      setDatos(lista.datos);
      setTotal(lista.total);
      setResumen({ pendiente: lista.pendiente, vencido: lista.vencido });
      setReferencias(refs);
    } catch (error) {
      setMensaje(error.message);
    }
  }, [token, pagina, limite, estado, categoria, buscar]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useActualizacionAutomatica(
    cargar,
    !modalGasto && !modalCategoria && !detalle && !pagar && !anular && !procesando,
  );
  useEffect(() => {
    const espera = setTimeout(() => {
      setBuscar(texto.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(espera);
  }, [texto]);
  useEffect(() => {
    if (!pagar) return;
    setMedioPago('transferencia');
    setOrigenEfectivo('tesoreria');
    pedir('/api/tesoreria/cuentas', token)
      .then((respuesta) => setCuentasTesoreria(respuesta.datos))
      .catch((error) => setMensaje(error.message));
  }, [pagar, token]);

  const abrir = async (id) => {
    try {
      setDetalle((await pedir(`/api/gastos/${id}`, token)).dato);
    } catch (error) {
      setMensaje(error.message);
    }
  };
  const datosFormulario = (formulario) => ({
    categoria_gasto_id: Number(formulario.get('categoria_gasto_id')),
    proveedor_id: formulario.get('proveedor_id')
      ? Number(formulario.get('proveedor_id'))
      : null,
    concepto: formulario.get('concepto'),
    numero_comprobante: formulario.get('numero_comprobante') || null,
    fecha_emision: formulario.get('fecha_emision'),
    fecha_vencimiento: formulario.get('fecha_vencimiento'),
    total: Number(formulario.get('total')),
    es_recurrente: recurrente,
    frecuencia: recurrente ? formulario.get('frecuencia') : null,
    observaciones: formulario.get('observaciones') || null,
  });
  async function guardarGasto(evento) {
    evento.preventDefault();
    const datosGuardar = datosFormulario(new FormData(evento.currentTarget));
    const modo = modalGasto.modo;
    const ruta =
      modo === 'crear'
        ? '/api/gastos'
        : modo === 'editar'
          ? `/api/gastos/${modalGasto.base.id}`
          : `/api/gastos/${modalGasto.origen.id}/renovar`;
    setProcesando(true);
    try {
      const respuesta = await pedir(ruta, token, {
        method: modo === 'editar' ? 'PUT' : 'POST',
        body: JSON.stringify(datosGuardar),
      });
      setModalGasto(null);
      if (modo === 'editar') setDetalle(null);
      await cargar();
      setMensaje(
        modo === 'renovar'
          ? `Próximo período generado como gasto #${respuesta.dato.id}.`
          : modo === 'editar'
            ? 'Gasto actualizado correctamente.'
            : 'Gasto registrado correctamente.',
      );
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setProcesando(false);
    }
  }
  async function crearCategoria(evento) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    try {
      await pedir('/api/gastos/categorias', token, {
        method: 'POST',
        body: JSON.stringify({ nombre: formulario.get('nombre') }),
      });
      setModalCategoria(false);
      await cargar();
      setMensaje('Categoría creada correctamente.');
    } catch (error) {
      setMensaje(error.message);
    }
  }
  async function guardarPago(evento) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const usaCaja = medioPago === 'efectivo' && origenEfectivo === 'caja';
    setProcesando(true);
    try {
      await pedir(`/api/gastos/${detalle.id}/pagos`, token, {
        method: 'POST',
        body: JSON.stringify({
          monto: Number(formulario.get('monto')),
          medio: medioPago,
          origen_efectivo: medioPago === 'efectivo' ? origenEfectivo : null,
          cuenta_tesoreria_id: usaCaja
            ? null
            : Number(formulario.get('cuenta_tesoreria_id')),
          referencia: formulario.get('referencia') || null,
        }),
      });
      setPagar(false);
      await Promise.all([abrir(detalle.id), cargar()]);
      setMensaje('Pago registrado correctamente.');
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setProcesando(false);
    }
  }
  async function confirmarAnulacion(evento) {
    evento.preventDefault();
    const motivo = new FormData(evento.currentTarget).get('motivo');
    setProcesando(true);
    try {
      await pedir(`/api/gastos/${detalle.id}/anular`, token, {
        method: 'POST',
        body: JSON.stringify({ motivo }),
      });
      setAnular(false);
      setDetalle(null);
      await cargar();
      setMensaje('Gasto anulado correctamente.');
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setProcesando(false);
    }
  }
  const abrirNuevo = () => {
    setRecurrente(false);
    setModalGasto({ modo: 'crear', base: {} });
  };
  const abrirEdicion = () => {
    const base = detalle;
    setRecurrente(Boolean(base.es_recurrente));
    setDetalle(null);
    setModalGasto({ modo: 'editar', base });
  };
  const abrirRenovacion = () => {
    const origen = detalle;
    const base = {
      ...origen,
      id: undefined,
      numero_comprobante: '',
      fecha_emision: avanzarFecha(origen.fecha_emision, origen.frecuencia),
      fecha_vencimiento: avanzarFecha(
        origen.fecha_vencimiento,
        origen.frecuencia,
      ),
    };
    setRecurrente(true);
    setDetalle(null);
    setModalGasto({ modo: 'renovar', origen, base });
  };
  const sinPagos =
    detalle &&
    detalle.estado === 'pendiente' &&
    Math.abs(Number(detalle.total) - Number(detalle.saldo_pendiente)) < 0.009;
  const cuentasDisponibles =
    medioPago === 'efectivo'
      ? cuentasTesoreria.filter((item) => item.tipo === 'efectivo')
      : cuentasTesoreria;
  const usaCuenta = medioPago !== 'efectivo' || origenEfectivo === 'tesoreria';
  const gestionar = permisos.includes('gastos.gestionar');
  const paginas = Math.max(1, Math.ceil(total / limite));

  return (
    <section className="modulo">
      <div className="modulo__encabezado">
        <div>
          <p className="etiqueta">ADMINISTRACIÓN</p>
          <h2>Gastos y servicios</h2>
        </div>
        {gestionar && (
          <div className="acciones-encabezado">
            <button
              className="boton boton--secundario"
              onClick={() => setModalCategoria(true)}
            >
              Nueva categoría
            </button>
            <button className="boton" onClick={abrirNuevo}>
              Nuevo gasto
            </button>
          </div>
        )}
      </div>
      <div className="tarjetas-resumen">
        <div>
          <span>Total pendiente</span>
          <strong>{moneda(resumen.pendiente)}</strong>
        </div>
        <div>
          <span>Total vencido</span>
          <strong>{moneda(resumen.vencido)}</strong>
        </div>
        <div>
          <span>Registros filtrados</span>
          <strong>{total}</strong>
        </div>
        <div>
          <span>Próximos a pagar</span>
          <strong>
            {datos.filter((item) => Number(item.saldo_pendiente) > 0).length}
          </strong>
        </div>
      </div>
      <div className="barra-filtros">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar concepto, comprobante o proveedor"
        />
        <select
          value={categoria}
          onChange={(e) => {
            setCategoria(e.target.value);
            setPagina(1);
          }}
        >
          <option value="">Todas las categorías</option>
          {referencias.categorias.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nombre}
            </option>
          ))}
        </select>
        <select
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value);
            setPagina(1);
          }}
        >
          <option value="pendientes">Pendientes</option>
          <option value="vencidos">Vencidos</option>
          <option value="pagados">Pagados</option>
          <option value="anulados">Anulados</option>
          <option value="todos">Todos</option>
        </select>
      </div>
      {mensaje && <p className="mensaje">{mensaje}</p>}
      <article className="panel">
        <div className="panel__encabezado">
          <h3>Obligaciones</h3>
          <span>
            Página {pagina} de {paginas}
          </span>
        </div>
        <div className="paginacion--superior">
          <Paginacion
            pagina={pagina}
            paginas={paginas}
            limite={limite}
            alCambiarPagina={setPagina}
            alCambiarLimite={(v) => {
              setLimite(v);
              setPagina(1);
            }}
          />
        </div>
        {datos.length ? (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th>Proveedor</th>
                  <th>Vencimiento</th>
                  <th>Total</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {datos.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.concepto}
                      {item.es_recurrente && (
                        <small className="dato-secundario">
                          Recurrente · {item.frecuencia}
                        </small>
                      )}
                    </td>
                    <td>{item.categoria}</td>
                    <td>{item.proveedor || '—'}</td>
                    <td>{formatearFecha(item.fecha_vencimiento)}</td>
                    <td>{moneda(item.total)}</td>
                    <td>{moneda(item.saldo_pendiente)}</td>
                    <td>
                      <span
                        className={
                          Number(item.saldo_pendiente) > 0 &&
                          fechaCivilVencida(item.fecha_vencimiento)
                            ? 'estado-deuda-vencida'
                            : item.estado === 'anulado'
                              ? 'estado-inactivo'
                              : 'estado-activo'
                        }
                      >
                        {item.estado}
                      </span>
                    </td>
                    <td>
                      <button
                        className="boton-tabla"
                        onClick={() => abrir(item.id)}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vacio">No hay gastos para los filtros seleccionados.</p>
        )}
        <div className="paginacion">
          <Paginacion
            pagina={pagina}
            paginas={paginas}
            limite={limite}
            alCambiarPagina={setPagina}
            alCambiarLimite={(v) => {
              setLimite(v);
              setPagina(1);
            }}
          />
          {/*
          <button
            disabled={pagina === 1}
            onClick={() => setPagina((valor) => valor - 1)}
          >
            Anterior
          </button>
          <button
            disabled={pagina >= paginas}
            onClick={() => setPagina((valor) => valor + 1)}
          >
            Siguiente
          </button>
          */}
        </div>
      </article>
      <Modal
        abierto={Boolean(modalGasto)}
        titulo={
          modalGasto?.modo === 'editar'
            ? 'Editar gasto o servicio'
            : modalGasto?.modo === 'renovar'
              ? 'Preparar próximo período'
              : 'Nuevo gasto o servicio'
        }
        ancho="grande"
        alCerrar={() => setModalGasto(null)}
      >
        {modalGasto && (
          <FormularioGasto
            key={`${modalGasto.modo}-${modalGasto.base.id || modalGasto.origen?.id || 'nuevo'}`}
            base={modalGasto.base}
            referencias={referencias}
            recurrente={recurrente}
            setRecurrente={setRecurrente}
            procesando={procesando}
            alEnviar={guardarGasto}
            alCancelar={() => setModalGasto(null)}
            tituloBoton={
              modalGasto.modo === 'renovar' ? 'Crear período' : 'Guardar'
            }
          />
        )}
      </Modal>
      <Modal
        abierto={modalCategoria}
        titulo="Nueva categoría de gasto"
        alCerrar={() => setModalCategoria(false)}
      >
        <form className="formulario-modal" onSubmit={crearCategoria}>
          <div>
            <label>Nombre</label>
            <input
              name="nombre"
              minLength="2"
              maxLength="100"
              required
              autoFocus
            />
          </div>
          <div className="modal__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setModalCategoria(false)}
            >
              Cancelar
            </button>
            <button className="boton">Crear categoría</button>
          </div>
        </form>
      </Modal>
      <Modal
        abierto={Boolean(detalle)}
        titulo={
          detalle ? `Gasto #${detalle.id} · ${detalle.concepto}` : 'Detalle'
        }
        ancho="grande"
        alCerrar={() => setDetalle(null)}
      >
        {detalle && (
          <div>
            <div className="tarjetas-resumen">
              <div>
                <span>Total</span>
                <strong>{moneda(detalle.total)}</strong>
              </div>
              <div>
                <span>Saldo</span>
                <strong>{moneda(detalle.saldo_pendiente)}</strong>
              </div>
              <div>
                <span>Vencimiento</span>
                <strong>{formatearFecha(detalle.fecha_vencimiento)}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>{detalle.estado}</strong>
              </div>
            </div>
            <p>
              <strong>Categoría:</strong> {detalle.categoria} ·{' '}
              <strong>Proveedor:</strong> {detalle.proveedor || 'Sin asociar'}
            </p>
            {detalle.estado === 'anulado' && (
              <p className="mensaje">
                <strong>Motivo de anulación:</strong> {detalle.motivo_anulacion}
              </p>
            )}
            <h3>Pagos</h3>
            {detalle.pagos.length ? (
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Medio y origen</th>
                      <th>Referencia</th>
                      <th>Usuario</th>
                      <th>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.pagos.map((item) => (
                      <tr key={item.id}>
                        <td>{formatearFechaHora(item.fecha_creacion)}</td>
                        <td>
                          {item.medio}
                          <small className="dato-secundario">
                            {item.caja || item.cuenta_tesoreria || ''}
                          </small>
                        </td>
                        <td>{item.referencia || '—'}</td>
                        <td>{item.nombre_usuario}</td>
                        <td>{moneda(item.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="vacio">No hay pagos registrados.</p>
            )}
            <div className="modal__acciones">
              <button
                className="boton boton--secundario"
                onClick={() => setDetalle(null)}
              >
                Cerrar
              </button>
              {gestionar && sinPagos && (
                <button
                  className="boton boton--secundario"
                  onClick={abrirEdicion}
                >
                  Editar
                </button>
              )}
              {gestionar && sinPagos && (
                <button
                  className="boton boton--secundario"
                  onClick={() => setAnular(true)}
                >
                  Anular
                </button>
              )}
              {gestionar &&
                detalle.es_recurrente &&
                detalle.estado !== 'anulado' && (
                  <button
                    className="boton boton--secundario"
                    onClick={abrirRenovacion}
                  >
                    Generar próximo período
                  </button>
                )}
              {gestionar && Number(detalle.saldo_pendiente) > 0 && (
                <button className="boton" onClick={() => setPagar(true)}>
                  Registrar pago
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        abierto={pagar}
        titulo="Registrar pago de gasto"
        alCerrar={() => setPagar(false)}
      >
        <form className="formulario-modal" onSubmit={guardarPago}>
          <p>
            Saldo: <strong>{moneda(detalle?.saldo_pendiente || 0)}</strong>
          </p>
          <div>
            <label>Importe</label>
            <input
              name="monto"
              type="number"
              min="0.01"
              max={detalle?.saldo_pendiente}
              step="0.01"
              defaultValue={detalle?.saldo_pendiente}
              onFocus={(e) => e.currentTarget.select()}
              required
            />
          </div>
          <div>
            <label>Medio</label>
            <select
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value)}
            >
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="debito">Débito bancario</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          {medioPago === 'efectivo' && (
            <div>
              <label>Origen del efectivo</label>
              <select
                value={origenEfectivo}
                onChange={(e) => setOrigenEfectivo(e.target.value)}
              >
                <option value="tesoreria">
                  Cuenta de efectivo de Tesorería
                </option>
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
                {cuentasDisponibles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre} · {moneda(item.saldo)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label>Referencia</label>
            <input name="referencia" maxLength="100" />
          </div>
          <div className="modal__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setPagar(false)}
            >
              Cancelar
            </button>
            <button className="boton" disabled={procesando}>
              Confirmar pago
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        abierto={anular}
        titulo="Anular gasto"
        alCerrar={() => setAnular(false)}
      >
        <form className="formulario-modal" onSubmit={confirmarAnulacion}>
          <p>
            El gasto dejará de formar parte de las obligaciones pendientes. Esta
            acción quedará registrada.
          </p>
          <div>
            <label>Motivo</label>
            <textarea
              name="motivo"
              minLength="3"
              maxLength="255"
              rows="3"
              required
              autoFocus
            />
          </div>
          <div className="modal__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setAnular(false)}
            >
              Cancelar
            </button>
            <button className="boton" disabled={procesando}>
              Confirmar anulación
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
