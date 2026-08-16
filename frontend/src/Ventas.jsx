import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './componentes/Modal.jsx';
import {
  formatearFecha,
  formatearFechaHora,
  formatearHora,
} from './utilidades/fechas.js';
import { GestionCajas } from './componentes/GestionCajas.jsx';
import { Paginacion } from './componentes/Paginacion.jsx';
import { useActualizacionAutomatica } from './hooks/useActualizacionAutomatica.js';

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

export function Ventas({ token, permisos }) {
  const [sesion, setSesion] = useState(undefined);
  const [resumenCajaActual, setResumenCajaActual] = useState(null);
  const [productos, setProductos] = useState([]);
  const [cajasDisponibles, setCajasDisponibles] = useState([]);
  const [cuentasEfectivo, setCuentasEfectivo] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [cotizacionVenta, setCotizacionVenta] = useState(null);
  const [modalCaja, setModalCaja] = useState(false);
  const [modalCobro, setModalCobro] = useState(false);
  const [pagosVenta, setPagosVenta] = useState({
    efectivo: '',
    debito: '',
    credito: '',
    transferencia: '',
  });
  const [recibido, setRecibido] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [modalCierre, setModalCierre] = useState(false);
  const [resumenCierre, setResumenCierre] = useState(null);
  const [montoContado, setMontoContado] = useState('');
  const [rendirAlCerrar, setRendirAlCerrar] = useState(true);
  const [cuentaRendicion, setCuentaRendicion] = useState('');
  const [resultadoActivo, setResultadoActivo] = useState(-1);
  const [vista, setVista] = useState('venta');
  const [ventas, setVentas] = useState([]);
  const [resumenVentas, setResumenVentas] = useState({
    total: 0,
    facturacion: 0,
    pagos: {},
  });
  const [paginaVentas, setPaginaVentas] = useState(1);
  const [textoVentas, setTextoVentas] = useState('');
  const [buscarVentas, setBuscarVentas] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [ventaDetalle, setVentaDetalle] = useState(null);
  const [ventaAAnular, setVentaAAnular] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [ventaCambio, setVentaCambio] = useState(null);
  const [devueltos, setDevueltos] = useState({});
  const [reemplazos, setReemplazos] = useState([]);
  const [buscarReemplazo, setBuscarReemplazo] = useState('');
  const [reemplazoActivo, setReemplazoActivo] = useState(-1);
  const buscarReemplazoRef = useRef(null);
  const [motivoCambio, setMotivoCambio] = useState('');
  const [medioDiferencia, setMedioDiferencia] = useState('efectivo');
  const [modalMovimiento, setModalMovimiento] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState('ingreso');
  const [modalHistorialCajas, setModalHistorialCajas] = useState(false);
  const [sesionesCaja, setSesionesCaja] = useState([]);
  const [paginaCajas, setPaginaCajas] = useState(1);
  const [totalSesionesCaja, setTotalSesionesCaja] = useState(0);
  const [fechaDesdeCajas, setFechaDesdeCajas] = useState('');
  const [fechaHastaCajas, setFechaHastaCajas] = useState('');
  const [estadoCajas, setEstadoCajas] = useState('');
  const [rendicionCajas, setRendicionCajas] = useState('');
  const [sesionARendir, setSesionARendir] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [modalGestionCajas, setModalGestionCajas] = useState(false);
  const [limiteVentas, setLimiteVentas] = useState(25);
  const [limiteCajas, setLimiteCajas] = useState(10);

  const cargar = useCallback(async () => {
    try {
      const [caja, disponibles, cuentas, referencias, referenciaClientes] =
        await Promise.all([
          pedir('/api/ventas/caja/actual', token),
          pedir('/api/ventas/caja/disponibles', token),
          pedir('/api/ventas/caja/cuentas-efectivo', token),
          pedir('/api/ventas/referencias', token),
          pedir('/api/ventas/clientes', token),
        ]);
      setSesion(caja.dato);
      setCajasDisponibles(disponibles.datos);
      setCuentasEfectivo(cuentas.datos);
      setProductos(referencias.datos);
      setClientes(referenciaClientes.datos);
      if (caja.dato)
        setResumenCajaActual(
          (await pedir('/api/ventas/caja/resumen', token)).dato,
        );
      else {
        setResumenCajaActual(null);
        setModalCaja(true);
      }
    } catch (error) {
      setMensaje(error.message);
    }
  }, [token]);
  const actualizarCajasDisponibles = useCallback(async () => {
    try {
      setCajasDisponibles(
        (await pedir('/api/ventas/caja/disponibles', token)).datos,
      );
    } catch (error) {
      setMensaje(error.message);
    }
  }, [token]);
  const actualizarProductos = useCallback(async () => {
    try {
      setProductos((await pedir('/api/ventas/referencias', token)).datos);
    } catch (error) {
      setMensaje(error.message);
    }
  }, [token]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    if (!sesion) return undefined;
    const actualizarResumen = async () => {
      try {
        setResumenCajaActual(
          (await pedir('/api/ventas/caja/resumen', token)).dato,
        );
      } catch {
        /* La carga principal mostrará cualquier error persistente. */
      }
    };
    const intervalo = setInterval(actualizarResumen, 15000);
    window.addEventListener('focus', actualizarResumen);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('focus', actualizarResumen);
    };
  }, [sesion, token]);
  const cargarHistorial = useCallback(async () => {
    try {
      const parametros = new URLSearchParams({
        pagina: String(paginaVentas),
        limite: String(limiteVentas),
      });
      if (buscarVentas) parametros.set('buscar', buscarVentas);
      if (fechaDesde) parametros.set('fecha_desde', fechaDesde);
      if (fechaHasta) parametros.set('fecha_hasta', fechaHasta);
      const respuesta = await pedir(
        `/api/ventas/historial?${parametros}`,
        token,
      );
      setVentas(respuesta.datos);
      setResumenVentas({
        total: respuesta.total,
        facturacion: respuesta.facturacion,
        pagos: respuesta.pagos,
      });
    } catch (error) {
      setMensaje(error.message);
    }
  }, [token, paginaVentas, limiteVentas, buscarVentas, fechaDesde, fechaHasta]);
  useEffect(() => {
    if (vista === 'historial') cargarHistorial();
  }, [vista, cargarHistorial]);
  useActualizacionAutomatica(
    actualizarProductos,
    vista === 'venta' && carrito.length === 0 && !procesando && !modalCobro,
  );
  useActualizacionAutomatica(
    cargarHistorial,
    vista === 'historial' && !ventaDetalle && !ventaAAnular && !ventaCambio,
  );
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setPaginaVentas(1);
      setBuscarVentas(textoVentas.trim());
    }, 300);
    return () => clearTimeout(temporizador);
  }, [textoVentas]);
  const resultados = useMemo(() => {
    const termino = buscar.trim().toLocaleLowerCase('es');
    if (termino.length < 2) return [];
    return productos
      .filter((producto) =>
        `${producto.nombre} ${producto.codigo_barra}`
          .toLocaleLowerCase('es')
          .includes(termino),
      )
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0))
      .slice(0, 12);
  }, [buscar, productos]);
  useEffect(() => {
    if (resultadoActivo >= 0)
      document
        .getElementById(`resultado-venta-${resultados[resultadoActivo]?.id}`)
        ?.scrollIntoView({ block: 'nearest' });
  }, [resultadoActivo, resultados]);
  const subtotalVenta = carrito.reduce(
    (suma, item) => suma + Number(item.cantidad) * Number(item.precio_venta),
    0,
  );
  useEffect(() => {
    if (!carrito.length) {
      setCotizacionVenta(null);
      return;
    }
    const temporizador = setTimeout(
      () =>
        pedir('/api/ventas/cotizacion', token, {
          method: 'POST',
          body: JSON.stringify({
            detalles: carrito.map((item) => ({
              producto_id: item.id,
              cantidad: Number(item.cantidad),
            })),
          }),
        })
          .then((respuesta) => setCotizacionVenta(respuesta.dato))
          .catch((error) => setMensaje(error.message)),
      120,
    );
    return () => clearTimeout(temporizador);
  }, [carrito, token]);
  const total = Number(cotizacionVenta?.total ?? subtotalVenta);
  const totalPagado = Object.values(pagosVenta).reduce(
    (suma, importe) => suma + Number(importe || 0),
    0,
  );
  const saldoPago = total - totalPagado;
  const clienteSeleccionado = clientes.find(
    (cliente) => cliente.id === Number(clienteId),
  );
  const creditoValido =
    saldoPago <= 0.009 ||
    Boolean(
      clienteSeleccionado?.credito_habilitado &&
      saldoPago <= Number(clienteSeleccionado.disponible) + 0.009,
    );
  const vuelto = Math.max(
    0,
    Number(recibido || 0) - Number(pagosVenta.efectivo || 0),
  );
  const resultadosReemplazo = useMemo(() => {
    const termino = buscarReemplazo.trim().toLocaleLowerCase('es');
    if (termino.length < 2) return [];
    return productos
      .filter((producto) =>
        `${producto.nombre} ${producto.codigo_barra}`
          .toLocaleLowerCase('es')
          .includes(termino),
      )
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0))
      .slice(0, 12);
  }, [buscarReemplazo, productos]);
  const totalDevuelto = ventaCambio
    ? ventaCambio.detalles.reduce(
        (suma, detalle) =>
          suma +
          Number(devueltos[detalle.producto_id]?.cantidad || 0) *
            Number(detalle.precio_unitario),
        0,
      )
    : 0;
  const totalReemplazo = reemplazos.reduce(
    (suma, item) => suma + Number(item.cantidad) * Number(item.precio_venta),
    0,
  );
  const diferenciaCambio = totalReemplazo - totalDevuelto;

  function agregar(producto, conservarBusqueda = false) {
    setCarrito((actual) => {
      const existente = actual.find((item) => item.id === producto.id);
      if (existente)
        return actual.map((item) =>
          item.id === producto.id
            ? {
                ...item,
                cantidad: Math.min(
                  Number(item.stock),
                  Number(item.cantidad) + 1,
                ),
              }
            : item,
        );
      return [...actual, { ...producto, cantidad: 1 }];
    });
    if (!conservarBusqueda) {
      setBuscar('');
      setResultadoActivo(-1);
    }
  }
  function agregarConEnter(evento) {
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
    const codigo = buscar.trim();
    const coincidenciaExacta = resultados.find(
      (item) => item.codigo_barra === codigo,
    );
    const producto =
      coincidenciaExacta || resultados[resultadoActivo] || resultados[0];
    if (!producto) return;
    if (Number(producto.stock) <= 0) {
      setMensaje(`${producto.nombre} no tiene stock disponible.`);
      return;
    }
    setMensaje('');
    agregar(producto, !coincidenciaExacta);
  }
  function cambiarCantidad(id, cantidad) {
    setCarrito((actual) =>
      actual.map((item) => (item.id === id ? { ...item, cantidad } : item)),
    );
  }
  async function abrirCaja(evento) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    setProcesando(true);
    try {
      await pedir('/api/ventas/caja/abrir', token, {
        method: 'POST',
        body: JSON.stringify({
          caja_id: Number(formulario.get('caja_id')),
          monto_inicial: Number(formulario.get('monto_inicial')),
          cuenta_origen_id: Number(formulario.get('cuenta_origen_id')),
        }),
      });
      setModalCaja(false);
      setMensaje('Caja abierta correctamente.');
      await cargar();
    } catch (error) {
      setMensaje(error.message);
      await cargar();
    } finally {
      setProcesando(false);
    }
  }
  async function cobrar() {
    setProcesando(true);
    try {
      const pagos = Object.entries(pagosVenta)
        .filter(([, importe]) => Number(importe) > 0)
        .map(([medioPago, importe]) => ({
          medio: medioPago,
          monto: Number(importe),
        }));
      const respuesta = await pedir('/api/ventas', token, {
        method: 'POST',
        body: JSON.stringify({
          cliente_id: clienteId ? Number(clienteId) : null,
          detalles: carrito.map((item) => ({
            producto_id: item.id,
            cantidad: Number(item.cantidad),
          })),
          pagos,
          efectivo_recibido:
            Number(pagosVenta.efectivo) > 0 ? Number(recibido) : null,
        }),
      });
      const comprobante = await pedir(
        `/api/ventas/historial/${respuesta.dato.id}`,
        token,
      );
      setModalCobro(false);
      setCarrito([]);
      setRecibido('');
      setClienteId('');
      setPagosVenta({
        efectivo: '',
        debito: '',
        credito: '',
        transferencia: '',
      });
      setMensaje(
        `Venta #${respuesta.dato.id} registrada correctamente${Number(respuesta.dato.saldo_pendiente) > 0 ? ` con $${Number(respuesta.dato.saldo_pendiente).toLocaleString('es-AR')} en cuenta corriente` : ''}.`,
      );
      setVentaDetalle(comprobante.dato);
      await cargar();
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setProcesando(false);
    }
  }
  function completarSaldo(medioPago) {
    const otros = Object.entries(pagosVenta)
      .filter(([nombre]) => nombre !== medioPago)
      .reduce((suma, [, importe]) => suma + Number(importe || 0), 0);
    const importe = Math.max(0, total - otros);
    setPagosVenta((actual) => ({
      ...actual,
      [medioPago]: importe ? importe.toFixed(2) : '',
    }));
    if (medioPago === 'efectivo')
      setRecibido(importe ? importe.toFixed(2) : '');
  }
  async function abrirCierre() {
    try {
      const respuesta = await pedir('/api/ventas/caja/resumen', token);
      setResumenCierre(respuesta.dato);
      setMontoContado(String(respuesta.dato.efectivo_esperado));
      setRendirAlCerrar(true);
      setCuentaRendicion(
        cuentasEfectivo[0]?.id ? String(cuentasEfectivo[0].id) : '',
      );
      setModalCierre(true);
    } catch (error) {
      setMensaje(error.message);
    }
  }
  async function cerrarCaja() {
    setProcesando(true);
    try {
      const respuesta = await pedir('/api/ventas/caja/cerrar', token, {
        method: 'POST',
        body: JSON.stringify({
          monto_contado: Number(montoContado),
          cuenta_destino_id: rendirAlCerrar ? Number(cuentaRendicion) : null,
        }),
      });
      const disponibles = await pedir('/api/ventas/caja/disponibles', token);
      setCajasDisponibles(disponibles.datos);
      setSesion(null);
      setResumenCajaActual(null);
      setModalCierre(false);
      setResumenCierre(null);
      setMensaje(
        `Caja cerrada. Diferencia: $${Number(respuesta.dato.diferencia).toLocaleString('es-AR', { minimumFractionDigits: 2 })}.${respuesta.dato.rendicion ? ` Efectivo rendido en ${respuesta.dato.rendicion.cuenta}.` : ' La rendición quedó pendiente.'}`,
      );
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setProcesando(false);
    }
  }
  async function abrirVenta(id) {
    try {
      const respuesta = await pedir(`/api/ventas/historial/${id}`, token);
      setVentaDetalle(respuesta.dato);
    } catch (error) {
      setMensaje(error.message);
    }
  }
  async function anular() {
    setProcesando(true);
    try {
      const respuesta = await pedir(
        `/api/ventas/${ventaAAnular.id}/anular`,
        token,
        { method: 'POST', body: JSON.stringify({ motivo: motivoAnulacion }) },
      );
      setVentaAAnular(null);
      setMotivoAnulacion('');
      setMensaje(
        `Venta anulada. ${respuesta.dato.productos_reintegrados} productos volvieron al stock.`,
      );
      await Promise.all([cargar(), cargarHistorial()]);
    } catch (error) {
      setMensaje(error.message);
      setVentaAAnular(null);
    } finally {
      setProcesando(false);
    }
  }
  function iniciarCambio(venta) {
    setVentaCambio(venta);
    setVentaDetalle(null);
    setDevueltos({});
    setReemplazos([]);
    setBuscarReemplazo('');
    setMotivoCambio('');
  }
  function agregarReemplazo(producto) {
    if (Number(producto.stock) <= 0) return;
    setReemplazos((actual) => {
      const existente = actual.find((item) => item.id === producto.id);
      return existente
        ? actual.map((item) =>
            item.id === producto.id
              ? {
                  ...item,
                  cantidad: Math.min(
                    Number(item.stock),
                    Number(item.cantidad) + 1,
                  ),
                }
              : item,
          )
        : [...actual, { ...producto, cantidad: 1 }];
    });
    setBuscarReemplazo('');
    setReemplazoActivo(-1);
    requestAnimationFrame(() => {
      buscarReemplazoRef.current?.focus();
      buscarReemplazoRef.current?.select();
    });
  }
  function navegarReemplazos(evento) {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      if (resultadosReemplazo.length)
        setReemplazoActivo((actual) =>
          actual >= resultadosReemplazo.length - 1 ? -1 : actual + 1,
        );
      return;
    }
    if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (resultadosReemplazo.length)
        setReemplazoActivo((actual) =>
          actual === -1
            ? resultadosReemplazo.length - 1
            : actual === 0
              ? -1
              : actual - 1,
        );
      return;
    }
    if (evento.key !== 'Enter') return;
    evento.preventDefault();
    const exacto = resultadosReemplazo.find(
      (item) => item.codigo_barra === buscarReemplazo.trim(),
    );
    const producto =
      exacto || resultadosReemplazo[reemplazoActivo] || resultadosReemplazo[0];
    if (producto) agregarReemplazo(producto);
  }
  async function confirmarCambio() {
    setProcesando(true);
    try {
      const respuesta = await pedir(
        `/api/ventas/${ventaCambio.id}/devoluciones`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            motivo: motivoCambio,
            devueltos: Object.entries(devueltos)
              .filter(([, item]) => Number(item.cantidad) > 0)
              .map(([productoId, item]) => ({
                producto_id: Number(productoId),
                cantidad: Number(item.cantidad),
                reintegra_stock: item.reintegra_stock,
              })),
            reemplazos: reemplazos.map((item) => ({
              producto_id: item.id,
              cantidad: Number(item.cantidad),
            })),
            ...(Math.abs(diferenciaCambio) > 0.009
              ? { medio: medioDiferencia }
              : {}),
          }),
        },
      );
      setVentaCambio(null);
      setMensaje(
        `Cambio/devolución #${respuesta.dato.id} registrado correctamente${Number(respuesta.dato.credito_cuenta) > 0 ? `; ${Number(respuesta.dato.credito_cuenta).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} redujeron la cuenta corriente` : ''}.`,
      );
      await Promise.all([cargar(), cargarHistorial()]);
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setProcesando(false);
    }
  }
  async function guardarMovimiento(evento) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    setProcesando(true);
    try {
      await pedir('/api/ventas/caja/movimientos', token, {
        method: 'POST',
        body: JSON.stringify({
          tipo: tipoMovimiento,
          monto: Number(formulario.get('monto')),
          motivo: formulario.get('motivo'),
        }),
      });
      setModalMovimiento(false);
      setMensaje(
        `${tipoMovimiento === 'ingreso' ? 'Ingreso' : 'Egreso'} de caja registrado.`,
      );
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setProcesando(false);
    }
  }
  const cargarHistorialCajas = useCallback(async () => {
    try {
      const parametros = new URLSearchParams({
        pagina: String(paginaCajas),
        limite: String(limiteCajas),
      });
      if (fechaDesdeCajas) parametros.set('fecha_desde', fechaDesdeCajas);
      if (fechaHastaCajas) parametros.set('fecha_hasta', fechaHastaCajas);
      if (estadoCajas) parametros.set('estado', estadoCajas);
      if (rendicionCajas) parametros.set('estado_rendicion', rendicionCajas);
      const respuesta = await pedir(
        `/api/ventas/caja/historial?${parametros}`,
        token,
      );
      setSesionesCaja(respuesta.datos);
      setTotalSesionesCaja(Number(respuesta.total));
    } catch (error) {
      setMensaje(error.message);
    }
  }, [
    token,
    paginaCajas,
    limiteCajas,
    fechaDesdeCajas,
    fechaHastaCajas,
    estadoCajas,
    rendicionCajas,
  ]);

  useEffect(() => {
    if (!modalHistorialCajas) return undefined;
    const temporizador = setTimeout(cargarHistorialCajas, 200);
    return () => clearTimeout(temporizador);
  }, [modalHistorialCajas, cargarHistorialCajas]);
  useActualizacionAutomatica(
    cargarHistorialCajas,
    modalHistorialCajas && !sesionARendir && !procesando,
  );

  function abrirHistorialCajas() {
    setPaginaCajas(1);
    setModalHistorialCajas(true);
  }

  async function rendirSesion() {
    setProcesando(true);
    try {
      const respuesta = await pedir(
        `/api/ventas/caja/${sesionARendir.id}/rendir`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({ cuenta_destino_id: Number(cuentaRendicion) }),
        },
      );
      setSesionARendir(null);
      setMensaje(`Caja rendida correctamente en ${respuesta.dato.cuenta}.`);
      await cargarHistorialCajas();
      const cuentas = await pedir('/api/ventas/caja/cuentas-efectivo', token);
      setCuentasEfectivo(cuentas.datos);
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <section className="modulo modulo-ventas">
      <div className="modulo__encabezado">
        <div>
          <p className="etiqueta">PUNTO DE VENTA</p>
          <h2>{vista === 'venta' ? 'Nueva venta' : 'Historial de ventas'}</h2>
        </div>
        <div className="caja-actual">
          {sesion ? (
            <>
              <span>{sesion.caja}</span>
              <small>Abierta {formatearHora(sesion.fecha_apertura)}</small>
              <div className="acciones-caja">
                {permisos.includes('caja.operar') && (
                  <button
                    className="boton-tabla"
                    onClick={() => setModalMovimiento(true)}
                  >
                    Movimiento
                  </button>
                )}
                {permisos.includes('caja.cerrar') && (
                  <button className="boton-tabla" onClick={abrirCierre}>
                    Cerrar caja
                  </button>
                )}
              </div>
            </>
          ) : (
            <button className="boton" onClick={() => setModalCaja(true)}>
              Abrir caja
            </button>
          )}
        </div>
      </div>
      {sesion && resumenCajaActual && (
        <div className="resumen-caja-vivo" aria-label="Resumen actual de caja">
          <div>
            <span>Fondo inicial</span>
            <strong>
              $
              {Number(resumenCajaActual.monto_inicial).toLocaleString('es-AR', {
                minimumFractionDigits: 2,
              })}
            </strong>
          </div>
          <div>
            <span>Ventas en efectivo</span>
            <strong>
              $
              {Number(resumenCajaActual.pagos?.efectivo || 0).toLocaleString(
                'es-AR',
                { minimumFractionDigits: 2 },
              )}
            </strong>
          </div>
          <div>
            <span>Otros ingresos</span>
            <strong>
              $
              {(
                Number(resumenCajaActual.cobranzas?.efectivo || 0) +
                Number(resumenCajaActual.ingresos || 0)
              ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </strong>
          </div>
          <div>
            <span>Egresos de caja</span>
            <strong>
              -$
              {(
                Number(resumenCajaActual.egresos || 0) +
                Number(resumenCajaActual.pagos_proveedores_efectivo || 0) +
                Number(resumenCajaActual.pagos_gastos_efectivo || 0) +
                Number(resumenCajaActual.pagos_sueldos_efectivo || 0) +
                Number(resumenCajaActual.adelantos_empleados_efectivo || 0)
              ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </strong>
          </div>
          <div className="resumen-caja-vivo__destacado">
            <span>Efectivo esperado</span>
            <strong>
              $
              {Number(resumenCajaActual.efectivo_esperado).toLocaleString(
                'es-AR',
                { minimumFractionDigits: 2 },
              )}
            </strong>
          </div>
        </div>
      )}
      <div className="selector-vista">
        <button
          className={vista === 'venta' ? 'activo' : ''}
          onClick={() => setVista('venta')}
        >
          Nueva venta
        </button>
        <button
          className={vista === 'historial' ? 'activo' : ''}
          onClick={() => setVista('historial')}
        >
          Historial
        </button>
        {permisos.includes('caja.operar') && (
          <button onClick={abrirHistorialCajas}>Historial de cajas</button>
        )}
        {permisos.includes('caja.supervisar') && (
          <button onClick={() => setModalGestionCajas(true)}>
            Administrar cajas
          </button>
        )}
      </div>
      {mensaje && <p className="mensaje">{mensaje}</p>}
      <GestionCajas
        abierto={modalGestionCajas}
        token={token}
        alCerrar={() => setModalGestionCajas(false)}
        alActualizar={actualizarCajasDisponibles}
      />
      {vista === 'venta' ? (
        <div className="rejilla-venta">
          <article className="panel buscador-venta">
            <h3>Agregar productos</h3>
            <input
              role="combobox"
              aria-expanded={resultados.length > 0}
              aria-controls="resultados-busqueda-venta"
              aria-activedescendant={
                resultadoActivo >= 0
                  ? `resultado-venta-${resultados[resultadoActivo]?.id}`
                  : undefined
              }
              value={buscar}
              onChange={(evento) => {
                setBuscar(evento.target.value);
                setResultadoActivo(-1);
              }}
              onKeyDown={agregarConEnter}
              placeholder="Escaneá o buscá por nombre o código"
              autoFocus
            />
            <small className="ayuda-buscador">
              ↑/↓ para elegir · Enter para agregar
            </small>
            {resultados.length > 0 && (
              <div
                id="resultados-busqueda-venta"
                role="listbox"
                className="resultados-venta"
              >
                {resultados.map((producto, indice) => (
                  <button
                    id={`resultado-venta-${producto.id}`}
                    role="option"
                    aria-selected={resultadoActivo === indice}
                    type="button"
                    key={producto.id}
                    className={
                      resultadoActivo === indice ? 'resultado-activo' : ''
                    }
                    disabled={Number(producto.stock) <= 0}
                    onMouseEnter={() => setResultadoActivo(indice)}
                    onClick={() => agregar(producto, true)}
                  >
                    <span>{producto.nombre}</span>
                    <small>
                      {producto.codigo_barra} ·{' '}
                      {Number(producto.stock) > 0
                        ? `Stock ${Number(producto.stock).toLocaleString('es-AR')}`
                        : 'Sin stock'}
                    </small>
                    <strong>
                      $
                      {Number(producto.precio_venta).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                      })}
                    </strong>
                  </button>
                ))}
              </div>
            )}
            {buscar.trim().length >= 2 && !resultados.length && (
              <p className="vacio">
                No se encontraron productos con ese nombre o código.
              </p>
            )}
          </article>
          <article className="panel panel-carrito">
            <div className="panel__encabezado">
              <h3>Productos</h3>
              <span>{carrito.length} artículos</span>
            </div>
            {carrito.length ? (
              <div className="tabla-contenedor tabla-carrito">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Precio</th>
                      <th>Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrito.map((item) => {
                      const promocion = cotizacionVenta?.detalles.find(
                        (detalle) =>
                          Number(detalle.producto_id) === Number(item.id),
                      );
                      return (
                        <tr key={item.id}>
                          <td>
                            {item.nombre}
                            <small className="dato-secundario">
                              Stock:{' '}
                              {Number(item.stock).toLocaleString('es-AR')}
                            </small>
                          </td>
                          <td>
                            <input
                              type="number"
                              min={item.es_pesable ? '0.001' : '1'}
                              max={item.stock}
                              step={item.es_pesable ? '0.001' : '1'}
                              value={item.cantidad}
                              onFocus={(evento) =>
                                evento.currentTarget.select()
                              }
                              onChange={(evento) =>
                                cambiarCantidad(item.id, evento.target.value)
                              }
                            />
                          </td>
                          <td>
                            {Number(promocion?.descuento_producto) > 0 && (
                              <del className="precio-anterior">
                                $
                                {Number(item.precio_venta).toLocaleString(
                                  'es-AR',
                                  { minimumFractionDigits: 2 },
                                )}
                              </del>
                            )}
                            ${' '}
                            {Number(
                              promocion?.precio_promocional ??
                                item.precio_venta,
                            ).toLocaleString('es-AR', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td>
                            $
                            {Number(
                              promocion?.subtotal ??
                                Number(item.cantidad) *
                                  Number(item.precio_venta),
                            ).toLocaleString('es-AR', {
                              minimumFractionDigits: 2,
                            })}
                            {Number(promocion?.descuento) > 0 && (
                              <small className="dato-secundario importe-descuento">
                                Ahorrás $
                                {Number(promocion.descuento).toLocaleString(
                                  'es-AR',
                                  { minimumFractionDigits: 2 },
                                )}
                              </small>
                            )}
                          </td>
                          <td>
                            <button
                              className="boton-tabla"
                              onClick={() =>
                                setCarrito((actual) =>
                                  actual.filter((otro) => otro.id !== item.id),
                                )
                              }
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="vacio">Todavía no agregaste productos.</p>
            )}
            <div className="pie-venta">
              <span>
                {Number(cotizacionVenta?.descuento_productos) +
                  Number(cotizacionVenta?.descuento_pedido) >
                0
                  ? `Total · Ahorrás $${(Number(cotizacionVenta.descuento_productos) + Number(cotizacionVenta.descuento_pedido)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                  : 'Total'}
              </span>
              <strong>
                ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </strong>
              <button
                className="boton"
                disabled={!sesion || !carrito.length}
                onClick={() => {
                  setPagosVenta({
                    efectivo: total.toFixed(2),
                    debito: '',
                    credito: '',
                    transferencia: '',
                  });
                  setRecibido(total.toFixed(2));
                  setModalCobro(true);
                }}
              >
                Cobrar
              </button>
            </div>
          </article>
        </div>
      ) : (
        <div className="historial-ventas">
          <div className="barra-filtros">
            <input
              value={textoVentas}
              onChange={(evento) => setTextoVentas(evento.target.value)}
              placeholder="Buscar por número, cajero o producto"
            />
            <input
              type="date"
              aria-label="Fecha desde"
              value={fechaDesde}
              onChange={(evento) => {
                setFechaDesde(evento.target.value);
                setPaginaVentas(1);
              }}
            />
            <input
              type="date"
              aria-label="Fecha hasta"
              value={fechaHasta}
              onChange={(evento) => {
                setFechaHasta(evento.target.value);
                setPaginaVentas(1);
              }}
            />
          </div>
          <div className="tarjetas-resumen">
            <div>
              <span>Ventas</span>
              <strong>{resumenVentas.total}</strong>
            </div>
            <div>
              <span>Facturación</span>
              <strong>
                $
                {resumenVentas.facturacion.toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </div>
            <div>
              <span>Efectivo</span>
              <strong>
                $
                {Number(resumenVentas.pagos.efectivo || 0).toLocaleString(
                  'es-AR',
                )}
              </strong>
            </div>
            <div>
              <span>Otros medios</span>
              <strong>
                $
                {['debito', 'credito', 'transferencia']
                  .reduce(
                    (suma, medioPago) =>
                      suma + Number(resumenVentas.pagos[medioPago] || 0),
                    0,
                  )
                  .toLocaleString('es-AR')}
              </strong>
            </div>
          </div>
          <article className="panel">
            <div className="panel__encabezado">
              <h3>Operaciones</h3>
              <span>
                Página {paginaVentas} de{' '}
                {Math.max(1, Math.ceil(resumenVentas.total / limiteVentas))}
              </span>
            </div>
            <div className="paginacion--superior">
              <Paginacion
                pagina={paginaVentas}
                paginas={Math.ceil(resumenVentas.total / limiteVentas)}
                limite={limiteVentas}
                alCambiarPagina={setPaginaVentas}
                alCambiarLimite={(v) => {
                  setLimiteVentas(v);
                  setPaginaVentas(1);
                }}
              />
            </div>
            {ventas.length ? (
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Venta</th>
                      <th>Fecha</th>
                      <th>Caja</th>
                      <th>Cajero</th>
                      <th>Cliente</th>
                      <th>Productos</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.map((venta) => (
                      <tr key={venta.id}>
                        <td>#{venta.id}</td>
                        <td>{formatearFechaHora(venta.fecha_creacion)}</td>
                        <td>{venta.caja}</td>
                        <td>{venta.nombre_usuario}</td>
                        <td>{venta.cliente || 'Consumidor final'}</td>
                        <td>{venta.productos}</td>
                        <td>
                          $
                          {Number(venta.total).toLocaleString('es-AR', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td>
                          <button
                            className="boton-tabla"
                            onClick={() => abrirVenta(venta.id)}
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
              <p className="vacio">
                No hay ventas para los filtros seleccionados.
              </p>
            )}
            <Paginacion
              pagina={paginaVentas}
              paginas={Math.ceil(resumenVentas.total / limiteVentas)}
              limite={limiteVentas}
              alCambiarPagina={setPaginaVentas}
              alCambiarLimite={(v) => {
                setLimiteVentas(v);
                setPaginaVentas(1);
              }}
            />
          </article>
        </div>
      )}
      <Modal
        abierto={modalCaja}
        titulo="Abrir caja"
        alCerrar={() => {
          if (!procesando) setModalCaja(false);
        }}
      >
        <form className="formulario-modal" onSubmit={abrirCaja}>
          <p>
            Seleccioná una caja libre e ingresá el efectivo disponible al
            comenzar el turno.
          </p>
          {cajasDisponibles.length ? (
            <>
              <div>
                <label htmlFor="caja_id">Caja</label>
                <select id="caja_id" name="caja_id" required defaultValue="">
                  <option value="" disabled>
                    Seleccionar caja disponible
                  </option>
                  {cajasDisponibles.map((caja) => (
                    <option key={caja.id} value={caja.id}>
                      {caja.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="monto_inicial">Monto inicial</label>
                <input
                  id="monto_inicial"
                  name="monto_inicial"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  onFocus={(evento) => evento.currentTarget.select()}
                  required
                />
              </div>
              <div>
                <label htmlFor="cuenta_origen_id">
                  Origen del fondo inicial
                </label>
                <select
                  id="cuenta_origen_id"
                  name="cuenta_origen_id"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Seleccionar cuenta de efectivo
                  </option>
                  {cuentasEfectivo.map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.nombre} · disponible $
                      {Number(cuenta.saldo).toLocaleString('es-AR')}
                    </option>
                  ))}
                </select>
                <small className="dato-secundario">
                  El fondo se descontará automáticamente de Tesorería.
                </small>
              </div>
            </>
          ) : (
            <p className="mensaje-error">
              No hay cajas disponibles. Debe cerrarse una sesión antes de abrir
              otra.
            </p>
          )}
          <div className="modal__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              disabled={procesando}
              onClick={() => setModalCaja(false)}
            >
              Cancelar
            </button>
            <button
              className="boton"
              disabled={procesando || !cajasDisponibles.length}
            >
              {procesando ? 'Abriendo…' : 'Abrir caja'}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        abierto={modalCobro}
        titulo="Confirmar cobro"
        alCerrar={() => {
          if (!procesando) setModalCobro(false);
        }}
      >
        <div className="formulario-modal">
          <p className="importe-cobro">
            Total a cobrar{' '}
            <strong>
              ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </strong>
          </p>
          <div>
            <label htmlFor="cliente_venta">Cliente</label>
            <select
              id="cliente_venta"
              value={clienteId}
              onChange={(evento) => setClienteId(evento.target.value)}
            >
              <option value="">Consumidor final</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                  {cliente.numero_documento
                    ? ` · ${cliente.numero_documento}`
                    : ''}
                </option>
              ))}
            </select>
          </div>
          {clienteSeleccionado && (
            <div className="resumen-credito-cliente">
              <span>Saldo actual</span>
              <strong>
                ${Number(clienteSeleccionado.saldo).toLocaleString('es-AR')}
              </strong>
              <span>Crédito disponible</span>
              <strong>
                {clienteSeleccionado.credito_habilitado
                  ? `$${Number(clienteSeleccionado.disponible).toLocaleString('es-AR')}`
                  : 'No habilitado'}
              </strong>
            </div>
          )}
          <div className="medios-pago">
            {[
              ['efectivo', 'Efectivo entregado'],
              ['debito', 'Débito'],
              ['credito', 'Tarjeta de crédito'],
              ['transferencia', 'Transferencia'],
            ].map(([clave, etiqueta]) => (
              <div key={clave}>
                <label htmlFor={`pago_${clave}`}>{etiqueta}</label>
                <div className="importe-medio">
                  <input
                    id={`pago_${clave}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={clave === 'efectivo' ? recibido : pagosVenta[clave]}
                    onFocus={(evento) => evento.currentTarget.select()}
                    onChange={(evento) => {
                      const valorIngresado = evento.target.value;
                      if (clave === 'efectivo') {
                        const otrosMedios = Object.entries(pagosVenta)
                          .filter(([medio]) => medio !== 'efectivo')
                          .reduce(
                            (suma, [, importe]) => suma + Number(importe || 0),
                            0,
                          );
                        const maximoAplicable = Math.max(
                          0,
                          total - otrosMedios,
                        );
                        const efectivoAplicado =
                          Number(valorIngresado) > maximoAplicable
                            ? maximoAplicable.toFixed(2)
                            : valorIngresado;
                        setPagosVenta((actual) => ({
                          ...actual,
                          efectivo: efectivoAplicado,
                        }));
                        setRecibido(valorIngresado);
                        return;
                      }
                      setPagosVenta((actual) => ({
                        ...actual,
                        [clave]: valorIngresado,
                      }));
                    }}
                  />
                  <button
                    type="button"
                    className="boton-tabla"
                    onClick={() => completarSaldo(clave)}
                  >
                    Saldo
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div
            className={`saldo-pago ${Math.abs(saldoPago) < 0.009 ? 'saldo-pago--completo' : ''}`}
          >
            <span>
              {saldoPago > 0.009
                ? 'A cuenta corriente'
                : saldoPago < -0.009
                  ? 'Importe excedido'
                  : 'Pago completo'}
            </span>
            <strong>
              $
              {Math.abs(saldoPago).toLocaleString('es-AR', {
                minimumFractionDigits: 2,
              })}
            </strong>
          </div>
          <p
            className={`mensaje-error reserva-aviso-cobro ${saldoPago > 0.009 && !creditoValido ? '' : 'reserva-aviso-cobro--oculta'}`}
            aria-hidden={!(saldoPago > 0.009 && !creditoValido)}
          >
            Seleccioná un cliente con crédito habilitado y límite disponible
            suficiente.
          </p>
          <p
            className={`reserva-vuelto-cobro ${Number(pagosVenta.efectivo) > 0 ? '' : 'reserva-aviso-cobro--oculta'}`}
            aria-hidden={!(Number(pagosVenta.efectivo) > 0)}
          >
            Vuelto:{' '}
            <strong>
              ${vuelto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </strong>
          </p>
          <div className="modal__acciones">
            <button
              className="boton boton--secundario"
              disabled={procesando}
              onClick={() => setModalCobro(false)}
            >
              Cancelar
            </button>
            <button
              className="boton"
              disabled={
                procesando ||
                saldoPago < -0.009 ||
                !creditoValido ||
                (Number(pagosVenta.efectivo) > 0 &&
                  Number(recibido) < Number(pagosVenta.efectivo))
              }
              onClick={cobrar}
            >
              {procesando
                ? 'Registrando…'
                : saldoPago > 0.009
                  ? 'Confirmar venta a crédito'
                  : 'Confirmar venta'}
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        abierto={modalCierre}
        titulo="Cerrar caja"
        alCerrar={() => {
          if (!procesando) setModalCierre(false);
        }}
      >
        {resumenCierre && (
          <div className="formulario-modal">
            <div className="resumen-caja">
              <span>Monto inicial</span>
              <strong>
                $
                {Number(resumenCierre.monto_inicial).toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                })}
              </strong>
              <span>Ventas en efectivo</span>
              <strong>
                $
                {Number(resumenCierre.pagos.efectivo || 0).toLocaleString(
                  'es-AR',
                  { minimumFractionDigits: 2 },
                )}
              </strong>
              <span>Cobranzas en efectivo</span>
              <strong>
                $
                {Number(resumenCierre.cobranzas?.efectivo || 0).toLocaleString(
                  'es-AR',
                  { minimumFractionDigits: 2 },
                )}
              </strong>
              <span>Ingresos manuales</span>
              <strong>
                $
                {Number(resumenCierre.ingresos).toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                })}
              </strong>
              <span>Egresos manuales</span>
              <strong>
                -$
                {Number(resumenCierre.egresos).toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                })}
              </strong>
              <span>Pagos a proveedores</span>
              <strong>
                -$
                {Number(
                  resumenCierre.pagos_proveedores_efectivo || 0,
                ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </strong>
              <span>Gastos y servicios</span>
              <strong>
                -$
                {Number(
                  resumenCierre.pagos_gastos_efectivo || 0,
                ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </strong>
              <span>Sueldos</span>
              <strong>
                -$
                {Number(
                  resumenCierre.pagos_sueldos_efectivo || 0,
                ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </strong>
              <span>Adelantos al personal</span>
              <strong>
                -$
                {Number(
                  resumenCierre.adelantos_empleados_efectivo || 0,
                ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </strong>
              <span>Débito</span>
              <strong>
                $
                {Number(resumenCierre.pagos.debito || 0).toLocaleString(
                  'es-AR',
                  { minimumFractionDigits: 2 },
                )}
              </strong>
              <span>Crédito</span>
              <strong>
                $
                {Number(resumenCierre.pagos.credito || 0).toLocaleString(
                  'es-AR',
                  { minimumFractionDigits: 2 },
                )}
              </strong>
              <span>Transferencias</span>
              <strong>
                $
                {Number(resumenCierre.pagos.transferencia || 0).toLocaleString(
                  'es-AR',
                  { minimumFractionDigits: 2 },
                )}
              </strong>
              <span className="resumen-caja__total">Efectivo esperado</span>
              <strong className="resumen-caja__total">
                $
                {Number(resumenCierre.efectivo_esperado).toLocaleString(
                  'es-AR',
                  { minimumFractionDigits: 2 },
                )}
              </strong>
            </div>
            <div>
              <label htmlFor="monto_contado">Efectivo contado</label>
              <input
                id="monto_contado"
                type="number"
                min="0"
                step="0.01"
                value={montoContado}
                onFocus={(evento) => evento.currentTarget.select()}
                onChange={(evento) => setMontoContado(evento.target.value)}
              />
            </div>
            <p>
              Diferencia:{' '}
              <strong>
                $
                {(
                  Number(montoContado || 0) -
                  Number(resumenCierre.efectivo_esperado)
                ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </strong>
            </p>
            <label className="opcion-rendicion">
              <input
                type="checkbox"
                checked={rendirAlCerrar}
                onChange={(evento) => setRendirAlCerrar(evento.target.checked)}
              />
              Rendir ahora el efectivo contado a Tesorería
            </label>
            {rendirAlCerrar && (
              <div>
                <label htmlFor="cuenta_rendicion">Destino del efectivo</label>
                <select
                  id="cuenta_rendicion"
                  value={cuentaRendicion}
                  onChange={(evento) => setCuentaRendicion(evento.target.value)}
                  required
                >
                  <option value="" disabled>
                    Seleccionar cuenta de efectivo
                  </option>
                  {cuentasEfectivo.map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!rendirAlCerrar && (
              <p className="dato-secundario">
                La caja quedará cerrada y pendiente de rendición. Un supervisor
                podrá rendirla desde el historial.
              </p>
            )}
            <div className="modal__acciones">
              <button
                className="boton boton--secundario"
                disabled={procesando}
                onClick={() => setModalCierre(false)}
              >
                Cancelar
              </button>
              <button
                className="boton"
                disabled={
                  procesando ||
                  montoContado === '' ||
                  (rendirAlCerrar && !cuentaRendicion)
                }
                onClick={cerrarCaja}
              >
                {procesando ? 'Cerrando…' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        abierto={modalMovimiento}
        titulo="Movimiento de caja"
        alCerrar={() => {
          if (!procesando) setModalMovimiento(false);
        }}
      >
        <form className="formulario-modal" onSubmit={guardarMovimiento}>
          <div>
            <label htmlFor="tipo_movimiento">Tipo</label>
            <select
              id="tipo_movimiento"
              value={tipoMovimiento}
              onChange={(evento) => setTipoMovimiento(evento.target.value)}
            >
              <option value="ingreso">Ingreso de efectivo</option>
              <option value="egreso">Egreso de efectivo</option>
            </select>
          </div>
          <div>
            <label htmlFor="monto_movimiento">Monto</label>
            <input
              id="monto_movimiento"
              name="monto"
              type="number"
              min="0.01"
              step="0.01"
              onFocus={(evento) => evento.currentTarget.select()}
              required
            />
          </div>
          <div>
            <label htmlFor="motivo_movimiento">Motivo</label>
            <textarea
              id="motivo_movimiento"
              name="motivo"
              minLength="5"
              maxLength="255"
              rows="3"
              required
            />
          </div>
          <div className="modal__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setModalMovimiento(false)}
            >
              Cancelar
            </button>
            <button className="boton" disabled={procesando}>
              {procesando ? 'Registrando…' : 'Registrar movimiento'}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        abierto={modalHistorialCajas}
        titulo="Historial de cajas"
        ancho="grande"
        alCerrar={() => setModalHistorialCajas(false)}
      >
        <div className="barra-filtros filtros-historial-cajas">
          <div>
            <label htmlFor="cajas_desde">Desde</label>
            <input
              id="cajas_desde"
              type="date"
              value={fechaDesdeCajas}
              onChange={(evento) => {
                setFechaDesdeCajas(evento.target.value);
                setPaginaCajas(1);
              }}
            />
          </div>
          <div>
            <label htmlFor="cajas_hasta">Hasta</label>
            <input
              id="cajas_hasta"
              type="date"
              value={fechaHastaCajas}
              onChange={(evento) => {
                setFechaHastaCajas(evento.target.value);
                setPaginaCajas(1);
              }}
            />
          </div>
          <div>
            <label htmlFor="cajas_estado">Caja</label>
            <select
              id="cajas_estado"
              value={estadoCajas}
              onChange={(evento) => {
                setEstadoCajas(evento.target.value);
                setPaginaCajas(1);
              }}
            >
              <option value="">Todas</option>
              <option value="abierta">Abiertas</option>
              <option value="cerrada">Cerradas</option>
            </select>
          </div>
          <div>
            <label htmlFor="cajas_rendicion">Rendición</label>
            <select
              id="cajas_rendicion"
              value={rendicionCajas}
              onChange={(evento) => {
                setRendicionCajas(evento.target.value);
                setPaginaCajas(1);
              }}
            >
              <option value="">Todas</option>
              <option value="pendiente">Pendientes</option>
              <option value="rendida">Rendidas</option>
            </select>
          </div>
        </div>
        <p className="filtro-activo">
          Mostrando {totalSesionesCaja.toLocaleString('es-AR')} sesiones de
          caja.
        </p>
        <div className="paginacion--superior">
          <Paginacion
            pagina={paginaCajas}
            paginas={Math.ceil(totalSesionesCaja / limiteCajas)}
            limite={limiteCajas}
            alCambiarPagina={setPaginaCajas}
            alCambiarLimite={(v) => {
              setLimiteCajas(v);
              setPaginaCajas(1);
            }}
          />
        </div>
        <div className="historial-cajas">
          {sesionesCaja.map((item) => {
            const moneda = (valor) =>
              Number(valor).toLocaleString('es-AR', {
                style: 'currency',
                currency: 'ARS',
                minimumFractionDigits: 2,
              });
            const diferencia = Number(item.diferencia_cierre || 0);
            return (
              <article className="cierre-caja" key={item.id}>
                <header className="cierre-caja__cabecera">
                  <div>
                    <h3>{item.caja}</h3>
                    <p>{item.nombre_usuario}</p>
                  </div>
                  <div className="cierre-caja__fechas">
                    <span>
                      Apertura{' '}
                      <strong>{formatearFechaHora(item.fecha_apertura)}</strong>
                    </span>
                    <span>
                      Cierre{' '}
                      <strong>
                        {item.fecha_cierre
                          ? formatearFechaHora(item.fecha_cierre)
                          : '—'}
                      </strong>
                    </span>
                  </div>
                  <span
                    className={
                      item.estado === 'abierta'
                        ? 'estado-activo'
                        : 'estado-inactivo'
                    }
                  >
                    {item.estado}
                  </span>
                </header>
                <div className="cierre-caja__grupos">
                  <section>
                    <h4>Ingresos en efectivo</h4>
                    <div>
                      <span>Fondo inicial</span>
                      <strong>{moneda(item.monto_inicial)}</strong>
                    </div>
                    <div>
                      <span>Ventas</span>
                      <strong>{moneda(item.ventas_efectivo)}</strong>
                    </div>
                    <div>
                      <span>Cobranzas</span>
                      <strong>{moneda(item.cobranzas_efectivo)}</strong>
                    </div>
                    <div>
                      <span>Cambios</span>
                      <strong>{moneda(item.cambios_cobros)}</strong>
                    </div>
                    <div>
                      <span>Otros ingresos</span>
                      <strong>{moneda(item.otros_ingresos)}</strong>
                    </div>
                    <small>
                      Ventas totales por todos los medios: {moneda(item.ventas)}
                    </small>
                  </section>
                  <section>
                    <h4>Egresos en efectivo</h4>
                    <div>
                      <span>Reintegros</span>
                      <strong>-{moneda(item.reintegros)}</strong>
                    </div>
                    <div>
                      <span>Operativos</span>
                      <strong>-{moneda(item.egresos_operativos)}</strong>
                    </div>
                    <div>
                      <span>Otros egresos</span>
                      <strong>-{moneda(item.otros_egresos)}</strong>
                    </div>
                  </section>
                  <section className="cierre-caja__control">
                    <h4>Control del cierre</h4>
                    <div>
                      <span>Efectivo esperado</span>
                      <strong>{moneda(item.efectivo_esperado)}</strong>
                    </div>
                    <div>
                      <span>Efectivo contado</span>
                      <strong>
                        {item.monto_contado_cierre == null
                          ? '—'
                          : moneda(item.monto_contado_cierre)}
                      </strong>
                    </div>
                    <div
                      className={
                        Math.abs(diferencia) > 0.009
                          ? 'cierre-caja__diferencia cierre-caja__diferencia--alerta'
                          : 'cierre-caja__diferencia'
                      }
                    >
                      <span>Diferencia</span>
                      <strong>
                        {item.diferencia_cierre == null
                          ? '—'
                          : moneda(item.diferencia_cierre)}
                      </strong>
                    </div>
                    <div>
                      <span>Rendición</span>
                      <strong
                        className={
                          item.estado_rendicion === 'pendiente' &&
                          item.estado === 'cerrada'
                            ? 'estado-rendicion--pendiente'
                            : item.estado_rendicion === 'rendida'
                              ? 'estado-rendicion--rendida'
                              : ''
                        }
                      >
                        {item.estado === 'abierta'
                          ? '—'
                          : item.estado_rendicion}
                      </strong>
                    </div>
                    {item.estado_rendicion === 'rendida' && (
                      <small>
                        {moneda(item.monto_rendido)} en{' '}
                        {item.cuenta_destino_rendicion} ·{' '}
                        {formatearFechaHora(item.fecha_rendicion)}
                      </small>
                    )}
                    {item.estado === 'cerrada' &&
                      item.estado_rendicion === 'pendiente' &&
                      permisos.includes('caja.supervisar') && (
                        <button
                          className="boton-tabla cierre-caja__rendir"
                          onClick={() => {
                            setCuentaRendicion(
                              cuentasEfectivo[0]?.id
                                ? String(cuentasEfectivo[0].id)
                                : '',
                            );
                            setSesionARendir(item);
                          }}
                        >
                          Rendir efectivo
                        </button>
                      )}
                  </section>
                </div>
              </article>
            );
          })}
        </div>
        {!sesionesCaja.length && (
          <p className="vacio">No hay cajas para los filtros seleccionados.</p>
        )}
        <div className="paginacion">
          <Paginacion
            pagina={paginaCajas}
            paginas={Math.ceil(totalSesionesCaja / limiteCajas)}
            limite={limiteCajas}
            alCambiarPagina={setPaginaCajas}
            alCambiarLimite={(v) => {
              setLimiteCajas(v);
              setPaginaCajas(1);
            }}
          />
          {/*
          <button
            disabled={paginaCajas === 1}
            onClick={() => setPaginaCajas((pagina) => pagina - 1)}
          >
            Anterior
          </button>
          <span>
            Página {paginaCajas} de{' '}
            {Math.max(1, Math.ceil(totalSesionesCaja / limiteCajas))}
          </span>
          <button
            disabled={paginaCajas >= Math.ceil(totalSesionesCaja / limiteCajas)}
            onClick={() => setPaginaCajas((pagina) => pagina + 1)}
          >
            Siguiente
          </button>
          */}
        </div>
        <div className="modal__acciones">
          <button
            className="boton boton--secundario"
            onClick={() => setModalHistorialCajas(false)}
          >
            Cerrar
          </button>
        </div>
      </Modal>
      <Modal
        abierto={Boolean(sesionARendir)}
        titulo={sesionARendir ? `Rendir ${sesionARendir.caja}` : 'Rendir caja'}
        alCerrar={() => {
          if (!procesando) setSesionARendir(null);
        }}
      >
        {sesionARendir && (
          <div className="formulario-modal">
            <p>
              Se ingresarán{' '}
              <strong>
                $
                {Number(sesionARendir.monto_contado_cierre).toLocaleString(
                  'es-AR',
                  { minimumFractionDigits: 2 },
                )}
              </strong>{' '}
              en la cuenta seleccionada.
            </p>
            {!sesionARendir.cuenta_origen_apertura_id &&
              Number(sesionARendir.monto_inicial) > 0 && (
                <p className="mensaje">
                  Esta sesión es anterior a la integración. También se
                  registrará el egreso histórico de su fondo inicial de $
                  {Number(sesionARendir.monto_inicial).toLocaleString('es-AR')}{' '}
                  para evitar duplicar dinero.
                </p>
              )}
            <div>
              <label htmlFor="cuenta_rendicion_pendiente">
                Cuenta de efectivo
              </label>
              <select
                id="cuenta_rendicion_pendiente"
                value={cuentaRendicion}
                onChange={(evento) => setCuentaRendicion(evento.target.value)}
              >
                <option value="" disabled>
                  Seleccionar cuenta
                </option>
                {cuentasEfectivo.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.nombre} · saldo $
                    {Number(cuenta.saldo).toLocaleString('es-AR')}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal__acciones">
              <button
                className="boton boton--secundario"
                disabled={procesando}
                onClick={() => setSesionARendir(null)}
              >
                Cancelar
              </button>
              <button
                className="boton"
                disabled={procesando || !cuentaRendicion}
                onClick={rendirSesion}
              >
                {procesando ? 'Rindiendo…' : 'Confirmar rendición'}
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        abierto={Boolean(ventaDetalle)}
        titulo={ventaDetalle ? `Venta #${ventaDetalle.id}` : 'Detalle de venta'}
        ancho="grande"
        alCerrar={() => setVentaDetalle(null)}
      >
        {ventaDetalle && (
          <div className="comprobante-venta">
            <div className="encabezado-ticket">
              <img
                src="/marca/logo-horizontal-claro.png"
                alt="La 91 Supermercado"
              />
              <p>Comprobante interno no fiscal</p>
              <strong>Venta #{ventaDetalle.id}</strong>
            </div>
            <div className="detalle-venta-cabecera">
              <span>{formatearFechaHora(ventaDetalle.fecha_creacion)}</span>
              <span>{ventaDetalle.caja}</span>
              <span>Cajero: {ventaDetalle.nombre_usuario}</span>
              <span>Cliente: {ventaDetalle.cliente || 'Consumidor final'}</span>
              <span
                className={
                  ventaDetalle.estado === 'completada'
                    ? 'estado-activo'
                    : 'estado-inactivo'
                }
              >
                {ventaDetalle.estado}
              </span>
            </div>
            {ventaDetalle.estado === 'anulada' && (
              <p className="mensaje-error">
                Anulada: {ventaDetalle.motivo_anulacion}
              </p>
            )}
            <div className="tabla-contenedor tabla-items-compra">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Código</th>
                    <th>Cantidad</th>
                    <th>Devuelto</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {ventaDetalle.detalles.map((detalle, indice) => (
                    <tr key={`${detalle.codigo_barra}-${indice}`}>
                      <td>{detalle.nombre}</td>
                      <td>{detalle.codigo_barra}</td>
                      <td>
                        {Number(detalle.cantidad).toLocaleString('es-AR')}
                      </td>
                      <td>
                        {Number(detalle.cantidad_devuelta).toLocaleString(
                          'es-AR',
                        )}
                      </td>
                      <td>
                        $
                        {Number(detalle.precio_unitario).toLocaleString(
                          'es-AR',
                          { minimumFractionDigits: 2 },
                        )}
                      </td>
                      <td>
                        $
                        {Number(detalle.subtotal).toLocaleString('es-AR', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ventaDetalle.devoluciones.length > 0 && (
              <div className="devoluciones-previas">
                <h3>Cambios y devoluciones</h3>
                {ventaDetalle.devoluciones.map((devolucion) => (
                  <div key={devolucion.id} className="devolucion-registrada">
                    <p>
                      #{devolucion.id} ·{' '}
                      {formatearFechaHora(devolucion.fecha_creacion)} ·{' '}
                      {devolucion.motivo} · Diferencia $
                      {Number(devolucion.diferencia).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    {devolucion.detalles.map((detalle) => (
                      <p key={detalle.id}>
                        {detalle.tipo === 'devuelto' ? 'Devuelto' : 'Reemplazo'}
                        : {Number(detalle.cantidad).toLocaleString('es-AR')} ×{' '}
                        {detalle.nombre} ({detalle.codigo_barra || 'sin código'}
                        ) · $
                        {Number(detalle.subtotal).toLocaleString('es-AR', {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div className="detalle-venta-pie">
              <div>
                {ventaDetalle.pagos.map((pago) => (
                  <span key={pago.medio}>
                    {pago.medio}: $
                    {Number(pago.monto).toLocaleString('es-AR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                ))}
                {Number(ventaDetalle.efectivo_recibido) > 0 && (
                  <>
                    <span>
                      Efectivo entregado: $
                      {Number(ventaDetalle.efectivo_recibido).toLocaleString(
                        'es-AR',
                        { minimumFractionDigits: 2 },
                      )}
                    </span>
                    <span>
                      Vuelto: $
                      {Number(ventaDetalle.vuelto).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </>
                )}
                {Number(ventaDetalle.saldo_pendiente) > 0 && (
                  <span>
                    Cuenta corriente:{' '}
                    {Number(ventaDetalle.saldo_pendiente).toLocaleString(
                      'es-AR',
                      { style: 'currency', currency: 'ARS' },
                    )}{' '}
                    · vence {formatearFecha(ventaDetalle.fecha_vencimiento)}
                  </span>
                )}
              </div>
              <strong>
                Total: $
                {Number(ventaDetalle.total).toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </div>
            <p className="pie-ticket">
              Gracias por su compra · LA 91 Supermercado
            </p>
            <div className="modal__acciones">
              <button
                className="boton boton--secundario"
                onClick={() => setVentaDetalle(null)}
              >
                Cerrar
              </button>
              <button
                className="boton boton--secundario"
                onClick={() => window.print()}
              >
                Imprimir ticket
              </button>
              {ventaDetalle.estado === 'completada' && (
                <>
                  {permisos.includes('ventas.devolver') && (
                    <button
                      className="boton boton--secundario"
                      onClick={() => iniciarCambio(ventaDetalle)}
                    >
                      Cambio / devolución
                    </button>
                  )}
                  {permisos.includes('ventas.anular') && (
                    <button
                      className="boton"
                      onClick={() => {
                        setVentaAAnular(ventaDetalle);
                        setVentaDetalle(null);
                      }}
                    >
                      Anular venta
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        abierto={Boolean(ventaAAnular)}
        titulo="Anular venta"
        alCerrar={() => {
          if (!procesando) setVentaAAnular(null);
        }}
      >
        {ventaAAnular && (
          <div className="formulario-modal">
            <p>
              La venta <strong>#{ventaAAnular.id}</strong> dejará de
              contabilizarse y sus productos volverán al stock.
            </p>
            <div>
              <label htmlFor="motivo_anulacion">Motivo de la anulación</label>
              <textarea
                id="motivo_anulacion"
                value={motivoAnulacion}
                onChange={(evento) => setMotivoAnulacion(evento.target.value)}
                minLength="5"
                maxLength="255"
                rows="3"
                required
              />
            </div>
            <div className="modal__acciones">
              <button
                className="boton boton--secundario"
                disabled={procesando}
                onClick={() => setVentaAAnular(null)}
              >
                Cancelar
              </button>
              <button
                className="boton"
                disabled={procesando || motivoAnulacion.trim().length < 5}
                onClick={anular}
              >
                {procesando ? 'Anulando…' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        abierto={Boolean(ventaCambio)}
        titulo={
          ventaCambio
            ? `Cambio / devolución de venta #${ventaCambio.id}`
            : 'Cambio / devolución'
        }
        ancho="grande"
        alCerrar={() => {
          if (!procesando) setVentaCambio(null);
        }}
      >
        {ventaCambio && (
          <div className="formulario-modal formulario-cambio">
            <h3>Productos que devuelve</h3>
            <div className="tabla-contenedor tabla-items-compra">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Disponible</th>
                    <th>Cantidad</th>
                    <th>Vuelve al stock</th>
                  </tr>
                </thead>
                <tbody>
                  {ventaCambio.detalles.map((detalle) => {
                    const disponible =
                      Number(detalle.cantidad) -
                      Number(detalle.cantidad_devuelta);
                    return (
                      <tr key={detalle.producto_id}>
                        <td>{detalle.nombre}</td>
                        <td>{disponible.toLocaleString('es-AR')}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={disponible}
                            step={detalle.es_pesable ? '0.001' : '1'}
                            value={
                              devueltos[detalle.producto_id]?.cantidad ?? 0
                            }
                            onFocus={(evento) => evento.currentTarget.select()}
                            onChange={(evento) =>
                              setDevueltos((actual) => ({
                                ...actual,
                                [detalle.producto_id]: {
                                  cantidad: evento.target.value,
                                  reintegra_stock:
                                    actual[detalle.producto_id]
                                      ?.reintegra_stock ?? true,
                                },
                              }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={
                              devueltos[detalle.producto_id]?.reintegra_stock ??
                              true
                            }
                            onChange={(evento) =>
                              setDevueltos((actual) => ({
                                ...actual,
                                [detalle.producto_id]: {
                                  cantidad:
                                    actual[detalle.producto_id]?.cantidad ?? 0,
                                  reintegra_stock: evento.target.checked,
                                },
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
            <h3>Productos de reemplazo</h3>
            <div className="buscador-productos-compra">
              <input
                ref={buscarReemplazoRef}
                value={buscarReemplazo}
                onChange={(evento) => {
                  setBuscarReemplazo(evento.target.value);
                  setReemplazoActivo(-1);
                }}
                onKeyDown={navegarReemplazos}
                placeholder="Buscar reemplazo por nombre o código"
              />
              {resultadosReemplazo.length > 0 && (
                <div className="resultados-productos">
                  {resultadosReemplazo.map((producto, indice) => (
                    <button
                      type="button"
                      key={producto.id}
                      className={
                        reemplazoActivo === indice ? 'resultado-activo' : ''
                      }
                      disabled={Number(producto.stock) <= 0}
                      onMouseEnter={() => setReemplazoActivo(indice)}
                      onClick={() => agregarReemplazo(producto)}
                    >
                      <span>{producto.nombre}</span>
                      <small>
                        {producto.codigo_barra} · Stock{' '}
                        {Number(producto.stock).toLocaleString('es-AR')} · $
                        {Number(producto.precio_venta).toLocaleString('es-AR')}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {reemplazos.length > 0 && (
              <div className="tabla-contenedor tabla-items-compra">
                <table>
                  <thead>
                    <tr>
                      <th>Reemplazo</th>
                      <th>Cantidad</th>
                      <th>Precio</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reemplazos.map((item) => (
                      <tr key={item.id}>
                        <td>{item.nombre}</td>
                        <td>
                          <input
                            type="number"
                            min={item.es_pesable ? '0.001' : '1'}
                            max={item.stock}
                            step={item.es_pesable ? '0.001' : '1'}
                            value={item.cantidad}
                            onChange={(evento) =>
                              setReemplazos((actual) =>
                                actual.map((otro) =>
                                  otro.id === item.id
                                    ? { ...otro, cantidad: evento.target.value }
                                    : otro,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          ${Number(item.precio_venta).toLocaleString('es-AR')}
                        </td>
                        <td>
                          <button
                            className="boton-tabla"
                            onClick={() =>
                              setReemplazos((actual) =>
                                actual.filter((otro) => otro.id !== item.id),
                              )
                            }
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="resumen-cambio">
              <span>Crédito por devolución</span>
              <strong>${totalDevuelto.toLocaleString('es-AR')}</strong>
              <span>Productos nuevos</span>
              <strong>${totalReemplazo.toLocaleString('es-AR')}</strong>
              <span>Diferencia</span>
              <strong>${diferenciaCambio.toLocaleString('es-AR')}</strong>
            </div>
            {Math.abs(diferenciaCambio) > 0.009 && (
              <div>
                <label>
                  Medio de {diferenciaCambio > 0 ? 'cobro' : 'reintegro'}
                </label>
                <select
                  value={medioDiferencia}
                  onChange={(evento) => setMedioDiferencia(evento.target.value)}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="debito">Débito</option>
                  <option value="credito">Crédito</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
            )}
            <div>
              <label>Motivo</label>
              <textarea
                value={motivoCambio}
                onChange={(evento) => setMotivoCambio(evento.target.value)}
                minLength="5"
                maxLength="255"
                rows="2"
              />
            </div>
            <div className="modal__acciones">
              <button
                className="boton boton--secundario"
                disabled={procesando}
                onClick={() => setVentaCambio(null)}
              >
                Cancelar
              </button>
              <button
                className="boton"
                disabled={
                  procesando ||
                  motivoCambio.trim().length < 5 ||
                  totalDevuelto <= 0
                }
                onClick={confirmarCambio}
              >
                {procesando
                  ? 'Registrando…'
                  : diferenciaCambio > 0
                    ? 'Cobrar diferencia'
                    : diferenciaCambio < 0
                      ? 'Reintegrar diferencia'
                      : 'Confirmar cambio'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
