import { useCallback, useEffect, useState } from 'react';
import { Modal } from './componentes/Modal.jsx';
import { Paginacion } from './componentes/Paginacion.jsx';
import { formatearFecha, formatearFechaHora } from './utilidades/fechas.js';

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

function Formulario({ cliente, alGuardar, alCancelar }) {
  const [credito, setCredito] = useState(Boolean(cliente?.credito_habilitado));
  return (
    <form className="formulario-modal" onSubmit={alGuardar}>
      <div className="campos-producto">
        <div className="campo campo--ancho">
          <label>Nombre y apellido / Razón social</label>
          <input
            name="nombre"
            defaultValue={cliente?.nombre || ''}
            minLength="2"
            maxLength="160"
            required
            autoFocus
          />
        </div>
        <div className="campo">
          <label>Tipo de documento</label>
          <select
            name="tipo_documento"
            defaultValue={cliente?.tipo_documento || ''}
          >
            <option value="">Sin especificar</option>
            <option>DNI</option>
            <option>CUIT</option>
            <option>CUIL</option>
            <option>OTRO</option>
          </select>
        </div>
        <div className="campo">
          <label>Número</label>
          <input
            name="numero_documento"
            defaultValue={cliente?.numero_documento || ''}
            maxLength="20"
          />
        </div>
        <div className="campo">
          <label>Teléfono</label>
          <input
            name="telefono"
            defaultValue={cliente?.telefono || ''}
            maxLength="30"
          />
        </div>
        <div className="campo">
          <label>Correo electrónico</label>
          <input
            name="correo_electronico"
            type="email"
            defaultValue={cliente?.correo_electronico || ''}
            maxLength="254"
          />
        </div>
        <div className="campo campo--ancho">
          <label>Dirección</label>
          <input
            name="direccion"
            defaultValue={cliente?.direccion || ''}
            maxLength="255"
          />
        </div>
        <label className="filtro-verificacion campo--ancho">
          <input
            name="credito_habilitado"
            type="checkbox"
            checked={credito}
            onChange={(evento) => setCredito(evento.target.checked)}
          />{' '}
          Habilitar cuenta corriente
        </label>
        {credito && (
          <>
            <div className="campo">
              <label>Límite de crédito</label>
              <input
                name="limite_credito"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={cliente?.limite_credito || ''}
                onFocus={(evento) => evento.currentTarget.select()}
                required
              />
            </div>
            <div className="campo">
              <label>Vencimiento habitual</label>
              <div className="campo-con-sufijo">
                <input
                  name="dias_vencimiento"
                  type="number"
                  min="1"
                  max="365"
                  step="1"
                  defaultValue={cliente?.dias_vencimiento || 30}
                  onFocus={(evento) => evento.currentTarget.select()}
                  required
                />
                <span>días</span>
              </div>
            </div>
          </>
        )}
        <div className="campo campo--ancho">
          <label>Observaciones</label>
          <textarea
            name="observaciones"
            defaultValue={cliente?.observaciones || ''}
            maxLength="500"
            rows="3"
          />
        </div>
        {cliente && (
          <label className="filtro-verificacion campo--ancho">
            <input
              name="esta_activo"
              type="checkbox"
              defaultChecked={Boolean(cliente.esta_activo)}
            />{' '}
            Cliente activo
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
          {cliente ? 'Guardar cambios' : 'Crear cliente'}
        </button>
      </div>
    </form>
  );
}

export function Clientes({ token, permisos }) {
  const [clientes, setClientes] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('activos');
  const [filtroCuenta, setFiltroCuenta] = useState('todas');
  const [editado, setEditado] = useState(undefined);
  const [modal, setModal] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [cuenta, setCuenta] = useState(null);
  const [cobrar, setCobrar] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [comprobante, setComprobante] = useState(null);
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
      const respuesta = await pedir(`/api/clientes?${parametros}`, token);
      setClientes(respuesta.datos);
      setTotal(respuesta.total);
    } catch (error) {
      setMensaje(error.message);
    }
  }, [token, pagina, limite, buscar, estado, filtroCuenta]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    const t = setTimeout(() => {
      setPagina(1);
      setBuscar(texto.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [texto]);
  async function guardar(evento) {
    evento.preventDefault();
    const f = new FormData(evento.currentTarget);
    const opt = (nombre) => f.get(nombre) || null;
    const habilitado = f.get('credito_habilitado') === 'on';
    const datos = {
      nombre: f.get('nombre'),
      tipo_documento: opt('tipo_documento'),
      numero_documento: opt('numero_documento'),
      telefono: opt('telefono'),
      correo_electronico: opt('correo_electronico'),
      direccion: opt('direccion'),
      observaciones: opt('observaciones'),
      credito_habilitado: habilitado,
      limite_credito: habilitado ? Number(f.get('limite_credito')) : 0,
      dias_vencimiento: habilitado ? Number(f.get('dias_vencimiento')) : 30,
      ...(editado ? { esta_activo: f.get('esta_activo') === 'on' } : {}),
    };
    try {
      await pedir(
        editado ? `/api/clientes/${editado.id}` : '/api/clientes',
        token,
        { method: editado ? 'PUT' : 'POST', body: JSON.stringify(datos) },
      );
      setModal(false);
      setEditado(undefined);
      setMensaje(
        editado
          ? 'Cliente actualizado correctamente.'
          : 'Cliente creado correctamente.',
      );
      await cargar();
    } catch (error) {
      setMensaje(error.message);
    }
  }
  async function abrirCuenta(cliente) {
    try {
      const respuesta = await pedir(
        `/api/clientes/${cliente.id}/cuenta`,
        token,
      );
      setCuenta(respuesta.dato);
    } catch (error) {
      setMensaje(error.message);
    }
  }
  async function abrirComprobante(id) {
    try {
      const respuesta = await pedir(`/api/clientes/cobranzas/${id}`, token);
      setComprobante(respuesta.dato);
    } catch (error) {
      setMensaje(error.message);
    }
  }
  async function registrarCobranza(evento) {
    evento.preventDefault();
    const f = new FormData(evento.currentTarget);
    setProcesando(true);
    try {
      const respuesta = await pedir(
        `/api/clientes/${cuenta.id}/cobranzas`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            medio: f.get('medio'),
            monto: Number(f.get('monto')),
            observaciones: f.get('observaciones') || null,
          }),
        },
      );
      const recibo = await pedir(
        `/api/clientes/cobranzas/${respuesta.dato.id}`,
        token,
      );
      setCobrar(false);
      setComprobante(recibo.dato);
      const actualizada = await pedir(
        `/api/clientes/${cuenta.id}/cuenta`,
        token,
      );
      setCuenta(actualizada.dato);
      await cargar();
      setMensaje('Cobranza registrada correctamente.');
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setProcesando(false);
    }
  }
  const gestionar = permisos.includes('clientes.gestionar');
  const verCuenta = permisos.includes('cuentas_clientes.ver');
  const puedeCobrar = permisos.includes('cuentas_clientes.cobrar');
  const paginas = Math.max(1, Math.ceil(total / limite));
  const cerrarEdicion = () => {
    setModal(false);
    setEditado(undefined);
  };
  return (
    <section className="modulo">
      <div className="modulo__encabezado">
        <div>
          <p className="etiqueta">GESTIÓN COMERCIAL</p>
          <h2>Clientes</h2>
        </div>
        {gestionar && (
          <button className="boton" onClick={() => setModal(true)}>
            Nuevo cliente
          </button>
        )}
      </div>
      <div className="barra-filtros">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre, documento, teléfono o correo"
        />
        <select
          value={filtroCuenta}
          onChange={(e) => {
            setFiltroCuenta(e.target.value);
            setPagina(1);
          }}
        >
          <option value="todas">Todas las cuentas</option>
          <option value="deudores">Con saldo pendiente</option>
          <option value="vencidas">Con deuda vencida</option>
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
        Mostrando {total.toLocaleString('es-AR')} clientes
        {buscar ? ` para “${buscar}”` : ''}.
      </p>
      {mensaje && <p className="mensaje">{mensaje}</p>}
      <article className="panel">
        <div className="panel__encabezado">
          <h3>Padrón de clientes</h3>
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
        {clientes.length ? (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Contacto</th>
                  <th>Límite</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>{cliente.nombre}</td>
                    <td>
                      {cliente.numero_documento
                        ? `${cliente.tipo_documento || ''} ${cliente.numero_documento}`
                        : '—'}
                    </td>
                    <td>
                      {cliente.telefono || cliente.correo_electronico || '—'}
                    </td>
                    <td>
                      {cliente.credito_habilitado
                        ? moneda(cliente.limite_credito)
                        : 'No habilitado'}
                    </td>
                    <td
                      className={
                        Number(cliente.vencido) > 0 ? 'cantidad-baja' : ''
                      }
                    >
                      {moneda(cliente.saldo)}
                    </td>
                    <td>
                      <span
                        className={
                          cliente.esta_activo
                            ? 'estado-activo'
                            : 'estado-inactivo'
                        }
                      >
                        {cliente.esta_activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="acciones-tabla">
                        {verCuenta && (
                          <button
                            className="boton-tabla"
                            onClick={() => abrirCuenta(cliente)}
                          >
                            Cuenta
                          </button>
                        )}
                        {gestionar && (
                          <button
                            className="boton-tabla"
                            onClick={() => {
                              setEditado(cliente);
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
          <p className="vacio">Todavía no hay clientes para mostrar.</p>
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
        titulo={editado ? 'Editar cliente' : 'Nuevo cliente'}
        ancho="grande"
        alCerrar={cerrarEdicion}
      >
        <Formulario
          key={editado?.id || 'nuevo'}
          cliente={editado}
          alGuardar={guardar}
          alCancelar={cerrarEdicion}
        />
      </Modal>
      <Modal
        abierto={Boolean(cuenta)}
        titulo={
          cuenta ? `Cuenta corriente · ${cuenta.nombre}` : 'Cuenta corriente'
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
                <span>Límite</span>
                <strong>{moneda(cuenta.limite_credito)}</strong>
              </div>
              <div>
                <span>Disponible</span>
                <strong>{moneda(cuenta.disponible)}</strong>
              </div>
            </div>
            <h3>Ventas pendientes</h3>
            {cuenta.ventas.length ? (
              <div className="tabla-contenedor tabla-cuenta">
                <table>
                  <thead>
                    <tr>
                      <th>Venta</th>
                      <th>Fecha</th>
                      <th>Vencimiento</th>
                      <th>Total</th>
                      <th>Saldo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuenta.ventas.map((venta) => (
                      <tr key={venta.id}>
                        <td>#{venta.id}</td>
                        <td>{formatearFecha(venta.fecha_creacion)}</td>
                        <td>{formatearFecha(venta.fecha_vencimiento)}</td>
                        <td>{moneda(venta.total)}</td>
                        <td>{moneda(venta.saldo_pendiente)}</td>
                        <td>
                          <span
                            className={
                              venta.estado_cuenta === 'vencida'
                                ? 'estado-deuda-vencida'
                                : 'estado-activo'
                            }
                          >
                            {venta.estado_cuenta}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="vacio">El cliente no tiene ventas pendientes.</p>
            )}
            <h3>Movimientos</h3>
            {cuenta.movimientos.length ? (
              <div className="tabla-contenedor tabla-cuenta">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Detalle</th>
                      <th>Usuario</th>
                      <th>Debe</th>
                      <th>Haber</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuenta.movimientos.map((movimiento) => (
                      <tr key={movimiento.id}>
                        <td>{formatearFechaHora(movimiento.fecha_creacion)}</td>
                        <td>{movimiento.descripcion}</td>
                        <td>{movimiento.nombre_usuario}</td>
                        <td>
                          {Number(movimiento.debe)
                            ? moneda(movimiento.debe)
                            : '—'}
                        </td>
                        <td>
                          {Number(movimiento.haber)
                            ? moneda(movimiento.haber)
                            : '—'}
                        </td>
                        <td>
                          {movimiento.referencia_tipo === 'cobranza' && (
                            <button
                              className="boton-tabla"
                              onClick={() =>
                                abrirComprobante(movimiento.referencia_id)
                              }
                            >
                              Comprobante
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="vacio">Todavía no tiene movimientos.</p>
            )}
            <div className="modal__acciones">
              <button
                className="boton boton--secundario"
                onClick={() => setCuenta(null)}
              >
                Cerrar
              </button>
              {puedeCobrar && cuenta.saldo > 0 && (
                <button className="boton" onClick={() => setCobrar(true)}>
                  Registrar cobranza
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        abierto={cobrar}
        titulo="Registrar cobranza"
        alCerrar={() => {
          if (!procesando) setCobrar(false);
        }}
      >
        <form className="formulario-modal" onSubmit={registrarCobranza}>
          <p>
            Cliente: <strong>{cuenta?.nombre}</strong>
          </p>
          <p>
            Saldo actual: <strong>{moneda(cuenta?.saldo || 0)}</strong>
          </p>
          <div>
            <label>Monto recibido</label>
            <input
              name="monto"
              type="number"
              min="0.01"
              max={cuenta?.saldo}
              step="0.01"
              defaultValue={cuenta?.saldo}
              onFocus={(evento) => evento.currentTarget.select()}
              required
              autoFocus
            />
          </div>
          <div>
            <label>Medio de cobro</label>
            <select name="medio">
              <option value="efectivo">Efectivo</option>
              <option value="debito">Tarjeta de débito</option>
              <option value="credito">Tarjeta de crédito</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
          <div>
            <label>Observaciones</label>
            <textarea name="observaciones" maxLength="255" rows="2" />
          </div>
          <div className="modal__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              disabled={procesando}
              onClick={() => setCobrar(false)}
            >
              Cancelar
            </button>
            <button className="boton" disabled={procesando}>
              {procesando ? 'Registrando…' : 'Confirmar cobranza'}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        abierto={Boolean(comprobante)}
        titulo={
          comprobante
            ? `Comprobante de cobranza #${comprobante.id}`
            : 'Comprobante'
        }
        alCerrar={() => setComprobante(null)}
      >
        <div className="comprobante-venta comprobante-cobranza">
          <div className="encabezado-ticket">
            <img
              src="/marca/logo-horizontal-claro.png"
              alt="La 91 Supermercado"
            />
            <p>Comprobante interno no fiscal</p>
          </div>
          {comprobante && (
            <>
              <p>
                <strong>Cliente:</strong> {comprobante.cliente}
              </p>
              <p>
                <strong>Fecha:</strong>{' '}
                {formatearFechaHora(comprobante.fecha_creacion)}
              </p>
              <p>
                <strong>Caja:</strong> {comprobante.caja} ·{' '}
                {comprobante.nombre_usuario}
              </p>
              <p>
                <strong>Medio:</strong> {comprobante.medio}
              </p>
              <div className="importe-cobro">
                <span>Total recibido</span>
                <strong>{moneda(comprobante.monto)}</strong>
              </div>
              <h3>Aplicado a</h3>
              {comprobante.aplicaciones.map((item) => (
                <p key={item.venta_id}>
                  Venta #{item.venta_id}: {moneda(item.monto)}
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
