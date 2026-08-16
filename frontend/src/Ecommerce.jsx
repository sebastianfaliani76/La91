import { useEffect, useState } from 'react';
import { Modal } from './componentes/Modal.jsx';
import { ConfiguracionEcommerce } from './componentes/ConfiguracionEcommerce.jsx';
import { PromocionesEcommerce } from './componentes/PromocionesEcommerce.jsx';
import { Paginacion } from './componentes/Paginacion.jsx';
import { useActualizacionAutomatica } from './hooks/useActualizacionAutomatica.js';

const dinero = (n) =>
  Number(n || 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
  });
const fecha = (v) =>
  v ? new Date(v).toLocaleString('es-AR', { hour12: false }) : '—';
const etiquetasEstadoPedido = {
  pendiente_pago: 'Pendiente de pago',
  confirmado: 'Confirmado',
  en_preparacion: 'En preparación',
  listo: 'Listo para despachar',
  en_reparto: 'En reparto',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};
export function Ecommerce({ token, permisos }) {
  const [vista, setVista] = useState('pedidos'),
    [datos, setDatos] = useState([]),
    [total, setTotal] = useState(0),
    [pagina, setPagina] = useState(1),
    [limite, setLimite] = useState(25),
    [buscar, setBuscar] = useState(''),
    [filtro, setFiltro] = useState(''),
    [detalle, setDetalle] = useState(null),
    [mensaje, setMensaje] = useState(''),
    [config, setConfig] = useState(null),
    [cuentas, setCuentas] = useState([]),
    [cobrando, setCobrando] = useState(false),
    [reembolsando, setReembolsando] = useState(false),
    [devolviendo, setDevolviendo] = useState(false),
    [confirmacion, setConfirmacion] = useState(false);
  const api = async (r, o = {}) => {
    const x = await fetch(`/api/ecommerce/admin${r}`, {
        ...o,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }),
      d = await x.json();
    if (!x.ok) throw Error(d.mensaje);
    return d;
  };
  const cargar = async () => {
    try {
      if (vista === 'configuracion') {
        setConfig((await api('/configuracion')).dato);
        return;
      }
      if (vista === 'promociones') return;
      const r =
          vista === 'productos'
            ? `/productos?buscar=${encodeURIComponent(buscar)}&estado=${filtro || 'todos'}&pagina=${pagina}&limite=${limite}`
            : `/pedidos?buscar=${encodeURIComponent(buscar)}&estado=${filtro}&pagina=${pagina}&limite=${limite}`,
        d = await api(r);
      setDatos(d.datos);
      setTotal(d.total);
    } catch (e) {
      setMensaje(e.message);
    }
  };
  useActualizacionAutomatica(async () => {
    await cargar();
    if (detalle) setDetalle((await api(`/pedidos/${detalle.id}`)).dato);
  }, vista === 'pedidos' && !confirmacion && !cobrando && !reembolsando && !devolviendo);
  // La recarga depende exclusivamente de los filtros visibles; `cargar` se redefine al renderizar.
  useEffect(() => {
    const t = setTimeout(cargar, 200);
    return () => clearTimeout(t);
    // La recarga depende exclusivamente de los filtros visibles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, buscar, filtro, pagina, limite]);
  const ver = async (id) => {
    setDetalle((await api(`/pedidos/${id}`)).dato);
    const r = await fetch('/api/tesoreria/cuentas', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) setCuentas((await r.json()).datos || []);
  };
  const avanzar = async (estado) => {
    try {
      await api(`/pedidos/${detalle.id}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ estado }),
      });
      await ver(detalle.id);
      cargar();
    } catch (e) {
      setMensaje(e.message);
    }
  };
  const preparar = async (evento) => {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    try {
      await api(`/pedidos/${detalle.id}/preparacion`, {
        method: 'PUT',
        body: JSON.stringify({
          items: detalle.detalles.map((d) => ({
            detalle_id: d.id,
            cantidad_confirmada: Number(formulario.get(`cantidad-${d.id}`)),
            producto_sustituto_id: null,
            observaciones: formulario.get(`observaciones-${d.id}`),
          })),
        }),
      });
      setMensaje('Preparación actualizada correctamente.');
      await ver(detalle.id);
      cargar();
    } catch (error) {
      setMensaje(error.message);
    }
  };
  const devolver = async (evento) => {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const items = detalle.detalles
      .map((d) => ({
        detalle_id: d.id,
        cantidad: Number(formulario.get(`devolver-${d.id}`)),
        reintegra_stock: formulario.get(`stock-${d.id}`) === 'on',
      }))
      .filter((item) => item.cantidad > 0);
    if (!items.length) {
      setMensaje('Indicá al menos una cantidad para devolver.');
      return;
    }
    try {
      await api(`/pedidos/${detalle.id}/devoluciones`, {
        method: 'POST',
        body: JSON.stringify({
          items,
          cuenta_tesoreria_id: Number(formulario.get('cuenta')),
          motivo: formulario.get('motivo'),
          referencia_externa: formulario.get('referencia'),
        }),
      });
      setDevolviendo(false);
      setMensaje('Devolución parcial y reembolso registrados correctamente.');
      await ver(detalle.id);
      cargar();
    } catch (error) {
      setMensaje(error.message);
    }
  };
  const cobrar = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api(`/pedidos/${detalle.id}/pagos`, {
        method: 'POST',
        body: JSON.stringify({
          proveedor: f.get('proveedor'),
          monto_bruto: Number(f.get('monto')),
          comision: Number(f.get('comision')),
          referencia_externa: f.get('referencia'),
          cuenta_tesoreria_id: Number(f.get('cuenta')),
          idempotencia: `manual-${detalle.id}-${Date.now()}`,
        }),
      });
      setCobrando(false);
      await ver(detalle.id);
      cargar();
    } catch (x) {
      setMensaje(x.message);
    }
  };
  const reembolsar = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pago = detalle.pagos.find((item) => item.estado === 'aprobado');
    if (!pago) {
      setMensaje('No existe un pago aprobado para reembolsar.');
      return;
    }
    try {
      await api(`/pagos/${pago.id}/reembolsos`, {
        method: 'POST',
        body: JSON.stringify({
          monto: Number(f.get('monto')),
          motivo: f.get('motivo'),
          cuenta_tesoreria_id: Number(f.get('cuenta')),
          referencia_externa: f.get('referencia'),
        }),
      });
      setReembolsando(false);
      setMensaje('Reembolso registrado correctamente.');
      await ver(detalle.id);
      cargar();
    } catch (x) {
      setMensaje(x.message);
    }
  };
  const publicar = async (p) => {
    await api(`/productos/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        esta_publicado: !p.esta_publicado,
        nombre_online: null,
        descripcion_online: null,
        precio_online: null,
        stock_seguridad: Number(p.stock_seguridad),
        cantidad_maxima_pedido: p.cantidad_maxima_pedido
          ? Number(p.cantidad_maxima_pedido)
          : null,
        permite_sustitucion: Boolean(p.permite_sustitucion),
        permite_retiro: Boolean(p.permite_retiro),
        permite_envio: Boolean(p.permite_envio),
        es_destacado: Boolean(p.es_destacado),
        orden_destacado: Number(p.orden_destacado || 0),
        imagenes: [],
      }),
    });
    cargar();
  };
  const guardar = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      c = config.configuracion,
      n = (k) => Number(f.get(k)),
      b = (k) => f.get(k) === 'on';
    try {
      await api('/configuracion', {
        method: 'PUT',
        body: JSON.stringify({
          nombre_tienda: f.get('nombre_tienda'),
          esta_activa: b('esta_activa'),
          direccion_origen: f.get('direccion_origen'),
          latitud_origen: f.get('latitud_origen') ? n('latitud_origen') : null,
          longitud_origen: f.get('longitud_origen')
            ? n('longitud_origen')
            : null,
          distancia_maxima_km: n('distancia_maxima_km'),
          pedido_minimo: n('pedido_minimo'),
          envio_gratis_desde: f.get('envio_gratis_desde')
            ? n('envio_gratis_desde')
            : null,
          costo_envio_base: n('costo_envio_base'),
          costo_por_km: n('costo_por_km'),
          minutos_reserva: n('minutos_reserva'),
          permite_retiro: b('permite_retiro'),
          permite_envio: b('permite_envio'),
          permite_efectivo: b('permite_efectivo'),
          permite_transferencia: b('permite_transferencia'),
          permite_mercado_pago: b('permite_mercado_pago'),
          cuenta_mercado_pago_id: c.cuenta_mercado_pago_id,
          telefono_contacto: f.get('telefono_contacto'),
          mensaje_portada: f.get('mensaje_portada'),
        }),
      });
      setMensaje('');
      setConfirmacion(true);
      cargar();
    } catch (x) {
      setMensaje(x.message);
    }
  };
  const totalPagado = (detalle?.pagos || [])
    .filter((pago) => pago.estado === 'aprobado')
    .reduce((suma, pago) => suma + Number(pago.monto_bruto), 0);
  const totalReembolsado = (detalle?.reembolsos || [])
    .filter((item) => item.estado === 'aprobado')
    .reduce((suma, item) => suma + Number(item.monto), 0);
  const saldoReembolsable = Math.max(
    0,
    totalPagado -
      totalReembolsado -
      (detalle?.estado === 'cancelado' ? 0 : Number(detalle?.total || 0)),
  );
  const paginas = Math.max(1, Math.ceil(total / limite));

  return (
    <section className="ecommerce-admin">
      <div className="encabezado-pagina">
        <div>
          <p className="etiqueta">CANAL ONLINE</p>
          <h1>E-commerce</h1>
        </div>
      </div>
      <div className="selector-vista ecommerce-vistas">
        {[
          'pedidos',
          'productos',
          'promociones',
          ...(permisos.includes('ecommerce.gestionar')
            ? ['configuracion']
            : []),
        ].map((v) => (
          <button
            className={vista === v ? 'activo' : ''}
            onClick={() => {
              setVista(v);
              setFiltro('');
              setPagina(1);
            }}
            key={v}
          >
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      {mensaje && <p className="mensaje-informativo">{mensaje}</p>}
      {['pedidos', 'productos'].includes(vista) && (
        <div className="barra-filtros ecommerce-filtros">
          <input
            placeholder="Buscar…"
            value={buscar}
            onChange={(e) => {
              setBuscar(e.target.value);
              setPagina(1);
            }}
          />
          <select
            value={filtro}
            onChange={(e) => {
              setFiltro(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos</option>
            {vista === 'productos' ? (
              <>
                <option value="publicados">Publicados</option>
                <option value="ocultos">Ocultos</option>
              </>
            ) : (
              [
                'pendiente_pago',
                'confirmado',
                'en_preparacion',
                'listo',
                'en_reparto',
                'entregado',
                'cancelado',
              ].map((x) => <option key={x}>{x}</option>)
            )}
          </select>
          <span>{total} registros</span>
        </div>
      )}
      {vista === 'pedidos' && (
        <>
          <div className="paginacion--superior">
            <Paginacion
              pagina={pagina}
              paginas={paginas}
              limite={limite}
              alCambiarPagina={setPagina}
              alCambiarLimite={(valor) => {
                setLimite(valor);
                setPagina(1);
              }}
            />
          </div>
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Entrega</th>
                  <th>Pago</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {datos.map((p) => (
                  <tr key={p.id}>
                    <td>#{p.codigo}</td>
                    <td>{fecha(p.fecha_creacion)}</td>
                    <td>{p.nombre_cliente}</td>
                    <td>{p.modalidad_entrega}</td>
                    <td>{p.estado_pago}</td>
                    <td>{dinero(p.total)}</td>
                    <td>{p.estado}</td>
                    <td>
                      <button className="boton-tabla" onClick={() => ver(p.id)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {vista === 'productos' && (
        <>
          <div className="paginacion--superior">
            <Paginacion
              pagina={pagina}
              paginas={paginas}
              limite={limite}
              alCambiarPagina={setPagina}
              alCambiarLimite={(valor) => {
                setLimite(valor);
                setPagina(1);
              }}
            />
          </div>
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Disponible</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {datos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nombre}</td>
                    <td>{p.categoria}</td>
                    <td>{dinero(p.precio)}</td>
                    <td>{Number(p.disponible_online)}</td>
                    <td>
                      <button
                        className="boton-tabla"
                        disabled={!permisos.includes('ecommerce.gestionar')}
                        onClick={() => publicar(p)}
                      >
                        {p.esta_publicado ? 'Ocultar' : 'Publicar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {['pedidos', 'productos'].includes(vista) && (
        <Paginacion
          pagina={pagina}
          paginas={paginas}
          limite={limite}
          alCambiarPagina={setPagina}
          alCambiarLimite={(valor) => {
            setLimite(valor);
            setPagina(1);
          }}
        />
      )}
      {vista === 'promociones' && <PromocionesEcommerce token={token} />}
      {vista === 'configuracion' && config && (
        <ConfiguracionEcommerce datos={config} alGuardar={guardar} />
      )}
      {detalle && (
        <Modal
          abierto
          ancho="grande"
          titulo={`Pedido #${detalle.codigo}`}
          alCerrar={() => setDetalle(null)}
        >
          <p>
            <strong>{detalle.nombre_cliente}</strong> ·{' '}
            {detalle.telefono_cliente} · {detalle.correo_cliente}
          </p>
          <p>
            {detalle.modalidad_entrega} · {detalle.medio_pago} · Pago:{' '}
            {detalle.estado_pago}
          </p>
          <p className={`estado-pedido-detalle estado-pedido-detalle--${detalle.estado}`}>
            Estado del pedido: {etiquetasEstadoPedido[detalle.estado] || detalle.estado}
          </p>
          {detalle.modalidad_entrega === 'envio' && (
            <div className="datos-entrega-pedido">
              <span><strong>Dirección</strong>{detalle.direccion_cliente}</span>
              <span><strong>Localidad</strong>{detalle.localidad_cliente}</span>
              <span><strong>Zona</strong>{detalle.zona || '—'}</span>
              <span><strong>Distancia por calles</strong>{Number(detalle.distancia_km).toLocaleString('es-AR')} km</span>
            </div>
          )}
          {detalle.estado === 'cancelado' && (
            <p className="mensaje-informativo">
              Pedido cancelado. La reserva de stock fue liberada y ya no puede
              registrarse un pago.
            </p>
          )}
          {detalle.estado !== 'en_preparacion' && (
            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio original</th>
                    <th>Descuento</th>
                    <th>Subtotal final</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.detalles.map((d) => (
                    <tr key={d.id}>
                      <td>{d.nombre_sustituto || d.nombre_producto}</td>
                      <td>
                        {Number(
                          d.cantidad_confirmada ?? d.cantidad_solicitada,
                        )}
                      </td>
                      <td>{dinero(d.precio_unitario)}</td>
                      <td className="importe-descuento">
                        {Number(d.descuento) > 0
                          ? `-${dinero(d.descuento)}`
                          : '—'}
                      </td>
                      <td>{dinero(d.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {detalle.estado === 'en_preparacion' && (
            <form className="preparacion-pedido" onSubmit={preparar}>
              <h3>Confirmar cantidades preparadas</h3>
              <p className="dato-secundario">
                Reducí la cantidad o ingresá cero para quitar un producto. El
                stock reservado y el total se recalcularán automáticamente.
              </p>
              <div
                className="preparacion-pedido__encabezado"
                aria-hidden="true"
              >
                <span>Producto</span>
                <span>Pedido</span>
                <span>Preparado</span>
                <span>Observación</span>
              </div>
              {detalle.detalles.map((item) => (
                <div className="preparacion-pedido__item" key={item.id}>
                  <strong>
                    {item.nombre_sustituto || item.nombre_producto}
                  </strong>
                  <span className="preparacion-pedido__solicitado">
                    {Number(item.cantidad_solicitada).toLocaleString('es-AR')}
                  </span>
                  <label>
                    <span className="preparacion-pedido__etiqueta-movil">
                      Preparado
                    </span>
                    <input
                      name={`cantidad-${item.id}`}
                      type="number"
                      min="0"
                      max={Number(item.cantidad_solicitada)}
                      step="1"
                      defaultValue={Number(item.cantidad_solicitada)}
                      onFocus={(e) => e.target.select()}
                      required
                    />
                  </label>
                  <label>
                    <span className="preparacion-pedido__etiqueta-movil">
                      Observación
                    </span>
                    <input
                      name={`observaciones-${item.id}`}
                      defaultValue=""
                      placeholder="Opcional"
                    />
                  </label>
                </div>
              ))}
              <button className="boton">Confirmar preparación</button>
            </form>
          )}
          <div className="resumen-pedido-admin">
            <span>
              Subtotal original <strong>{dinero(detalle.subtotal)}</strong>
            </span>
            <span>
              Descuentos{' '}
              <strong className="importe-descuento">
                -{dinero(detalle.descuento)}
              </strong>
            </span>
            <span>
              Envío <strong>{dinero(detalle.costo_envio)}</strong>
            </span>
            <span>
              Total <strong>{dinero(detalle.total)}</strong>
            </span>
          </div>
          {detalle.pagos.length > 0 && (
            <>
              <h3>Pagos y reembolsos</h3>
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Movimiento</th>
                      <th>Cuenta</th>
                      <th>Referencia</th>
                      <th>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.pagos.map((pago) => (
                      <tr key={`pago-${pago.id}`}>
                        <td>
                          {fecha(pago.fecha_aprobacion || pago.fecha_creacion)}
                        </td>
                        <td>Pago · {pago.proveedor}</td>
                        <td>—</td>
                        <td>{pago.referencia_externa || '—'}</td>
                        <td className="importe-ingreso">
                          +{dinero(pago.monto_bruto)}
                        </td>
                      </tr>
                    ))}
                    {(detalle.reembolsos || []).map((item) => (
                      <tr key={`reembolso-${item.id}`}>
                        <td>{fecha(item.fecha_creacion)}</td>
                        <td>Reembolso · {item.motivo}</td>
                        <td>{item.cuenta_tesoreria || '—'}</td>
                        <td>{item.referencia_externa || '—'}</td>
                        <td className="importe-egreso">
                          -{dinero(item.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="resumen-pedido-admin">
                <span>
                  Pagado <strong>{dinero(totalPagado)}</strong>
                </span>
                <span>
                  Reembolsado <strong>{dinero(totalReembolsado)}</strong>
                </span>
                <span>
                  Pendiente de reintegro{' '}
                  <strong>{dinero(saldoReembolsable)}</strong>
                </span>
              </div>
            </>
          )}
          {(detalle.devoluciones || []).length > 0 && (
            <section className="devoluciones-online-historial">
              <h3>Devoluciones parciales</h3>
              {detalle.devoluciones.map((devolucion) => (
                <article key={devolucion.id}>
                  <p>
                    <strong>#{devolucion.id}</strong> ·{' '}
                    {fecha(devolucion.fecha_creacion)} · {devolucion.motivo} ·{' '}
                    <strong>{dinero(devolucion.total)}</strong>
                  </p>
                  <ul>
                    {devolucion.detalles.map((item) => (
                      <li key={item.id}>
                        {Number(item.cantidad)} × {item.producto}
                        {item.reintegra_stock
                          ? ' · volvió al stock'
                          : ' · sin retorno al stock'}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>
          )}
          {cobrando && !['cancelado', 'entregado'].includes(detalle.estado) && (
            <form className="formulario formulario--grilla" onSubmit={cobrar}>
              <label>
                Medio
                <select name="proveedor" defaultValue={detalle.medio_pago}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="mercado_pago">Mercado Pago</option>
                </select>
              </label>
              <label>
                Cuenta
                <select name="cuenta" required>
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} · {dinero(c.saldo)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Importe
                <input
                  name="monto"
                  type="number"
                  step="0.01"
                  defaultValue={detalle.total}
                  required
                />
              </label>
              <label>
                Comisión
                <input
                  name="comision"
                  type="number"
                  step="0.01"
                  defaultValue="0"
                />
              </label>
              <label>
                Referencia
                <input name="referencia" defaultValue={detalle.codigo} />
              </label>
              <button className="boton">Registrar cobro</button>
            </form>
          )}
          {reembolsando &&
            detalle.estado !== 'entregado' &&
            saldoReembolsable > 0 && (
              <form
                className="formulario formulario--grilla"
                onSubmit={reembolsar}
              >
                <label>
                  Cuenta de devolución
                  <select name="cuenta" required>
                    {cuentas.map((cuenta) => (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombre} · {dinero(cuenta.saldo)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Importe
                  <input
                    name="monto"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={saldoReembolsable}
                    defaultValue={saldoReembolsable}
                    required
                  />
                </label>
                <label>
                  Motivo
                  <input
                    name="motivo"
                    defaultValue={
                      detalle.estado === 'cancelado'
                        ? 'Cancelación del pedido'
                        : 'Ajuste de productos durante la preparación'
                    }
                    required
                  />
                </label>
                <label>
                  Referencia
                  <input
                    name="referencia"
                    defaultValue={`REEMBOLSO-${detalle.codigo}`}
                  />
                </label>
                <button className="boton">Registrar reembolso</button>
              </form>
            )}
          {devolviendo && detalle.estado === 'entregado' && (
            <form className="devolucion-online" onSubmit={devolver}>
              <h3>Devolución parcial del pedido entregado</h3>
              <p className="dato-secundario">
                Seleccioná únicamente los artículos que entrega el cliente.
              </p>
              {detalle.detalles.map((item) => {
                const yaDevuelto = (detalle.devoluciones || [])
                  .flatMap((devolucion) => devolucion.detalles)
                  .filter(
                    (devuelto) =>
                      Number(devuelto.pedido_detalle_id) === Number(item.id),
                  )
                  .reduce(
                    (suma, devuelto) => suma + Number(devuelto.cantidad),
                    0,
                  );
                const maximo =
                  Number(item.cantidad_confirmada ?? item.cantidad_solicitada) -
                  yaDevuelto;
                return (
                  <div className="devolucion-online__item" key={item.id}>
                    <span>{item.nombre_sustituto || item.nombre_producto}</span>
                    <small>Disponible para devolver: {maximo}</small>
                    <label>
                      Cantidad
                      <input
                        name={`devolver-${item.id}`}
                        type="number"
                        min="0"
                        max={maximo}
                        step="1"
                        defaultValue="0"
                        onFocus={(e) => e.target.select()}
                      />
                    </label>
                    <label className="fila-check">
                      <input
                        name={`stock-${item.id}`}
                        type="checkbox"
                        defaultChecked
                      />
                      Reintegrar al stock
                    </label>
                  </div>
                );
              })}
              <div className="formulario formulario--grilla">
                <label>
                  Cuenta de devolución
                  <select name="cuenta" required>
                    {cuentas.map((cuenta) => (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombre} · {dinero(cuenta.saldo)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Motivo
                  <input
                    name="motivo"
                    defaultValue="Devolución parcial del cliente"
                    required
                  />
                </label>
                <label>
                  Referencia
                  <input
                    name="referencia"
                    defaultValue={`DEV-${detalle.codigo}`}
                  />
                </label>
              </div>
              <button className="boton">Calcular y registrar devolución</button>
            </form>
          )}
          <div className="acciones-modal">
            {detalle.estado_pago !== 'aprobado' &&
              !['cancelado', 'entregado'].includes(detalle.estado) &&
              permisos.includes('ecommerce.pagos') && (
                <button onClick={() => setCobrando(!cobrando)}>
                  Registrar pago
                </button>
              )}
            {detalle.estado === 'pendiente_pago' && (
              <button onClick={() => avanzar('confirmado')}>Confirmar</button>
            )}
            {detalle.estado === 'confirmado' && (
              <button onClick={() => avanzar('en_preparacion')}>
                Preparar
              </button>
            )}
            {detalle.estado === 'listo' &&
              detalle.modalidad_entrega === 'envio' && (
                <button onClick={() => avanzar('en_reparto')}>
                  Pasar a en reparto
                </button>
              )}
            {((detalle.modalidad_entrega === 'retiro' && detalle.estado === 'listo') ||
              (detalle.modalidad_entrega === 'envio' && detalle.estado === 'en_reparto')) &&
              detalle.estado_pago === 'aprobado' && (
                <button
                  className="boton"
                  onClick={async () => {
                    await api(`/pedidos/${detalle.id}/entrega`, {
                      method: 'POST',
                    });
                    setDetalle(null);
                    cargar();
                  }}
                >
                  {detalle.modalidad_entrega === 'envio'
                    ? 'Confirmar entrega y registrar venta'
                    : 'Entregar retiro y registrar venta'}
                </button>
              )}
            {!['entregado', 'cancelado'].includes(detalle.estado) && (
              <button onClick={() => avanzar('cancelado')}>Cancelar</button>
            )}
            {detalle.estado === 'cancelado' &&
              saldoReembolsable > 0 &&
              permisos.includes('ecommerce.pagos') && (
                <button
                  className="boton"
                  onClick={() => setReembolsando(!reembolsando)}
                >
                  {reembolsando ? 'Ocultar reembolso' : 'Registrar reembolso'}
                </button>
              )}
            {detalle.estado !== 'cancelado' &&
              detalle.estado !== 'entregado' &&
              saldoReembolsable > 0 &&
              permisos.includes('ecommerce.pagos') && (
                <button
                  className="boton"
                  onClick={() => setReembolsando(!reembolsando)}
                >
                  {reembolsando ? 'Ocultar reintegro' : 'Reintegrar diferencia'}
                </button>
              )}
            {detalle.estado === 'entregado' &&
              permisos.includes('ecommerce.pagos') && (
                <button
                  className="boton"
                  onClick={() => setDevolviendo(!devolviendo)}
                >
                  {devolviendo ? 'Ocultar devolución' : 'Devolución parcial'}
                </button>
              )}
          </div>
        </Modal>
      )}
      {confirmacion && (
        <Modal
          abierto
          titulo="Configuración guardada"
          alCerrar={() => setConfirmacion(false)}
        >
          <p>
            Los cambios de la tienda online se guardaron correctamente y ya
            están vigentes.
          </p>
          <div className="acciones-modal">
            <button
              className="boton"
              type="button"
              onClick={() => setConfirmacion(false)}
            >
              Aceptar
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
