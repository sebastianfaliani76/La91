import { useCallback, useEffect, useState } from 'react';
import { Modal } from './componentes/Modal.jsx';
import { Paginacion } from './componentes/Paginacion.jsx';
import {
  fechaCivilVencida,
  fechaParaInput,
  formatearFecha,
  formatearFechaHora,
} from './utilidades/fechas.js';

async function solicitar(ruta, token, opciones = {}) {
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
const hoy = fechaParaInput;

function FormularioProveedor({ proveedor, alGuardar, alCancelar }) {
  return (
    <form className="formulario-modal" onSubmit={alGuardar}>
      <div className="campos-producto">
        <div className="campo campo--ancho">
          <label>Razón social</label>
          <input
            name="razon_social"
            defaultValue={proveedor?.razon_social ?? ''}
            minLength="2"
            maxLength="160"
            required
            autoFocus
          />
        </div>
        <div className="campo">
          <label>Nombre comercial</label>
          <input
            name="nombre_fantasia"
            defaultValue={proveedor?.nombre_fantasia ?? ''}
            maxLength="160"
          />
        </div>
        <div className="campo">
          <label>CUIT</label>
          <input
            name="cuit"
            defaultValue={proveedor?.cuit ?? ''}
            pattern="[0-9]{2}-?[0-9]{8}-?[0-9]"
          />
        </div>
        <div className="campo">
          <label>Condición frente al IVA</label>
          <select
            name="condicion_iva"
            defaultValue={proveedor?.condicion_iva ?? ''}
          >
            <option value="">Sin especificar</option>
            <option>Responsable inscripto</option>
            <option>Monotributista</option>
            <option>Exento</option>
            <option>Consumidor final</option>
          </select>
        </div>
        <div className="campo">
          <label>Persona de contacto</label>
          <input
            name="persona_contacto"
            defaultValue={proveedor?.persona_contacto ?? ''}
            maxLength="120"
          />
        </div>
        <div className="campo">
          <label>Teléfono</label>
          <input
            name="telefono"
            defaultValue={proveedor?.telefono ?? ''}
            maxLength="30"
          />
        </div>
        <div className="campo">
          <label>Correo electrónico</label>
          <input
            name="correo_electronico"
            type="email"
            defaultValue={proveedor?.correo_electronico ?? ''}
            maxLength="254"
          />
        </div>
        <div className="campo">
          <label>Dirección</label>
          <input
            name="direccion"
            defaultValue={proveedor?.direccion ?? ''}
            maxLength="255"
          />
        </div>
        <div className="campo campo--ancho">
          <label>Observaciones</label>
          <textarea
            name="observaciones"
            defaultValue={proveedor?.observaciones ?? ''}
            maxLength="500"
            rows="3"
          />
        </div>
        {proveedor && (
          <label className="filtro-verificacion campo--ancho">
            <input
              name="esta_activo"
              type="checkbox"
              defaultChecked={Boolean(proveedor.esta_activo)}
            />{' '}
            Proveedor activo
          </label>
        )}
      </div>
      <div className="modal__acciones">
        <button
          type="button"
          className="boton boton--secundario"
          onClick={alCancelar}
        >
          Cancelar
        </button>
        <button className="boton">
          {proveedor ? 'Guardar cambios' : 'Crear proveedor'}
        </button>
      </div>
    </form>
  );
}

export function Proveedores({ token, permisos }) {
  const [proveedores, setProveedores] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('activos');
  const [filtroCuenta, setFiltroCuenta] = useState('todas');
  const [editado, setEditado] = useState();
  const [modal, setModal] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [cuenta, setCuenta] = useState(null);
  const [factura, setFactura] = useState(false);
  const [ordenFacturaId, setOrdenFacturaId] = useState('');
  const [totalFactura, setTotalFactura] = useState('');
  const [pagar, setPagar] = useState(false);
  const [errorPago, setErrorPago] = useState('');
  const [comprobante, setComprobante] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [cuentasTesoreria, setCuentasTesoreria] = useState([]);
  const [medioPago, setMedioPago] = useState('transferencia');
  const [origenEfectivo, setOrigenEfectivo] = useState('tesoreria');
  const [limite, setLimite] = useState(25);
  const cargar = useCallback(async () => {
    try {
      const parametros = new URLSearchParams({
        pagina,
        limite,
        estado,
        cuenta: filtroCuenta,
      });
      if (buscar) parametros.set('buscar', buscar);
      const respuesta = await solicitar(
        `/api/proveedores?${parametros}`,
        token,
      );
      setProveedores(respuesta.datos);
      setTotal(respuesta.total);
    } catch (error) {
      setMensaje(error.message);
    }
  }, [token, pagina, limite, buscar, estado, filtroCuenta]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    if (!pagar) return;
    setErrorPago('');
    setMedioPago('transferencia');
    setOrigenEfectivo('tesoreria');
    solicitar('/api/tesoreria/cuentas', token)
      .then((respuesta) => setCuentasTesoreria(respuesta.datos))
      .catch((error) => setMensaje(error.message));
  }, [pagar, token]);
  useEffect(() => {
    const t = setTimeout(() => {
      setPagina(1);
      setBuscar(texto.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [texto]);
  const abrirCuenta = async (proveedor) => {
    try {
      const respuesta = await solicitar(
        `/api/proveedores/${proveedor.id}/cuenta`,
        token,
      );
      setCuenta(respuesta.dato);
    } catch (error) {
      setMensaje(error.message);
    }
  };
  async function guardar(evento) {
    evento.preventDefault();
    const f = new FormData(evento.currentTarget);
    const opt = (n) => f.get(n) || null;
    const datos = {
      razon_social: f.get('razon_social'),
      nombre_fantasia: opt('nombre_fantasia'),
      cuit: opt('cuit'),
      condicion_iva: opt('condicion_iva'),
      persona_contacto: opt('persona_contacto'),
      telefono: opt('telefono'),
      correo_electronico: opt('correo_electronico'),
      direccion: opt('direccion'),
      observaciones: opt('observaciones'),
      ...(editado ? { esta_activo: f.get('esta_activo') === 'on' } : {}),
    };
    try {
      await solicitar(
        editado ? `/api/proveedores/${editado.id}` : '/api/proveedores',
        token,
        { method: editado ? 'PUT' : 'POST', body: JSON.stringify(datos) },
      );
      setModal(false);
      setEditado(undefined);
      setMensaje(
        editado
          ? 'Proveedor actualizado correctamente.'
          : 'Proveedor creado correctamente.',
      );
      await cargar();
    } catch (error) {
      setMensaje(error.message);
    }
  }
  async function guardarFactura(evento) {
    evento.preventDefault();
    const f = new FormData(evento.currentTarget);
    setProcesando(true);
    try {
      await solicitar(`/api/proveedores/${cuenta.id}/facturas`, token, {
        method: 'POST',
        body: JSON.stringify({
          orden_compra_id: f.get('orden_compra_id')
            ? Number(f.get('orden_compra_id'))
            : null,
          tipo_comprobante: f.get('tipo_comprobante'),
          numero_comprobante: f.get('numero_comprobante'),
          fecha_emision: f.get('fecha_emision'),
          fecha_vencimiento: f.get('fecha_vencimiento'),
          total: Number(f.get('total')),
          observaciones: f.get('observaciones') || null,
        }),
      });
      setFactura(false);
      setOrdenFacturaId('');
      setTotalFactura('');
      await Promise.all([abrirCuenta(cuenta), cargar()]);
      setMensaje('Factura registrada correctamente.');
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setProcesando(false);
    }
  }
  async function guardarPago(evento) {
    evento.preventDefault();
    const f = new FormData(evento.currentTarget);
    setProcesando(true);
    try {
      const respuesta = await solicitar(
        `/api/proveedores/${cuenta.id}/pagos`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            medio: f.get('medio'),
            origen_efectivo: medioPago === 'efectivo' ? origenEfectivo : null,
            cuenta_tesoreria_id:
              medioPago === 'efectivo' && origenEfectivo === 'caja'
                ? null
                : Number(f.get('cuenta_tesoreria_id')),
            monto: Number(f.get('monto')),
            referencia: f.get('referencia') || null,
            observaciones: f.get('observaciones') || null,
          }),
        },
      );
      const recibo = await solicitar(
        `/api/proveedores/pagos/${respuesta.dato.id}`,
        token,
      );
      setPagar(false);
      setComprobante(recibo.dato);
      await Promise.all([abrirCuenta(cuenta), cargar()]);
      setMensaje('Pago registrado correctamente.');
    } catch (error) {
      setErrorPago(error.message);
    } finally {
      setProcesando(false);
    }
  }
  async function abrirComprobante(id) {
    try {
      setComprobante(
        (await solicitar(`/api/proveedores/pagos/${id}`, token)).dato,
      );
    } catch (error) {
      setMensaje(error.message);
    }
  }
  const gestionar = permisos.includes('compras.gestionar');
  const verCuenta = permisos.includes('cuentas_proveedores.ver');
  const gestionarCuenta = permisos.includes('cuentas_proveedores.gestionar');
  const paginas = Math.max(1, Math.ceil(total / limite));
  const cerrarEdicion = () => {
    setModal(false);
    setEditado(undefined);
  };
  const abrirFactura = (orden = null) => {
    setOrdenFacturaId(orden ? String(orden.id) : '');
    setTotalFactura(orden ? String(Number(orden.total)) : '');
    setFactura(true);
  };
  return (
    <section className="modulo">
      <div className="modulo__encabezado">
        <div>
          <p className="etiqueta">COMPRAS</p>
          <h2>Proveedores</h2>
        </div>
        {gestionar && (
          <button className="boton" onClick={() => setModal(true)}>
            Nuevo proveedor
          </button>
        )}
      </div>
      <div className="barra-filtros">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por razón social, CUIT o contacto"
        />
        <select
          value={filtroCuenta}
          onChange={(e) => {
            setFiltroCuenta(e.target.value);
            setPagina(1);
          }}
        >
          <option value="todas">Todas las cuentas</option>
          <option value="deuda">Con deuda</option>
          <option value="vencida">Con deuda vencida</option>
          <option value="sin_facturar">Con compras sin facturar</option>
        </select>
        <select
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value);
            setPagina(1);
          }}
        >
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </select>
      </div>
      <p className="filtro-activo">
        Mostrando {total.toLocaleString('es-AR')} proveedores.
      </p>
      {mensaje && <p className="mensaje">{mensaje}</p>}
      <article className="panel">
        <div className="panel__encabezado">
          <h3>Padrón de proveedores</h3>
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
        {proveedores.length ? (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>CUIT</th>
                  <th>Contacto</th>
                  <th>Saldo</th>
                  <th>Sin facturar</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((proveedor) => (
                  <tr key={proveedor.id}>
                    <td>
                      {proveedor.nombre_fantasia || proveedor.razon_social}
                      <small className="dato-secundario">
                        {proveedor.nombre_fantasia
                          ? proveedor.razon_social
                          : ''}
                      </small>
                    </td>
                    <td>{proveedor.cuit || '—'}</td>
                    <td>
                      {proveedor.telefono ||
                        proveedor.correo_electronico ||
                        '—'}
                    </td>
                    <td
                      className={
                        Number(proveedor.vencido) > 0 ? 'cantidad-baja' : ''
                      }
                    >
                      {moneda(proveedor.saldo)}
                    </td>
                    <td
                      className={
                        Number(proveedor.compras_sin_factura) > 0
                          ? 'pendiente-facturacion'
                          : ''
                      }
                    >
                      {Number(proveedor.compras_sin_factura) > 0 ? (
                        <>
                          {moneda(proveedor.importe_sin_factura)}
                          <small className="dato-secundario">
                            {Number(
                              proveedor.compras_sin_factura,
                            ).toLocaleString('es-AR')}{' '}
                            {Number(proveedor.compras_sin_factura) === 1
                              ? 'compra'
                              : 'compras'}
                          </small>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          proveedor.esta_activo
                            ? 'estado-activo'
                            : 'estado-inactivo'
                        }
                      >
                        {proveedor.esta_activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="acciones-tabla">
                        {verCuenta && (
                          <button
                            className="boton-tabla"
                            onClick={() => abrirCuenta(proveedor)}
                          >
                            Cuenta
                          </button>
                        )}
                        {gestionar && (
                          <button
                            className="boton-tabla"
                            onClick={() => {
                              setEditado(proveedor);
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
        ) : (
          <p className="vacio">No hay proveedores para mostrar.</p>
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
            onClick={() => setPagina((v) => v - 1)}
          >
            Anterior
          </button>
          <button
            disabled={pagina >= paginas}
            onClick={() => setPagina((v) => v + 1)}
          >
            Siguiente
          </button>
          */}
        </div>
      </article>
      <Modal
        abierto={modal}
        titulo={editado ? 'Editar proveedor' : 'Nuevo proveedor'}
        ancho="grande"
        alCerrar={cerrarEdicion}
      >
        <FormularioProveedor
          key={editado?.id || 'nuevo'}
          proveedor={editado}
          alGuardar={guardar}
          alCancelar={cerrarEdicion}
        />
      </Modal>
      <Modal
        abierto={Boolean(cuenta)}
        titulo={
          cuenta
            ? `Cuenta · ${cuenta.nombre_fantasia || cuenta.razon_social}`
            : 'Cuenta de proveedor'
        }
        ancho="grande"
        alCerrar={() => setCuenta(null)}
      >
        {cuenta && (
          <div>
            <div className="tarjetas-resumen">
              <div>
                <span>Saldo pendiente</span>
                <strong>{moneda(cuenta.saldo)}</strong>
              </div>
              <div>
                <span>Saldo vencido</span>
                <strong>{moneda(cuenta.vencido)}</strong>
              </div>
              <div>
                <span>Facturas</span>
                <strong>{cuenta.facturas.length}</strong>
              </div>
              <div>
                <span>Pagos</span>
                <strong>{cuenta.pagos.length}</strong>
              </div>
              <div>
                <span>Compras sin factura</span>
                <strong>{cuenta.ordenes.length}</strong>
              </div>
            </div>
            <h3>Compras pendientes de facturación</h3>
            {cuenta.ordenes.length ? (
              <div className="tabla-contenedor tabla-cuenta">
                <table>
                  <thead>
                    <tr>
                      <th>Compra</th>
                      <th>Recepción</th>
                      <th>Productos</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuenta.ordenes.map((orden) => (
                      <tr key={orden.id}>
                        <td>#{orden.id}</td>
                        <td>
                          {orden.fecha_recepcion
                            ? formatearFechaHora(orden.fecha_recepcion)
                            : formatearFecha(orden.fecha_esperada)}
                        </td>
                        <td>{orden.productos}</td>
                        <td>{moneda(orden.total)}</td>
                        <td>
                          {gestionarCuenta && (
                            <button
                              className="boton-tabla"
                              onClick={() => abrirFactura(orden)}
                            >
                              Registrar factura
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="vacio">
                No hay compras recibidas pendientes de facturación.
              </p>
            )}
            <h3>Facturas</h3>
            {cuenta.facturas.length ? (
              <div className="tabla-contenedor tabla-cuenta">
                <table>
                  <thead>
                    <tr>
                      <th>Comprobante</th>
                      <th>Emisión</th>
                      <th>Vencimiento</th>
                      <th>Total</th>
                      <th>Saldo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuenta.facturas.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.tipo_comprobante} {item.numero_comprobante}
                          {item.orden_compra_id && (
                            <small className="dato-secundario">
                              Compra #{item.orden_compra_id}
                            </small>
                          )}
                        </td>
                        <td>{formatearFecha(item.fecha_emision)}</td>
                        <td>{formatearFecha(item.fecha_vencimiento)}</td>
                        <td>{moneda(item.total)}</td>
                        <td>{moneda(item.saldo_pendiente)}</td>
                        <td>
                          <span
                            className={
                              item.saldo_pendiente > 0 &&
                              fechaCivilVencida(item.fecha_vencimiento)
                                ? 'estado-deuda-vencida'
                                : 'estado-activo'
                            }
                          >
                            {item.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="vacio">No hay facturas registradas.</p>
            )}
            <h3>Pagos</h3>
            {cuenta.pagos.length ? (
              <div className="tabla-contenedor tabla-cuenta">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Medio</th>
                      <th>Referencia</th>
                      <th>Importe</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuenta.pagos.map((item) => (
                      <tr key={item.id}>
                        <td>{formatearFechaHora(item.fecha_creacion)}</td>
                        <td>{item.medio}</td>
                        <td>{item.referencia || '—'}</td>
                        <td>{moneda(item.monto)}</td>
                        <td>
                          <button
                            className="boton-tabla"
                            onClick={() => abrirComprobante(item.id)}
                          >
                            Comprobante
                          </button>
                        </td>
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
                onClick={() => setCuenta(null)}
              >
                Cerrar
              </button>
              {gestionarCuenta && (
                <button
                  className="boton boton--secundario"
                  onClick={() => abrirFactura()}
                >
                  Nueva factura
                </button>
              )}
              {gestionarCuenta && cuenta.saldo > 0 && (
                <button className="boton" onClick={() => setPagar(true)}>
                  Registrar pago
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        abierto={factura}
        titulo="Nueva factura de proveedor"
        alCerrar={() => {
          setFactura(false);
          setOrdenFacturaId('');
          setTotalFactura('');
        }}
      >
        <form className="formulario-modal" onSubmit={guardarFactura}>
          <div>
            <label>Orden de compra relacionada</label>
            <select
              name="orden_compra_id"
              value={ordenFacturaId}
              onChange={(e) => {
                const valor = e.target.value;
                const orden = cuenta?.ordenes.find(
                  (item) => String(item.id) === valor,
                );
                setOrdenFacturaId(valor);
                setTotalFactura(orden ? String(Number(orden.total)) : '');
              }}
            >
              <option value="">Sin orden relacionada</option>
              {cuenta?.ordenes.map((o) => (
                <option key={o.id} value={o.id}>
                  Compra #{o.id} · {moneda(o.total)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Tipo</label>
            <select name="tipo_comprobante">
              <option value="factura">Factura</option>
              <option value="remito">Remito valorizado</option>
              <option value="nota_debito">Nota de débito</option>
            </select>
          </div>
          <div>
            <label>Número de comprobante</label>
            <input name="numero_comprobante" maxLength="80" required />
          </div>
          <div className="campos-producto">
            <div className="campo">
              <label>Fecha de emisión</label>
              <input
                name="fecha_emision"
                type="date"
                defaultValue={hoy()}
                required
              />
            </div>
            <div className="campo">
              <label>Vencimiento</label>
              <input
                name="fecha_vencimiento"
                type="date"
                defaultValue={hoy()}
                required
              />
            </div>
            <div className="campo">
              <label>Total</label>
              <input
                name="total"
                type="number"
                min="0.01"
                step="0.01"
                value={totalFactura}
                onChange={(e) => setTotalFactura(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                required
              />
            </div>
          </div>
          <div>
            <label>Observaciones</label>
            <textarea name="observaciones" maxLength="500" rows="2" />
          </div>
          <div className="modal__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => {
                setFactura(false);
                setOrdenFacturaId('');
                setTotalFactura('');
              }}
            >
              Cancelar
            </button>
            <button className="boton" disabled={procesando}>
              {procesando ? 'Registrando…' : 'Registrar factura'}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        abierto={pagar}
        titulo="Registrar pago a proveedor"
        alCerrar={() => setPagar(false)}
      >
        <form className="formulario-modal" onSubmit={guardarPago}>
          <p>
            Saldo pendiente: <strong>{moneda(cuenta?.saldo || 0)}</strong>
          </p>
          <div>
            <label>Importe</label>
            <input
              name="monto"
              type="number"
              min="0.01"
              max={cuenta?.saldo}
              step="0.01"
              defaultValue={cuenta?.saldo}
              required
            />
          </div>
          <div>
            <label>Medio</label>
            <select
              name="medio"
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value)}
            >
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="cheque">Cheque</option>
              <option value="debito">Débito bancario</option>
            </select>
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
            {(medioPago !== 'efectivo' || origenEfectivo === 'tesoreria') && (
              <div>
                <label>Cuenta de Tesorería</label>
                <select name="cuenta_tesoreria_id" required defaultValue="">
                  <option value="" disabled>
                    Seleccionar cuenta de origen
                  </option>
                  {cuentasTesoreria
                    .filter(
                      (item) =>
                        medioPago !== 'efectivo' || item.tipo === 'efectivo',
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre} · {moneda(item.saldo)}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label>Referencia / operación</label>
            <input name="referencia" maxLength="100" />
          </div>
          <div>
            <label>Observaciones</label>
            <textarea name="observaciones" maxLength="255" rows="2" />
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
              {procesando ? 'Registrando…' : 'Confirmar pago'}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        abierto={Boolean(errorPago)}
        titulo="No se pudo registrar el pago"
        alCerrar={() => setErrorPago('')}
      >
        <p className="mensaje" role="alert">
          {errorPago}
        </p>
        <p>La deuda y el saldo de la cuenta no fueron modificados.</p>
        <div className="modal__acciones">
          <button className="boton" onClick={() => setErrorPago('')} autoFocus>
            Entendido
          </button>
        </div>
      </Modal>
      <Modal
        abierto={Boolean(comprobante)}
        titulo={
          comprobante ? `Comprobante de pago #${comprobante.id}` : 'Comprobante'
        }
        alCerrar={() => setComprobante(null)}
      >
        <div className="comprobante-venta comprobante-cobranza">
          {comprobante && (
            <>
              <p>
                <strong>Proveedor:</strong> {comprobante.proveedor}
              </p>
              <p>
                <strong>Fecha:</strong>{' '}
                {formatearFechaHora(comprobante.fecha_creacion)}
              </p>
              <p>
                <strong>Medio:</strong> {comprobante.medio}
                {comprobante.caja ? ` · ${comprobante.caja}` : ''}
                {comprobante.cuenta_tesoreria
                  ? ` · ${comprobante.cuenta_tesoreria}`
                  : ''}
              </p>
              <div className="importe-cobro">
                <span>Total pagado</span>
                <strong>{moneda(comprobante.monto)}</strong>
              </div>
              <h3>Aplicado a</h3>
              {comprobante.aplicaciones.map((a) => (
                <p key={a.factura_proveedor_id}>
                  Factura {a.numero_comprobante}: {moneda(a.monto)}
                </p>
              ))}
            </>
          )}
          <div className="modal__acciones">
            <button
              className="boton boton--secundario"
              onClick={() => setComprobante(null)}
            >
              Cerrar
            </button>
            <button className="boton" onClick={() => window.print()}>
              Imprimir
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
