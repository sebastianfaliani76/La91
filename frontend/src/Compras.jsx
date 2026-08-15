import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './componentes/Modal.jsx';
import { Paginacion } from './componentes/Paginacion.jsx';
import { formatearFecha } from './utilidades/fechas.js';

const fechaHoy = () => {
  const ahora = new Date();
  const desplazamiento = ahora.getTimezoneOffset() * 60000;
  return new Date(ahora.getTime() - desplazamiento).toISOString().slice(0, 10);
};

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

export function Compras({ token, permisos }) {
  const [compras, setCompras] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState('todos');
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [referencias, setReferencias] = useState({
    proveedores: [],
    productos: [],
  });
  const [modal, setModal] = useState(false);
  const [items, setItems] = useState([]);
  const [ordenActual, setOrdenActual] = useState(null);
  const [compraARecibir, setCompraARecibir] = useState(null);
  const [recibiendo, setRecibiendo] = useState(false);
  const [cantidadesRecepcion, setCantidadesRecepcion] = useState({});
  const [accionCompra, setAccionCompra] = useState(null);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [resultadoActivo, setResultadoActivo] = useState(-1);
  const buscadorProductoRef = useRef(null);
  const [limite, setLimite] = useState(25);

  const cargar = useCallback(async () => {
    try {
      const parametros = new URLSearchParams({
        pagina: String(pagina),
        limite: String(limite),
        estado,
      });
      if (buscar) parametros.set('buscar', buscar);
      const [respuestaCompras, respuestaReferencias] = await Promise.all([
        pedir(`/api/compras?${parametros}`, token),
        pedir('/api/compras/referencias', token),
      ]);
      setCompras(respuestaCompras.datos);
      setTotal(respuestaCompras.total);
      setReferencias(respuestaReferencias);
    } catch (error) {
      setMensaje(error.message);
    }
  }, [token, pagina, limite, estado, buscar]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setPagina(1);
      setBuscar(texto.trim());
    }, 300);
    return () => clearTimeout(temporizador);
  }, [texto]);

  const resultados = useMemo(() => {
    const termino = busquedaProducto.trim().toLocaleLowerCase('es');
    if (termino.length < 2) return [];
    return referencias.productos
      .filter((producto) =>
        `${producto.nombre} ${producto.codigo_barra || ''}`
          .toLocaleLowerCase('es')
          .includes(termino),
      )
      .slice(0, 12);
  }, [busquedaProducto, referencias.productos]);
  useEffect(() => {
    if (resultadoActivo >= 0)
      document
        .getElementById(`resultado-compra-${resultados[resultadoActivo]?.id}`)
        ?.scrollIntoView({ block: 'nearest' });
  }, [resultadoActivo, resultados]);

  function agregar(producto) {
    setItems((actual) => {
      const existente = actual.find((item) => item.producto_id === producto.id);
      const restantes = actual.filter(
        (item) => item.producto_id !== producto.id,
      );
      if (existente)
        return [
          { ...existente, cantidad: Number(existente.cantidad) + 1 },
          ...restantes,
        ];
      return [
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          codigo_barra: producto.codigo_barra,
          es_pesable: producto.es_pesable,
          cantidad: 1,
          costo_unitario: Number(producto.precio_costo),
        },
        ...actual,
      ];
    });
    setBusquedaProducto('');
    setResultadoActivo(-1);
    requestAnimationFrame(() => buscadorProductoRef.current?.focus());
  }
  function navegarProductos(evento) {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      if (resultados.length)
        setResultadoActivo((actual) =>
          actual >= resultados.length - 1 ? -1 : actual + 1,
        );
      return;
    }
    if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (resultados.length)
        setResultadoActivo((actual) =>
          actual === -1
            ? resultados.length - 1
            : actual === 0
              ? -1
              : actual - 1,
        );
      return;
    }
    if (evento.key === 'Escape') {
      setResultadoActivo(-1);
      return;
    }
    if (evento.key !== 'Enter') return;
    evento.preventDefault();
    const exacto = resultados.find(
      (producto) => producto.codigo_barra === busquedaProducto.trim(),
    );
    const producto = exacto || resultados[resultadoActivo] || resultados[0];
    if (producto) agregar(producto);
  }
  function cambiar(id, campo, valor) {
    setItems((actual) =>
      actual.map((item) =>
        item.producto_id === id ? { ...item, [campo]: valor } : item,
      ),
    );
  }
  function cerrarModal() {
    setModal(false);
    setItems([]);
    setBusquedaProducto('');
    setResultadoActivo(-1);
    setOrdenActual(null);
  }
  async function abrirOrden(compra) {
    try {
      const respuesta = await pedir(`/api/compras/${compra.id}`, token);
      setOrdenActual(respuesta.dato);
      setItems(
        respuesta.dato.detalles.map((item) => ({
          ...item,
          cantidad: Number(item.cantidad),
          costo_unitario: Number(item.costo_unitario),
        })),
      );
      setModal(true);
    } catch (error) {
      setMensaje(error.message);
    }
  }

  async function guardar(evento) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    try {
      const ruta = ordenActual
        ? `/api/compras/${ordenActual.id}`
        : '/api/compras';
      await pedir(ruta, token, {
        method: ordenActual ? 'PUT' : 'POST',
        body: JSON.stringify({
          proveedor_id: Number(formulario.get('proveedor_id')),
          fecha_esperada: formulario.get('fecha_esperada') || null,
          observaciones: formulario.get('observaciones') || null,
          detalles: items.map((item) => ({
            producto_id: item.producto_id,
            cantidad: Number(item.cantidad),
            costo_unitario: Number(item.costo_unitario),
          })),
        }),
      });
      const fueEdicion = Boolean(ordenActual);
      cerrarModal();
      setMensaje(
        fueEdicion
          ? 'Orden actualizada correctamente.'
          : 'Orden de compra creada como borrador.',
      );
      await cargar();
    } catch (error) {
      setMensaje(error.message);
    }
  }
  async function recibir() {
    setRecibiendo(true);
    try {
      const detalles = compraARecibir.detalles
        .filter((item) => Number(cantidadesRecepcion[item.producto_id]) > 0)
        .map((item) => ({
          producto_id: item.producto_id,
          cantidad: Number(cantidadesRecepcion[item.producto_id]),
        }));
      const respuesta = await pedir(
        `/api/compras/${compraARecibir.id}/recibir`,
        token,
        { method: 'POST', body: JSON.stringify({ detalles }) },
      );
      setCompraARecibir(null);
      setMensaje(
        `${respuesta.dato.productos_recibidos} productos ingresaron al stock.`,
      );
      await cargar();
    } catch (error) {
      setCompraARecibir(null);
      setMensaje(error.message);
    } finally {
      setRecibiendo(false);
    }
  }
  async function prepararRecepcion(compra) {
    try {
      const respuesta = await pedir(`/api/compras/${compra.id}`, token);
      const pendientes = Object.fromEntries(
        respuesta.dato.detalles.map((item) => [
          item.producto_id,
          String(Number(item.cantidad) - Number(item.cantidad_recibida)),
        ]),
      );
      setCantidadesRecepcion(pendientes);
      setCompraARecibir(respuesta.dato);
    } catch (error) {
      setMensaje(error.message);
    }
  }
  async function confirmarAccionCompra() {
    setRecibiendo(true);
    try {
      await pedir(
        `/api/compras/${accionCompra.compra.id}/${accionCompra.accion}`,
        token,
        { method: 'POST' },
      );
      setMensaje(
        accionCompra.accion === 'enviar'
          ? 'Orden enviada al proveedor.'
          : 'Orden cancelada correctamente.',
      );
      setAccionCompra(null);
      await cargar();
    } catch (error) {
      setMensaje(error.message);
      setAccionCompra(null);
    } finally {
      setRecibiendo(false);
    }
  }

  const paginas = Math.max(1, Math.ceil(total / limite));
  const totalOrden = items.reduce(
    (suma, item) =>
      suma + Number(item.cantidad || 0) * Number(item.costo_unitario || 0),
    0,
  );
  const soloLectura = Boolean(ordenActual && ordenActual.estado !== 'borrador');
  return (
    <section className="modulo">
      <div className="modulo__encabezado">
        <div>
          <p className="etiqueta">COMPRAS</p>
          <h2>Órdenes de compra</h2>
        </div>
        {permisos.includes('compras.gestionar') && (
          <button
            className="boton"
            onClick={() => {
              setOrdenActual(null);
              setItems([]);
              setModal(true);
            }}
          >
            Nueva orden
          </button>
        )}
      </div>
      <div className="barra-filtros">
        <input
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Buscar por número o proveedor"
        />
        <select
          value={estado}
          onChange={(evento) => {
            setEstado(evento.target.value);
            setPagina(1);
          }}
        >
          <option value="todos">Todos los estados</option>
          <option value="borrador">Borradores</option>
          <option value="enviada">Enviadas</option>
          <option value="parcial">Recepción parcial</option>
          <option value="recibida">Recibidas</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </div>
      <p className="filtro-activo">Mostrando {total} órdenes.</p>
      {mensaje && <p className="mensaje">{mensaje}</p>}
      <article className="panel">
        <div className="panel__encabezado">
          <h3>Compras</h3>
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
        {compras.length ? (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Creación</th>
                  <th>Entrega esperada</th>
                  <th>Recepción</th>
                  <th>Proveedor</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {compras.map((compra) => (
                  <tr key={compra.id}>
                    <td>#{compra.id}</td>
                    <td>{formatearFecha(compra.fecha_creacion)}</td>
                    <td>
                      {compra.fecha_esperada
                        ? formatearFecha(compra.fecha_esperada)
                        : '—'}
                    </td>
                    <td>
                      {compra.fecha_recepcion
                        ? formatearFecha(compra.fecha_recepcion)
                        : '—'}
                    </td>
                    <td>{compra.proveedor}</td>
                    <td>{compra.productos}</td>
                    <td>
                      $
                      {Number(compra.total).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <span className="estado-activo">{compra.estado}</span>
                    </td>
                    <td className="acciones-tabla">
                      <button
                        className="boton-tabla"
                        onClick={() => abrirOrden(compra)}
                      >
                        {compra.estado === 'borrador' ? 'Editar' : 'Ver'}
                      </button>
                      {compra.estado === 'borrador' &&
                        permisos.includes('compras.gestionar') && (
                          <button
                            className="boton-tabla"
                            onClick={() =>
                              setAccionCompra({ compra, accion: 'enviar' })
                            }
                          >
                            Enviar
                          </button>
                        )}
                      {['enviada', 'parcial'].includes(compra.estado) &&
                        permisos.includes('compras.gestionar') && (
                          <button
                            className="boton-tabla"
                            onClick={() => prepararRecepcion(compra)}
                          >
                            Recibir
                          </button>
                        )}
                      {['borrador', 'enviada'].includes(compra.estado) &&
                        permisos.includes('compras.gestionar') && (
                          <button
                            className="boton-tabla"
                            onClick={() =>
                              setAccionCompra({ compra, accion: 'cancelar' })
                            }
                          >
                            Cancelar
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vacio">Todavía no hay órdenes de compra.</p>
        )}
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
      </article>
      <Modal
        abierto={modal}
        titulo={
          ordenActual
            ? `${soloLectura ? 'Detalle' : 'Editar'} compra #${ordenActual.id}`
            : 'Nueva orden de compra'
        }
        ancho="grande"
        alCerrar={cerrarModal}
      >
        <form className="formulario-modal" onSubmit={guardar}>
          {ordenActual && (
            <div className="detalle-estado">
              <span>
                Estado:{' '}
                <strong className="estado-activo">{ordenActual.estado}</strong>
              </span>
              <span>
                Entrega esperada:{' '}
                <strong>
                  {ordenActual.fecha_esperada
                    ? formatearFecha(ordenActual.fecha_esperada)
                    : '—'}
                </strong>
              </span>
              <span>
                Recepción efectiva:{' '}
                <strong>
                  {ordenActual.fecha_recepcion
                    ? formatearFecha(ordenActual.fecha_recepcion)
                    : '—'}
                </strong>
              </span>
            </div>
          )}
          <div className="campos-producto">
            <div className="campo">
              <label>Proveedor</label>
              <select
                name="proveedor_id"
                required
                defaultValue={ordenActual?.proveedor_id ?? ''}
                disabled={soloLectura}
              >
                <option value="" disabled>
                  Seleccionar
                </option>
                {referencias.proveedores.map((proveedor) => (
                  <option key={proveedor.id} value={proveedor.id}>
                    {proveedor.nombre_fantasia || proveedor.razon_social}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label>Entrega esperada</label>
              <input
                name="fecha_esperada"
                type="date"
                defaultValue={
                  ordenActual?.fecha_esperada?.slice(0, 10) ?? fechaHoy()
                }
                disabled={soloLectura}
              />
            </div>
          </div>
          {!soloLectura && (
            <div className="buscador-productos-compra">
              <label htmlFor="buscar_producto_compra">Buscar productos</label>
              <input
                ref={buscadorProductoRef}
                id="buscar_producto_compra"
                role="combobox"
                aria-expanded={resultados.length > 0}
                aria-controls="resultados-busqueda-compra"
                aria-activedescendant={
                  resultadoActivo >= 0
                    ? `resultado-compra-${resultados[resultadoActivo]?.id}`
                    : undefined
                }
                value={busquedaProducto}
                onChange={(evento) => {
                  setBusquedaProducto(evento.target.value);
                  setResultadoActivo(-1);
                }}
                onKeyDown={navegarProductos}
                placeholder="Escribí nombre o código de barras"
                autoComplete="off"
              />
              <small className="ayuda-buscador">
                ↑/↓ para elegir · Enter para agregar
              </small>
              {resultados.length > 0 && (
                <div
                  id="resultados-busqueda-compra"
                  role="listbox"
                  className="resultados-productos"
                >
                  {resultados.map((producto, indice) => (
                    <button
                      id={`resultado-compra-${producto.id}`}
                      role="option"
                      aria-selected={resultadoActivo === indice}
                      type="button"
                      key={producto.id}
                      className={
                        resultadoActivo === indice ? 'resultado-activo' : ''
                      }
                      onMouseEnter={() => setResultadoActivo(indice)}
                      onClick={() => agregar(producto)}
                    >
                      <span>{producto.nombre}</span>
                      <small>
                        {producto.codigo_barra || 'Sin código'} · Costo $
                        {Number(producto.precio_costo).toLocaleString('es-AR', {
                          minimumFractionDigits: 2,
                        })}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {items.length ? (
            <div className="tabla-contenedor tabla-items-compra">
              <table>
                <thead>
                  <tr>
                    <th>Producto agregado</th>
                    <th>Cantidad</th>
                    {soloLectura && (
                      <>
                        <th>Recibida</th>
                        <th>Pendiente</th>
                      </>
                    )}
                    <th>Costo unitario</th>
                    <th>Subtotal</th>
                    {!soloLectura && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.producto_id}>
                      <td>
                        {item.nombre}
                        <small className="dato-secundario">
                          {item.codigo_barra || 'Sin código'}
                        </small>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={item.es_pesable ? '0.001' : '1'}
                          step={item.es_pesable ? '0.001' : '1'}
                          value={item.cantidad}
                          disabled={soloLectura}
                          onFocus={(evento) => evento.currentTarget.select()}
                          onChange={(evento) =>
                            cambiar(
                              item.producto_id,
                              'cantidad',
                              evento.target.value,
                            )
                          }
                          required
                        />
                      </td>
                      {soloLectura && (
                        <>
                          <td>
                            {Number(item.cantidad_recibida).toLocaleString(
                              'es-AR',
                            )}
                          </td>
                          <td>
                            {(
                              Number(item.cantidad) -
                              Number(item.cantidad_recibida)
                            ).toLocaleString('es-AR')}
                          </td>
                        </>
                      )}
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.costo_unitario}
                          disabled={soloLectura}
                          onFocus={(evento) => evento.currentTarget.select()}
                          onChange={(evento) =>
                            cambiar(
                              item.producto_id,
                              'costo_unitario',
                              evento.target.value,
                            )
                          }
                          required
                        />
                      </td>
                      <td>
                        $
                        {(
                          Number(item.cantidad) * Number(item.costo_unitario)
                        ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      {!soloLectura && (
                        <td>
                          <button
                            type="button"
                            className="boton-tabla"
                            onClick={() =>
                              setItems((actual) =>
                                actual.filter(
                                  (otro) =>
                                    otro.producto_id !== item.producto_id,
                                ),
                              )
                            }
                          >
                            Quitar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="vacio">Buscá y agregá al menos un producto.</p>
          )}
          <div>
            <label>Observaciones</label>
            <textarea
              name="observaciones"
              maxLength="500"
              rows="2"
              defaultValue={ordenActual?.observaciones ?? ''}
              disabled={soloLectura}
            />
          </div>
          <p className="total-compra">
            Total:{' '}
            <strong>
              $
              {totalOrden.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </strong>
          </p>
          <div className="modal__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              onClick={cerrarModal}
            >
              {soloLectura ? 'Cerrar' : 'Cancelar'}
            </button>
            {!soloLectura && (
              <button className="boton" disabled={!items.length}>
                {ordenActual ? 'Guardar cambios' : 'Crear borrador'}
              </button>
            )}
          </div>
        </form>
      </Modal>
      <Modal
        abierto={Boolean(compraARecibir)}
        titulo="Registrar recepción"
        ancho="grande"
        alCerrar={() => {
          if (!recibiendo) setCompraARecibir(null);
        }}
      >
        {compraARecibir && (
          <div className="confirmacion-modal">
            <p>
              Ingresá las cantidades recibidas de la compra{' '}
              <strong>#{compraARecibir.id}</strong>. Podés dejar productos en
              cero para recibirlos más adelante.
            </p>
            <div className="tabla-contenedor tabla-items-compra">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Pedido</th>
                    <th>Ya recibido</th>
                    <th>Pendiente</th>
                    <th>Recibir ahora</th>
                  </tr>
                </thead>
                <tbody>
                  {compraARecibir.detalles.map((item) => {
                    const pendiente =
                      Number(item.cantidad) - Number(item.cantidad_recibida);
                    return (
                      <tr key={item.producto_id}>
                        <td>{item.nombre}</td>
                        <td>{Number(item.cantidad).toLocaleString('es-AR')}</td>
                        <td>
                          {Number(item.cantidad_recibida).toLocaleString(
                            'es-AR',
                          )}
                        </td>
                        <td>{pendiente.toLocaleString('es-AR')}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={pendiente}
                            step={item.es_pesable ? '0.001' : '1'}
                            value={cantidadesRecepcion[item.producto_id] ?? 0}
                            onFocus={(evento) => evento.currentTarget.select()}
                            onChange={(evento) =>
                              setCantidadesRecepcion((actual) => ({
                                ...actual,
                                [item.producto_id]: evento.target.value,
                              }))
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="modal__acciones">
              <button
                type="button"
                className="boton boton--secundario"
                disabled={recibiendo}
                onClick={() => setCompraARecibir(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="boton"
                disabled={
                  recibiendo ||
                  !Object.values(cantidadesRecepcion).some(
                    (cantidad) => Number(cantidad) > 0,
                  )
                }
                onClick={recibir}
              >
                {recibiendo ? 'Recibiendo…' : 'Registrar recepción'}
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        abierto={Boolean(accionCompra)}
        titulo={
          accionCompra?.accion === 'enviar' ? 'Enviar orden' : 'Cancelar orden'
        }
        alCerrar={() => {
          if (!recibiendo) setAccionCompra(null);
        }}
      >
        {accionCompra && (
          <div className="confirmacion-modal">
            <p>
              {accionCompra.accion === 'enviar' ? (
                <>
                  La compra <strong>#{accionCompra.compra.id}</strong> quedará
                  enviada y habilitada para recibir mercadería.
                </>
              ) : (
                <>
                  La compra <strong>#{accionCompra.compra.id}</strong> será
                  cancelada y no podrá recibirse.
                </>
              )}
            </p>
            <div className="modal__acciones">
              <button
                className="boton boton--secundario"
                disabled={recibiendo}
                onClick={() => setAccionCompra(null)}
              >
                Volver
              </button>
              <button
                className="boton"
                disabled={recibiendo}
                onClick={confirmarAccionCompra}
              >
                {recibiendo
                  ? 'Procesando…'
                  : accionCompra.accion === 'enviar'
                    ? 'Confirmar envío'
                    : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
