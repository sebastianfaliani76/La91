import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './componentes/Modal.jsx';
import { formatearFechaHora } from './utilidades/fechas.js';
import { Paginacion } from './componentes/Paginacion.jsx';
import { useActualizacionAutomatica } from './hooks/useActualizacionAutomatica.js';

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

export function Inventario({ token, permisos }) {
  const [existencias, setExistencias] = useState([]);
  const [total, setTotal] = useState(0);
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [buscar, setBuscar] = useState('');
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [categoriaId, setCategoriaId] = useState('');
  const [marcaId, setMarcaId] = useState('');
  const [pagina, setPagina] = useState(1);
  const [productoAjuste, setProductoAjuste] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [vista, setVista] = useState('existencias');
  const [movimientos, setMovimientos] = useState([]);
  const [totalMovimientos, setTotalMovimientos] = useState(0);
  const [paginaMovimientos, setPaginaMovimientos] = useState(1);
  const [conteoRapido, setConteoRapido] = useState(null);
  const buscadorRef = useRef(null);
  const cargaStockId = useRef(0);
  const cargaMovimientosId = useRef(0);
  const [limite, setLimite] = useState(25);
  const puedeAjustar = permisos.includes('stock.ajustar');
  const seleccionarContenido = (evento) => evento.currentTarget.select();

  const cargar = useCallback(async () => {
    const solicitudId = ++cargaStockId.current;
    try {
      const parametros = new URLSearchParams({
        pagina: String(pagina),
        limite: String(limite),
        solo_bajo_minimo: String(soloBajoMinimo),
      });
      if (buscar) parametros.set('buscar', buscar);
      if (categoriaId) parametros.set('categoria_id', categoriaId);
      if (marcaId) parametros.set('marca_id', marcaId);
      const [respuesta, respuestaCategorias, respuestaReferencias] =
        await Promise.all([
          solicitar(`/api/inventario/stock?${parametros}`, token),
          solicitar('/api/catalogo/categorias', token),
          solicitar('/api/catalogo/referencias', token),
        ]);
      if (solicitudId !== cargaStockId.current) return;
      setExistencias(respuesta.datos);
      setTotal(respuesta.total);
      setCategorias(respuestaCategorias.datos);
      setMarcas(respuestaReferencias.marcas);
    } catch (error) {
      if (solicitudId !== cargaStockId.current) return;
      setMensaje(error.message);
    }
  }, [token, pagina, limite, buscar, soloBajoMinimo, categoriaId, marcaId]);

  const cargarMovimientos = useCallback(async () => {
    const solicitudId = ++cargaMovimientosId.current;
    try {
      const respuesta = await solicitar(
        `/api/inventario/movimientos?pagina=${paginaMovimientos}&limite=${limite}`,
        token,
      );
      if (solicitudId !== cargaMovimientosId.current) return;
      setMovimientos(respuesta.datos);
      setTotalMovimientos(respuesta.total);
    } catch (error) {
      if (solicitudId !== cargaMovimientosId.current) return;
      setMensaje(error.message);
    }
  }, [token, paginaMovimientos, limite]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    if (vista === 'movimientos') cargarMovimientos();
  }, [vista, cargarMovimientos]);
  useActualizacionAutomatica(() => {
    if (vista === 'existencias') cargar();
    else cargarMovimientos();
  });
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setPagina(1);
      setBuscar(textoBusqueda.trim());
    }, 300);
    return () => clearTimeout(temporizador);
  }, [textoBusqueda]);
  useEffect(() => {
    if (buscar.length >= 8 && /^\d+$/.test(buscar) && total === 0) {
      buscadorRef.current?.focus();
      buscadorRef.current?.select();
    }
  }, [buscar, total]);

  function prepararSiguienteBusqueda() {
    requestAnimationFrame(() => {
      buscadorRef.current?.focus();
      buscadorRef.current?.select();
    });
  }

  async function guardarAjuste(evento) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    try {
      await solicitar('/api/inventario/ajustes', token, {
        method: 'POST',
        body: JSON.stringify({
          producto_id: productoAjuste.producto_id,
          ubicacion_id: productoAjuste.ubicacion_id,
          cantidad_nueva: Number(formulario.get('cantidad_nueva')),
          motivo: formulario.get('motivo'),
        }),
      });
      setProductoAjuste(null);
      setMensaje('Stock ajustado y movimiento registrado.');
      await cargar();
      prepararSiguienteBusqueda();
    } catch (error) {
      setMensaje(error.message);
    }
  }

  function abrirConteoRapido() {
    setConteoRapido(
      Object.fromEntries(
        existencias.map((item) => [
          item.producto_id,
          String(Number(item.cantidad)),
        ]),
      ),
    );
  }

  async function guardarConteoRapido(evento) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const ajustes = existencias
      .filter(
        (item) =>
          Number(conteoRapido[item.producto_id]) !== Number(item.cantidad),
      )
      .map((item) => ({
        producto_id: item.producto_id,
        cantidad_nueva: Number(conteoRapido[item.producto_id]),
      }));
    try {
      const respuesta = await solicitar(
        '/api/inventario/ajustes-masivos',
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            ubicacion_id: existencias[0].ubicacion_id,
            motivo: formulario.get('motivo'),
            ajustes,
          }),
        },
      );
      setConteoRapido(null);
      setMensaje(
        `${respuesta.dato.productos_actualizados} productos actualizados y movimiento registrado.`,
      );
      await cargar();
    } catch (error) {
      setMensaje(error.message);
    }
  }

  const paginas = Math.max(1, Math.ceil(total / limite));
  const paginasMovimientos = Math.max(1, Math.ceil(totalMovimientos / limite));
  const cambiosConteo = conteoRapido
    ? existencias.filter(
        (item) =>
          conteoRapido[item.producto_id] !== '' &&
          Number(conteoRapido[item.producto_id]) !== Number(item.cantidad),
      ).length
    : 0;

  return (
    <section className="modulo">
      <div className="modulo__encabezado">
        <div>
          <p className="etiqueta">INVENTARIO</p>
          <h2>Existencias del local</h2>
        </div>
        {vista === 'existencias' && puedeAjustar && existencias.length > 0 && (
          <button className="boton" onClick={abrirConteoRapido}>
            Carga rápida
          </button>
        )}
      </div>
      <div className="selector-vista">
        <button
          className={vista === 'existencias' ? 'activo' : ''}
          onClick={() => setVista('existencias')}
        >
          Existencias
        </button>
        <button
          className={vista === 'movimientos' ? 'activo' : ''}
          onClick={() => setVista('movimientos')}
        >
          Movimientos
        </button>
      </div>
      {mensaje && (
        <p className="mensaje" role="status">
          {mensaje}
        </p>
      )}

      {vista === 'existencias' ? (
        <>
          <div className="barra-filtros" role="search">
            <input
              ref={buscadorRef}
              value={textoBusqueda}
              onFocus={seleccionarContenido}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter') {
                  evento.preventDefault();
                  evento.currentTarget.select();
                }
              }}
              onChange={(evento) => setTextoBusqueda(evento.target.value)}
              placeholder="Buscar por producto o código de barras"
            />
            <select
              aria-label="Filtrar por marca"
              value={marcaId}
              onChange={(evento) => {
                setMarcaId(evento.target.value);
                setPagina(1);
              }}
            >
              <option value="">Todas las marcas</option>
              {marcas.map((marca) => (
                <option key={marca.id} value={marca.id}>
                  {marca.nombre}
                </option>
              ))}
            </select>
            <label className="filtro-verificacion">
              <input
                type="checkbox"
                checked={soloBajoMinimo}
                onChange={(evento) => {
                  setSoloBajoMinimo(evento.target.checked);
                  setPagina(1);
                }}
              />{' '}
              Solo bajo mínimo
            </label>
          </div>
          <p className="filtro-activo">
            Mostrando {total.toLocaleString('es-AR')}{' '}
            {buscar || categoriaId || marcaId || soloBajoMinimo
              ? 'resultados'
              : 'productos'}
            {soloBajoMinimo ? ' bajo el mínimo' : ''}
            {buscar ? ` para “${buscar}”` : ''}
            {categoriaId
              ? ` en ${categorias.find((categoria) => String(categoria.id) === categoriaId)?.nombre ?? 'la categoría seleccionada'}`
              : ''}
            {marcaId
              ? `. Marca: ${marcas.find((marca) => String(marca.id) === marcaId)?.nombre ?? 'seleccionada'}`
              : ''}
            .
          </p>
          <div className="rejilla-catalogo">
            <article className="panel">
              <h3>Categorías</h3>
              <nav
                className="lista-categorias"
                aria-label="Filtrar por categoría"
              >
                <button
                  type="button"
                  className={!categoriaId ? 'categoria-activa' : ''}
                  onClick={() => {
                    setCategoriaId('');
                    setPagina(1);
                  }}
                >
                  <span className="icono-todas">≡</span>
                  <span>Todas</span>
                </button>
                {categorias.map((categoria) => (
                  <button
                    type="button"
                    key={categoria.id}
                    className={
                      categoriaId === String(categoria.id)
                        ? 'categoria-activa'
                        : ''
                    }
                    onClick={() => {
                      setCategoriaId(String(categoria.id));
                      setPagina(1);
                    }}
                  >
                    {categoria.icono_url && (
                      <img src={categoria.icono_url} alt="" />
                    )}
                    <span>{categoria.nombre}</span>
                  </button>
                ))}
              </nav>
            </article>
            <article className="panel panel--productos">
              <div className="panel__encabezado">
                <h3>Stock actual</h3>
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
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Producto</th>
                      <th>Código</th>
                      <th>Existencia</th>
                      <th>Reservado</th>
                      <th>Disponible</th>
                      <th>Mínimo</th>
                      {puedeAjustar && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {existencias.map((item) => {
                      const disponible = Math.max(
                        0,
                        Number(item.cantidad) - Number(item.cantidad_reservada),
                      );
                      return (
                        <tr key={item.producto_id}>
                          <td>
                            {item.imagen_url ? (
                              <img
                                className="miniatura-producto"
                                src={item.imagen_url}
                                alt=""
                              />
                            ) : (
                              <span className="miniatura-vacia" />
                            )}
                          </td>
                          <td>{item.nombre}</td>
                          <td>{item.codigo_barra}</td>
                          <td>
                            {Number(item.cantidad).toLocaleString('es-AR')}
                          </td>
                          <td
                            className={
                              Number(item.cantidad_reservada) > 0
                                ? 'cantidad-reservada'
                                : ''
                            }
                          >
                            {Number(item.cantidad_reservada).toLocaleString(
                              'es-AR',
                            )}
                          </td>
                          <td
                            className={
                              disponible < Number(item.stock_minimo)
                                ? 'cantidad-baja'
                                : ''
                            }
                          >
                            {disponible.toLocaleString('es-AR')}
                          </td>
                          <td>
                            {Number(item.stock_minimo).toLocaleString('es-AR')}
                          </td>
                          {puedeAjustar && (
                            <td>
                              <button
                                className="boton-tabla"
                                onClick={() => setProductoAjuste(item)}
                              >
                                Ajustar
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
          </div>
        </>
      ) : (
        <>
          <p className="filtro-activo">
            Mostrando {totalMovimientos.toLocaleString('es-AR')} movimientos
            registrados.
          </p>
          <article className="panel">
            <div className="panel__encabezado">
              <h3>Historial de movimientos</h3>
              <span>
                Página {paginaMovimientos} de {paginasMovimientos}
              </span>
            </div>
            <div className="paginacion--superior">
              <Paginacion
                pagina={paginaMovimientos}
                paginas={paginasMovimientos}
                limite={limite}
                alCambiarPagina={setPaginaMovimientos}
                alCambiarLimite={(v) => {
                  setLimite(v);
                  setPagina(1);
                  setPaginaMovimientos(1);
                }}
              />
            </div>
            {movimientos.length ? (
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Producto</th>
                      <th>Usuario</th>
                      <th>Anterior</th>
                      <th>Variación</th>
                      <th>Nueva</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((movimiento) => (
                      <tr key={movimiento.id}>
                        <td>{formatearFechaHora(movimiento.fecha_creacion)}</td>
                        <td>{movimiento.producto}</td>
                        <td>{movimiento.nombre_usuario}</td>
                        <td>
                          {Number(movimiento.cantidad_anterior).toLocaleString(
                            'es-AR',
                          )}
                        </td>
                        <td
                          className={
                            Number(movimiento.variacion) < 0
                              ? 'variacion-negativa'
                              : 'variacion-positiva'
                          }
                        >
                          {Number(movimiento.variacion) > 0 ? '+' : ''}
                          {Number(movimiento.variacion).toLocaleString('es-AR')}
                        </td>
                        <td>
                          {Number(movimiento.cantidad_nueva).toLocaleString(
                            'es-AR',
                          )}
                        </td>
                        <td>{movimiento.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="vacio">
                Todavía no hay movimientos. Se registrarán cuando realices el
                primer ajuste o una operación de stock.
              </p>
            )}
            <Paginacion
              pagina={paginaMovimientos}
              paginas={paginasMovimientos}
              limite={limite}
              alCambiarPagina={setPaginaMovimientos}
              alCambiarLimite={(v) => {
                setLimite(v);
                setPagina(1);
                setPaginaMovimientos(1);
              }}
            />
          </article>
        </>
      )}

      <Modal
        abierto={Boolean(productoAjuste)}
        titulo="Ajustar stock"
        alCerrar={() => setProductoAjuste(null)}
      >
        {productoAjuste && (
          <form className="formulario-modal" onSubmit={guardarAjuste}>
            <p>
              <strong>{productoAjuste.nombre}</strong>
            </p>
            <p>
              Stock actual:{' '}
              {Number(productoAjuste.cantidad).toLocaleString('es-AR')}
            </p>
            <div>
              <label htmlFor="cantidad_nueva">Cantidad física contada</label>
              <input
                id="cantidad_nueva"
                name="cantidad_nueva"
                type="number"
                min="0"
                step={productoAjuste.es_pesable ? '0.001' : '1'}
                defaultValue={productoAjuste.cantidad}
                onFocus={seleccionarContenido}
                required
              />
            </div>
            <div>
              <label htmlFor="motivo_ajuste">Motivo del ajuste</label>
              <textarea
                id="motivo_ajuste"
                name="motivo"
                minLength="5"
                maxLength="255"
                rows="3"
                defaultValue="Carga inicial de existencias"
                onFocus={seleccionarContenido}
                required
              />
            </div>
            <div className="modal__acciones">
              <button
                type="button"
                className="boton boton--secundario"
                onClick={() => setProductoAjuste(null)}
              >
                Cancelar
              </button>
              <button className="boton">Registrar ajuste</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        abierto={Boolean(conteoRapido)}
        titulo="Carga rápida de existencias"
        ancho="grande"
        alCerrar={() => setConteoRapido(null)}
      >
        {conteoRapido && (
          <form
            className="formulario-modal formulario-conteo"
            onSubmit={guardarConteoRapido}
          >
            <p>
              Ingresá las cantidades contadas de los productos visibles en esta
              página. Solo se registrarán las que cambies.
            </p>
            <div className="tabla-contenedor tabla-conteo">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Actual</th>
                    <th>Cantidad contada</th>
                  </tr>
                </thead>
                <tbody>
                  {existencias.map((item) => (
                    <tr key={item.producto_id}>
                      <td>{item.nombre}</td>
                      <td>{Number(item.cantidad).toLocaleString('es-AR')}</td>
                      <td>
                        <input
                          aria-label={`Cantidad contada de ${item.nombre}`}
                          type="number"
                          min="0"
                          step={item.es_pesable ? '0.001' : '1'}
                          value={conteoRapido[item.producto_id]}
                          onFocus={seleccionarContenido}
                          onChange={(evento) =>
                            setConteoRapido((actual) => ({
                              ...actual,
                              [item.producto_id]: evento.target.value,
                            }))
                          }
                          required
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <label htmlFor="motivo_conteo">Motivo</label>
              <input
                id="motivo_conteo"
                name="motivo"
                defaultValue="Carga inicial de existencias"
                minLength="5"
                maxLength="255"
                onFocus={seleccionarContenido}
                required
              />
            </div>
            <div className="modal__acciones">
              <span className="resumen-cambios">
                {cambiosConteo} {cambiosConteo === 1 ? 'cambio' : 'cambios'}
              </span>
              <button
                type="button"
                className="boton boton--secundario"
                onClick={() => setConteoRapido(null)}
              >
                Cancelar
              </button>
              <button className="boton" disabled={!cambiosConteo}>
                Registrar cantidades
              </button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
