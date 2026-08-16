import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CampoClave } from './componentes/CampoClave.jsx';
import { Modal } from './componentes/Modal.jsx';
import { Paginacion } from './componentes/Paginacion.jsx';

const dinero = (n) =>
  Number(n || 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
  });
const TOKEN = 'la91_cliente_token';
export function MapaEntrega({ origen, ubicacion, alCambiar, mostrarRecorrido = true, recorrido = [] }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const marcadorEntrega = useRef(null);
  const lineaEntrega = useRef(null);
  const alCambiarRef = useRef(alCambiar);
  alCambiarRef.current = alCambiar;

  useEffect(() => {
    if (!contenedor.current || mapa.current || !origen) return undefined;
    const instancia = L.map(contenedor.current, {
      center: [origen.latitud, origen.longitud],
      zoom: 13,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(instancia);
    L.circleMarker([origen.latitud, origen.longitud], {
      radius: 7,
      color: '#003b46',
      fillColor: '#66a5ad',
      fillOpacity: 1,
    })
      .addTo(instancia)
      .bindTooltip('La 91 Supermercado');
    instancia.on('click', ({ latlng }) =>
      alCambiarRef.current({ latitud: latlng.lat, longitud: latlng.lng }),
    );
    mapa.current = instancia;
    setTimeout(() => instancia.invalidateSize(), 0);
    return () => {
      instancia.remove();
      mapa.current = null;
      marcadorEntrega.current = null;
      lineaEntrega.current = null;
    };
  }, [origen]);

  useEffect(() => {
    if (!mapa.current || !ubicacion) return;
    const punto = [ubicacion.latitud, ubicacion.longitud];
    if (!marcadorEntrega.current) {
      const icono = L.divIcon({
        className: 'marcador-entrega',
        html: '<span class="marcador-entrega__pin"></span>',
        iconSize: [30, 38],
        iconAnchor: [15, 38],
        tooltipAnchor: [0, -34],
      })
      marcadorEntrega.current = L.marker(punto, { icon: icono })
        .addTo(mapa.current)
        .bindTooltip('Dirección de entrega');
    } else marcadorEntrega.current.setLatLng(punto);
    const puntosRecorrido = recorrido.length
      ? recorrido
      : [
          [origen.latitud, origen.longitud],
          punto,
        ];
    if (mostrarRecorrido && !lineaEntrega.current) {
      lineaEntrega.current = L.polyline(
        puntosRecorrido,
        { color: '#07575b', weight: 4, opacity: 0.85 },
      ).addTo(mapa.current);
    } else if (mostrarRecorrido) {
      lineaEntrega.current.setLatLngs(puntosRecorrido);
    }
    if (mostrarRecorrido && recorrido.length) {
      mapa.current.fitBounds(lineaEntrega.current.getBounds(), { padding: [24, 24] });
    } else mapa.current.setView(punto, 15);
  }, [mostrarRecorrido, origen, recorrido, ubicacion]);

  return <div className="mapa-entrega" ref={contenedor} />;
}

async function api(ruta, opciones = {}) {
  const respuesta = await fetch(`/api/ecommerce${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.headers || {}),
    },
  });
  const datos = await respuesta.json();
  if (!respuesta.ok)
    throw new Error(datos.mensaje || 'No fue posible completar la operación');
  return datos;
}

export function Tienda() {
  const [portada, setPortada] = useState(null);
  const [productos, setProductos] = useState([]);
  const [productosPromocion, setProductosPromocion] = useState([]);
  const [total, setTotal] = useState(0);
  const [buscar, setBuscar] = useState('');
  const [categoria, setCategoria] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [modal, setModal] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [pedido, setPedido] = useState(null);
  const [cotizacion, setCotizacion] = useState(null);
  const [modalidadCheckout, setModalidadCheckout] = useState('retiro');
  const [zonaCheckout, setZonaCheckout] = useState('');
  const [localidadCheckout, setLocalidadCheckout] = useState('La Plata');
  const [ubicacionCheckout, setUbicacionCheckout] = useState(null);
  const [distanciaCheckout, setDistanciaCheckout] = useState(1);
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);
  const [calculandoRuta, setCalculandoRuta] = useState(false);
  const [recorridoCheckout, setRecorridoCheckout] = useState([]);
  const solicitudRuta = useRef(0);
  const [cuponCheckout, setCuponCheckout] = useState('');
  const [cuponAplicado, setCuponAplicado] = useState('');
  const [cliente, setCliente] = useState(null);
  const [favoritos, setFavoritos] = useState([]);
  const [favoritosDetalle, setFavoritosDetalle] = useState([]);
  const [valoraciones, setValoraciones] = useState({});
  const [promocionActiva, setPromocionActiva] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(25);
  const apiCliente = (ruta, opciones = {}) =>
    api(`/cliente${ruta}`, {
      ...opciones,
      headers: {
        Authorization: `Bearer ${localStorage.getItem(TOKEN)}`,
        ...(opciones.headers || {}),
      },
    });
  const cargarPreferencias = async () => {
    const [perfil, preferencias] = await Promise.all([
      apiCliente('/perfil'),
      apiCliente('/preferencias'),
    ]);
    setCliente(perfil.dato);
    setFavoritos(preferencias.dato.favoritos);
    setValoraciones(preferencias.dato.valoraciones);
  };
  const cargar = async () => {
    const filtroCategoria = categoria ? `&categoria_id=${categoria}` : '';
    const [p, listado, promociones] = await Promise.all([
      api('/publico/configuracion'),
      api(
        `/publico/productos?buscar=${encodeURIComponent(buscar)}${filtroCategoria}&pagina=${pagina}&limite=${limite}`,
      ),
      api('/publico/productos?promociones=true&limite=12'),
    ]);
    setPortada(p.dato);
    setProductos(listado.datos);
    setProductosPromocion(promociones.datos);
    setTotal(listado.total);
  };
  // La búsqueda se demora para evitar una solicitud por cada tecla.
  useEffect(() => {
    const demora = setTimeout(
      () => cargar().catch((e) => setMensaje(e.message)),
      250,
    );
    return () => clearTimeout(demora);
    // La recarga depende exclusivamente de los filtros visibles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscar, categoria, pagina, limite]);
  useEffect(() => {
    if (!localStorage.getItem(TOKEN)) return;
    cargarPreferencias().catch(() => localStorage.removeItem(TOKEN));
    // Solo se recupera la sesión guardada al montar la tienda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (productosPromocion.length < 2) return undefined;
    const intervalo = setInterval(
      () =>
        setPromocionActiva(
          (actual) => (actual + 1) % productosPromocion.length,
        ),
      6000,
    );
    return () => clearInterval(intervalo);
  }, [productosPromocion.length]);
  const importe = useMemo(
    () => carrito.reduce((s, i) => s + Number(i.precio) * i.cantidad, 0),
    [carrito],
  );
  const origenEntrega = useMemo(() => {
    const latitud = Number(portada?.configuracion?.latitud_origen);
    const longitud = Number(portada?.configuracion?.longitud_origen);
    return Number.isFinite(latitud) && Number.isFinite(longitud)
      ? { latitud, longitud }
      : null;
  }, [portada]);
  const aplicarUbicacion = async (ubicacion) => {
    setUbicacionCheckout(ubicacion);
    setRecorridoCheckout([]);
    setDistanciaCheckout('');
    const solicitud = ++solicitudRuta.current;
    setCalculandoRuta(true);
    setMensaje('Calculando recorrido por calles…');
    try {
      const configuracionActual = await api('/publico/configuracion');
      if (solicitud !== solicitudRuta.current) return false;
      setPortada(configuracionActual.dato);
      const latitudOrigen = Number(configuracionActual.dato.configuracion.latitud_origen);
      const longitudOrigen = Number(configuracionActual.dato.configuracion.longitud_origen);
      if (!Number.isFinite(latitudOrigen) || !Number.isFinite(longitudOrigen)) {
        throw new Error('El comercio no tiene una ubicación válida configurada.');
      }
      const coordenadas = `${longitudOrigen},${latitudOrigen};${ubicacion.longitud},${ubicacion.latitud}`;
      const respuesta = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordenadas}?overview=full&geometries=geojson&steps=false`);
      if (!respuesta.ok) throw new Error('No se pudo consultar el recorrido.');
      const resultado = await respuesta.json();
      const ruta = resultado.code === 'Ok' ? resultado.routes?.[0] : null;
      if (!ruta) throw new Error('No encontramos un recorrido por calles hasta ese punto.');
      if (solicitud !== solicitudRuta.current) return false;
      const distancia = Number((Number(ruta.distance) / 1000).toFixed(1));
      setDistanciaCheckout(distancia);
      setRecorridoCheckout(
        ruta.geometry.coordinates.map(([longitud, latitud]) => [latitud, longitud]),
      );
      setMensaje(`Recorrido calculado: ${distancia.toLocaleString('es-AR')} km por calles.`);
      return true;
    } catch (error) {
      if (solicitud !== solicitudRuta.current) return false;
      setDistanciaCheckout('');
      setMensaje(`${error.message} Elegí otro punto o volvé a intentarlo.`);
      return false;
    } finally {
      if (solicitud === solicitudRuta.current) setCalculandoRuta(false);
    }
  };
  useEffect(() => {
    if (!portada || modalidadCheckout !== 'envio') return;
    const distancia = Number(distanciaCheckout);
    const zona = portada.zonas.find(
      (item) =>
        item.localidad === localidadCheckout &&
        distancia >= Number(item.distancia_desde_km) &&
        distancia <= Number(item.distancia_hasta_km),
    );
    setZonaCheckout(zona ? String(zona.id) : '');
  }, [distanciaCheckout, localidadCheckout, modalidadCheckout, portada]);

  async function buscarDireccionEntrega(formulario) {
    const f = new FormData(formulario);
    const calle = String(f.get('calle') || '').trim();
    const numero = String(f.get('numero') || '').trim();
    if (!calle || !numero) {
      setMensaje('Ingresá la calle y el número antes de buscar en el mapa.');
      return;
    }
    setBuscandoDireccion(true);
    setMensaje('');
    try {
      const consulta = encodeURIComponent(
        `${calle} ${numero}, ${localidadCheckout}, Buenos Aires, Argentina`,
      );
      const respuesta = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ar&limit=1&q=${consulta}`,
      );
      if (!respuesta.ok) throw new Error('No se pudo consultar la dirección');
      const [resultado] = await respuesta.json();
      if (!resultado) throw new Error('No encontramos esa dirección en el mapa');
      await aplicarUbicacion({
        latitud: Number(resultado.lat),
        longitud: Number(resultado.lon),
      });
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setBuscandoDireccion(false);
    }
  }
  useEffect(() => {
    if (!carrito.length) {
      setCotizacion(null);
      return;
    }
    const demora = setTimeout(
      () =>
        api('/publico/cotizacion', {
          method: 'POST',
          body: JSON.stringify({
            cupon_codigo: cuponAplicado || null,
            items: carrito.map((i) => ({
              producto_id: i.id,
              cantidad: i.cantidad,
            })),
          }),
        })
          .then((r) => setCotizacion(r.dato))
          .catch((e) => setMensaje(e.message)),
      150,
    );
    return () => clearTimeout(demora);
  }, [carrito, cuponAplicado]);
  const agregar = (p) =>
    setCarrito((actual) => {
      const existe = actual.find((i) => i.id === p.id);
      if (existe)
        return actual.map((i) =>
          i.id === p.id
            ? {
                ...i,
                cantidad: Math.min(
                  i.cantidad + 1,
                  Number(p.cantidad_maxima_pedido || p.disponible_online),
                ),
              }
            : i,
        );
      return [...actual, { ...p, cantidad: 1 }];
    });
  const cambiar = (id, cantidad) =>
    setCarrito((a) =>
      a
        .map((i) =>
          i.id === id ? { ...i, cantidad: Math.max(0, Number(cantidad)) } : i,
        )
        .filter((i) => i.cantidad > 0),
    );
  async function finalizar(evento) {
    evento.preventDefault();
    setMensaje('');
    const f = new FormData(evento.currentTarget);
    const envio = f.get('modalidad_entrega') === 'envio';
    if (envio && !rutaEntregaValida) {
      setMensaje('El domicilio debe tener una ruta válida dentro de una zona de entrega habilitada.');
      return;
    }
    try {
      const datos = await api('/publico/pedidos', {
        method: 'POST',
        body: JSON.stringify({
          cliente_token: localStorage.getItem(TOKEN),
          nombre_cliente: f.get('nombre'),
          correo_cliente: f.get('correo'),
          telefono_cliente: f.get('telefono'),
          modalidad_entrega: f.get('modalidad_entrega'),
          medio_pago: f.get('medio_pago'),
          direccion: envio
            ? {
                etiqueta: 'Entrega',
                calle: f.get('calle'),
                numero: f.get('numero'),
                localidad: f.get('localidad'),
                distancia_km: Number(f.get('distancia')),
                zona_entrega_id: Number(f.get('zona')),
                latitud: ubicacionCheckout?.latitud ?? null,
                longitud: ubicacionCheckout?.longitud ?? null,
                es_principal: false,
              }
            : null,
          acepta_sustituciones: f.get('sustituciones') === 'on',
          observaciones: f.get('observaciones'),
          cupon_codigo: cuponAplicado || null,
          items: carrito.map((i) => ({
            producto_id: i.id,
            cantidad: i.cantidad,
          })),
        }),
      });
      setPedido(datos.dato);
      setCarrito([]);
      setModal('resultado');
    } catch (e) {
      setMensaje(e.message);
    }
  }
  async function acceso(evento, registro) {
    evento.preventDefault();
    const f = new FormData(evento.currentTarget);
    try {
      const d = await api(
        `/publico/clientes/${registro ? 'registro' : 'acceso'}`,
        {
          method: 'POST',
          body: JSON.stringify(
            registro
              ? {
                  nombre: f.get('nombre'),
                  correo: f.get('correo'),
                  telefono: f.get('telefono'),
                  clave: f.get('clave'),
                  acepta_promociones: false,
                }
              : { correo: f.get('correo'), clave: f.get('clave') },
          ),
        },
      );
      localStorage.setItem(TOKEN, d.token);
      setCliente(d.cliente);
      const preferencias = await apiCliente('/preferencias');
      setFavoritos(preferencias.dato.favoritos);
      setValoraciones(preferencias.dato.valoraciones);
      setMensaje(`Sesión iniciada como ${d.cliente.nombre}`);
      setModal(null);
    } catch (e) {
      setMensaje(e.message);
    }
  }
  async function consultar(evento) {
    evento.preventDefault();
    const f = new FormData(evento.currentTarget);
    try {
      const d = await api(
        `/publico/pedidos/${encodeURIComponent(f.get('codigo'))}?correo=${encodeURIComponent(f.get('correo'))}`,
      );
      setPedido(d.dato);
      setModal('seguimiento-resultado');
    } catch (e) {
      setMensaje(e.message);
    }
  }
  async function alternarFavorito(productoId) {
    if (!cliente) {
      setMensaje('Iniciá sesión para guardar productos favoritos.');
      setModal('acceso');
      return;
    }
    const esFavorito = favoritos.includes(Number(productoId));
    try {
      await apiCliente(`/favoritos/${productoId}`, {
        method: esFavorito ? 'DELETE' : 'POST',
      });
      setFavoritos((actual) =>
        esFavorito
          ? actual.filter((id) => Number(id) !== Number(productoId))
          : [...actual, Number(productoId)],
      );
    } catch (e) {
      setMensaje(e.message);
    }
  }
  async function abrirFavoritos() {
    if (!cliente) {
      setMensaje('Iniciá sesión para consultar tus favoritos.');
      setModal('acceso');
      return;
    }
    try {
      const respuesta = await apiCliente('/favoritos');
      setFavoritosDetalle(respuesta.datos);
      setModal('favoritos');
    } catch (e) {
      setMensaje(e.message);
    }
  }
  async function valorar(productoId, puntuacion) {
    if (!cliente) {
      setMensaje('Iniciá sesión para valorar productos.');
      setModal('acceso');
      return;
    }
    try {
      const puntuacionAnterior = Number(valoraciones[productoId] || 0);
      await apiCliente(`/valoraciones/${productoId}`, {
        method: 'PUT',
        body: JSON.stringify({ puntuacion }),
      });
      setValoraciones((actual) => ({ ...actual, [productoId]: puntuacion }));
      const actualizarResumen = (lista) =>
        lista.map((producto) => {
          if (Number(producto.id) !== Number(productoId)) return producto;
          const cantidadAnterior = Number(producto.valoraciones || 0);
          const cantidadNueva = puntuacionAnterior
            ? cantidadAnterior
            : cantidadAnterior + 1;
          const sumaAnterior =
            Number(producto.valoracion_promedio || 0) * cantidadAnterior;
          return {
            ...producto,
            valoraciones: cantidadNueva,
            valoracion_promedio:
              (sumaAnterior - puntuacionAnterior + puntuacion) / cantidadNueva,
          };
        });
      setProductos(actualizarResumen);
      setProductosPromocion(actualizarResumen);
      setMensaje('Valoración guardada correctamente.');
    } catch (e) {
      setMensaje(e.message);
    }
  }
  if (!portada)
    return (
      <main className="tienda">
        <p>Cargando tienda…</p>
      </main>
    );
  const abierta = Boolean(portada.configuracion.esta_activa);
  const totalProductosCheckout = Number(cotizacion?.total_productos ?? importe);
  const zonaSeleccionada = portada.zonas.find(
    (z) => String(z.id) === String(zonaCheckout || portada.zonas[0]?.id),
  );
  const distanciaFueraCobertura =
    recorridoCheckout.length > 0 &&
    Number(distanciaCheckout) >
      Number(portada.configuracion.distancia_maxima_km);
  const zonaCalculada = portada.zonas.find(
    (zona) =>
      zona.localidad === localidadCheckout &&
      Number(distanciaCheckout) >= Number(zona.distancia_desde_km) &&
      Number(distanciaCheckout) <= Number(zona.distancia_hasta_km),
  );
  const mensajeCobertura = distanciaFueraCobertura
    ? `Fuera del área de cobertura. La distancia máxima permitida es ${Number(portada.configuracion.distancia_maxima_km).toLocaleString('es-AR')} km por calles.`
    : recorridoCheckout.length > 0 && !zonaCalculada
      ? `No hay una zona de entrega habilitada para este punto de ${localidadCheckout}.`
      : '';
  const rutaEntregaValida =
    !calculandoRuta &&
    recorridoCheckout.length > 0 &&
    Number(distanciaCheckout) <=
      Number(portada.configuracion.distancia_maxima_km) &&
    Boolean(zonaCheckout);
  const envioGratis =
    Boolean(cotizacion?.envio_gratis_promocion) ||
    (portada.configuracion.envio_gratis_desde &&
      totalProductosCheckout >=
        Number(portada.configuracion.envio_gratis_desde));
  const costoEnvioCheckout =
    modalidadCheckout === 'envio' && !envioGratis
      ? Number(zonaSeleccionada?.costo || 0) ||
        Number(portada.configuracion.costo_envio_base || 0) +
          Number(portada.configuracion.costo_por_km || 0) *
            Number(distanciaCheckout || 0)
      : 0;
  const totalCheckout = totalProductosCheckout + costoEnvioCheckout;
  const productoBanner = productosPromocion[promocionActiva] || null;
  return (
    <div className="tienda">
      <header className="tienda__hero">
        <nav className="tienda__hero-nav" aria-label="Acciones de la tienda">
          <button onClick={() => setModal('seguimiento')}>
            <span
              className="icono-accion-tienda icono-accion-tienda--pedido"
              aria-hidden="true"
            />
            Seguir pedido
          </button>
          <button onClick={() => setModal('acceso')}>
            <span
              className="icono-accion-tienda icono-accion-tienda--cuenta"
              aria-hidden="true"
            />
            Mi cuenta
          </button>
          <button onClick={abrirFavoritos}>
            <span className="tienda__icono-favoritos" aria-hidden="true">
              ♥
            </span>
            Favoritos · {favoritos.length}
          </button>
          <button
            className="tienda__carrito"
            onClick={() => setModal('carrito')}
          >
            <span
              className="icono-accion-tienda icono-accion-tienda--carrito"
              aria-hidden="true"
            />
            Carrito · {carrito.reduce((s, i) => s + i.cantidad, 0)}
          </button>
          <a href="/">
            <img
              className="icono-gestion-tienda"
              src="/marca/favicon-circular.png"
              alt=""
            />
            Gestión
          </a>
        </nav>
        <div className="tienda__hero-contenido">
          <a href="/tienda" aria-label="Inicio de la tienda">
            <img
              className="tienda__hero-logo"
              src="/marca/logo-principal.png"
              alt="La 91 Supermercado"
            />
          </a>
          <div className="tienda__hero-texto">
            <h1>{portada.configuracion.mensaje_portada}</h1>
            <p>
              Compras para retirar o recibir en La Plata, Berisso y Ensenada.
            </p>
          </div>
        </div>
      </header>
      {productoBanner && (
        <section
          className="tienda__carrusel-promociones"
          aria-label="Ofertas destacadas"
        >
          {productosPromocion.length > 1 && (
            <button
              className="tienda__carrusel-flecha tienda__carrusel-flecha--anterior"
              type="button"
              aria-label="Oferta anterior"
              onClick={() =>
                setPromocionActiva(
                  (actual) =>
                    (actual - 1 + productosPromocion.length) %
                    productosPromocion.length,
                )
              }
            >
              ‹
            </button>
          )}
          <div className="tienda__banner-promocion" key={productoBanner.id}>
            <div className="tienda__banner-sello">OFERTA ONLINE</div>
            <div className="tienda__banner-imagen">
              {productoBanner.imagen_url ? (
                <img
                  src={productoBanner.imagen_url}
                  alt={productoBanner.nombre}
                />
              ) : (
                <span>LA 91</span>
              )}
            </div>
            <div className="tienda__banner-contenido">
              <small>SELECCIÓN DESTACADA</small>
              <h2>{productoBanner.nombre}</h2>
              <p className="tienda__banner-precios">
                <span>
                  Antes <del>{dinero(productoBanner.precio)}</del>
                </span>
                <strong>
                  {dinero(
                    Number(productoBanner.precio) *
                      (1 - Number(productoBanner.descuento_porcentaje) / 100),
                  )}
                </strong>
              </p>
            </div>
            <div className="tienda__banner-beneficio">
              <span>AHORRÁ</span>
              <strong>
                {Math.round(Number(productoBanner.descuento_porcentaje))}%
              </strong>
            </div>
            <button
              className="tienda__banner-accion"
              disabled={
                !abierta || Number(productoBanner.disponible_online) <= 0
              }
              onClick={() => agregar(productoBanner)}
            >
              Aprovechar oferta
            </button>
          </div>
          {productosPromocion.length > 1 && (
            <button
              className="tienda__carrusel-flecha tienda__carrusel-flecha--siguiente"
              type="button"
              aria-label="Oferta siguiente"
              onClick={() =>
                setPromocionActiva(
                  (actual) => (actual + 1) % productosPromocion.length,
                )
              }
            >
              ›
            </button>
          )}
          {productosPromocion.length > 1 && (
            <div className="tienda__carrusel-indicadores" aria-hidden="true">
              {productosPromocion.map((producto, indice) => (
                <span
                  className={indice === promocionActiva ? 'activo' : ''}
                  key={producto.id}
                />
              ))}
            </div>
          )}
        </section>
      )}
      {!abierta && (
        <p className="tienda__aviso">
          La tienda está en preparación. Podés recorrerla, pero todavía no
          recibe pedidos.
        </p>
      )}
      {mensaje && <p className={`${mensaje.startsWith('Recorrido calculado:') ? 'mensaje-exito' : 'mensaje-error'} tienda__mensaje`}>{mensaje}</p>}
      <div className="tienda__cuerpo">
        <aside>
          <h2>Categorías</h2>
          <button
            className={!categoria ? 'activo' : ''}
            onClick={() => {
              setCategoria('');
              setPagina(1);
            }}
          >
            <span className="icono-todas" aria-hidden="true">
              ≡
            </span>
            <span>Todos</span>
          </button>
          {portada.categorias.map((c) => (
            <button
              className={String(categoria) === String(c.id) ? 'activo' : ''}
              key={c.id}
              onClick={() => {
                setCategoria(c.id);
                setPagina(1);
              }}
            >
              {c.icono_url ? (
                <img src={c.icono_url} alt="" />
              ) : (
                <span className="tienda__icono-categoria-vacio">
                  {c.nombre.charAt(0)}
                </span>
              )}
              <span>{c.nombre}</span>
            </button>
          ))}
        </aside>
        <main>
          <div className="tienda__busqueda">
            <input
              value={buscar}
              onChange={(e) => {
                setBuscar(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar productos…"
              autoFocus
            />
            <span>{total} productos</span>
          </div>
          <div className="paginacion--superior">
            <Paginacion
              pagina={pagina}
              paginas={Math.ceil(total / limite)}
              limite={limite}
              alCambiarPagina={setPagina}
              alCambiarLimite={(valor) => {
                setLimite(valor);
                setPagina(1);
              }}
            />
          </div>
          <div className="tienda__productos">
            {productos.map((p) => {
              const itemCarrito = carrito.find((item) => item.id === p.id);
              return (
                <article
                  key={p.id}
                  className={[
                    itemCarrito ? 'tienda__producto--agregado' : '',
                    Number(p.disponible_online) <= 0
                      ? 'tienda__producto--sin-stock'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="tienda__foto">
                    {Number(p.descuento_porcentaje) > 0 && (
                      <span className="tienda__descuento-producto">
                        -{Math.round(Number(p.descuento_porcentaje))}%
                      </span>
                    )}
                    {Number(p.disponible_online) <= 0 && (
                      <span className="tienda__sin-stock">SIN STOCK</span>
                    )}
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.nombre} />
                    ) : (
                      <span>LA 91</span>
                    )}
                  </div>
                  <div
                    className="tienda__valoracion"
                    aria-label="Valoración del producto"
                  >
                    {[1, 2, 3, 4, 5].map((estrella) => (
                      <button
                        type="button"
                        key={estrella}
                        className={
                          estrella <=
                          Number(valoraciones[p.id] || p.valoracion_promedio)
                            ? 'activa'
                            : ''
                        }
                        aria-label={`Valorar con ${estrella} estrellas`}
                        onClick={() => valorar(p.id, estrella)}
                      >
                        ★
                      </button>
                    ))}
                    <small>
                      {Number(p.valoraciones) > 0
                        ? `${Number(p.valoracion_promedio).toLocaleString('es-AR')} (${p.valoraciones})`
                        : 'Sin valoraciones'}
                    </small>
                  </div>
                  <h3>{p.nombre}</h3>
                  {Number(p.descuento_porcentaje) > 0 ? (
                    <div className="tienda__precio-promocional">
                      <del>{dinero(p.precio)}</del>
                      <strong>
                        {dinero(
                          Number(p.precio) *
                            (1 - Number(p.descuento_porcentaje) / 100),
                        )}
                      </strong>
                    </div>
                  ) : (
                    <strong>{dinero(p.precio)}</strong>
                  )}
                  <div className="tienda__acciones-producto">
                    <button
                      type="button"
                      className={`tienda__favorito ${favoritos.includes(Number(p.id)) ? 'activo' : ''}`}
                      aria-label={
                        favoritos.includes(Number(p.id))
                          ? `Quitar ${p.nombre} de favoritos`
                          : `Agregar ${p.nombre} a favoritos`
                      }
                      onClick={() => alternarFavorito(p.id)}
                    >
                      {favoritos.includes(Number(p.id)) ? '♥' : '♡'}
                    </button>
                    <button
                      type="button"
                      className="tienda__agregar-carrito"
                      disabled={!abierta || Number(p.disponible_online) <= 0}
                      aria-label={`Agregar ${p.nombre} al carrito`}
                      title="Agregar al carrito"
                      onClick={() => agregar(p)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7M10 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm9 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
                      </svg>
                      {itemCarrito && <span>{itemCarrito.cantidad}</span>}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {!productos.length && <p>No hay productos para esta búsqueda.</p>}
          <Paginacion
            pagina={pagina}
            paginas={Math.ceil(total / limite)}
            limite={limite}
            alCambiarPagina={setPagina}
            alCambiarLimite={(valor) => {
              setLimite(valor);
              setPagina(1);
            }}
          />
        </main>
      </div>
      {modal === 'carrito' && (
        <Modal abierto titulo="Tu compra" alCerrar={() => setModal(null)}>
          <div className="carrito">
            {carrito.map((i) => {
              const detalle = cotizacion?.detalles.find(
                (d) => Number(d.producto_id) === Number(i.id),
              );
              const tieneDescuento = Number(detalle?.descuento_producto) > 0;
              return (
                <div className="carrito__linea" key={i.id}>
                  <span>
                    {i.nombre}
                    {tieneDescuento && (
                      <small>
                        <del>{dinero(detalle.precio_unitario)} c/u</del>{' '}
                        <strong>
                          {dinero(detalle.precio_promocional_unitario)} c/u
                        </strong>
                      </small>
                    )}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={i.disponible_online}
                    value={i.cantidad}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => cambiar(i.id, e.target.value)}
                  />
                  <span className="carrito__importe">
                    {tieneDescuento && (
                      <del>{dinero(detalle.precio_unitario * i.cantidad)}</del>
                    )}
                    <strong>
                      {dinero(
                        detalle?.subtotal_promocional ?? i.precio * i.cantidad,
                      )}
                    </strong>
                    {tieneDescuento && (
                      <small>
                        Ahorrás {dinero(detalle.descuento_producto)}
                      </small>
                    )}
                  </span>
                </div>
              );
            })}
            {!carrito.length && <p>El carrito está vacío.</p>}
            {carrito.length && (
              <div className="carrito__resumen">
                <p>
                  <span>Subtotal de productos</span>
                  <strong>{dinero(cotizacion?.subtotal ?? importe)}</strong>
                </p>
                {Number(cotizacion?.descuento_productos) > 0 && (
                  <p className="carrito__descuento">
                    <span>Descuentos en productos</span>
                    <strong>-{dinero(cotizacion.descuento_productos)}</strong>
                  </p>
                )}
                <p>
                  <span>Subtotal promocionado</span>
                  <strong>
                    {dinero(cotizacion?.subtotal_promocional ?? importe)}
                  </strong>
                </p>
                {Number(cotizacion?.descuento_pedido) > 0 && (
                  <p className="carrito__descuento">
                    <span>Descuento sobre el pedido</span>
                    <strong>-{dinero(cotizacion.descuento_pedido)}</strong>
                  </p>
                )}
                <p className="carrito__total">
                  <span>Total de productos</span>
                  <strong>
                    {dinero(cotizacion?.total_productos ?? importe)}
                  </strong>
                </p>
              </div>
            )}
            <button
              className="boton"
              disabled={!carrito.length || !abierta}
              onClick={() => setModal('checkout')}
            >
              Continuar
            </button>
          </div>
        </Modal>
      )}
      {modal === 'favoritos' && (
        <Modal abierto titulo="Mis favoritos" alCerrar={() => setModal(null)}>
          <div className="tienda__favoritos-lista">
            {favoritosDetalle.map((producto) => (
              <article key={producto.id}>
                {producto.imagen_url ? (
                  <img src={producto.imagen_url} alt={producto.nombre} />
                ) : (
                  <span className="miniatura-vacia" />
                )}
                <div>
                  <h3>{producto.nombre}</h3>
                  <strong>{dinero(producto.precio)}</strong>
                </div>
                <button
                  className="boton"
                  disabled={!abierta || Number(producto.disponible_online) <= 0}
                  onClick={() => agregar(producto)}
                >
                  Agregar
                </button>
                <button
                  className="boton boton--secundario"
                  onClick={async () => {
                    await alternarFavorito(producto.id);
                    setFavoritosDetalle((actual) =>
                      actual.filter((item) => item.id !== producto.id),
                    );
                  }}
                >
                  Quitar
                </button>
              </article>
            ))}
            {!favoritosDetalle.length && (
              <p className="vacio">Todavía no guardaste productos favoritos.</p>
            )}
          </div>
        </Modal>
      )}
      {modal === 'checkout' && (
        <Modal
          abierto
          ancho="grande"
          titulo="Datos de entrega y pago"
          alCerrar={() => setModal(null)}
        >
          <form className="formulario tienda__checkout" onSubmit={finalizar}>
            <label>
              Nombre
              <input name="nombre" required />
            </label>
            <label>
              Correo
              <input name="correo" type="email" required />
            </label>
            <label>
              Teléfono
              <input name="telefono" required />
            </label>
            <label>
              Entrega
              <select
                name="modalidad_entrega"
                value={modalidadCheckout}
                onChange={(e) => setModalidadCheckout(e.target.value)}
              >
                <option value="retiro">Retiro en el local</option>
                <option value="envio">Envío a domicilio</option>
              </select>
            </label>
            {modalidadCheckout === 'envio' && (
            <fieldset>
              <legend>Ubicación de entrega</legend>
              <label>
                Calle
                <input name="calle" required={modalidadCheckout === 'envio'} />
              </label>
              <label>
                Número
                <input name="numero" required={modalidadCheckout === 'envio'} />
              </label>
              <label>
                Localidad
                <select
                  name="localidad"
                  value={localidadCheckout}
                  onChange={(e) => setLocalidadCheckout(e.target.value)}
                >
                  {['La Plata', 'Berisso', 'Ensenada'].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Zona
                <select
                  name="zona"
                  value={zonaCheckout}
                  onChange={(e) => setZonaCheckout(e.target.value)}
                  required={modalidadCheckout === 'envio'}
                >
                  <option value="">Sin zona habilitada</option>
                  {portada.zonas
                    .filter((z) => z.localidad === localidadCheckout)
                    .map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.nombre} · {dinero(z.costo)}
                    </option>
                    ))}
                </select>
              </label>
              <label>
                Distancia comprobada (km)
                <input
                  name="distancia"
                  type="number"
                  min="0"
                  max={portada.configuracion.distancia_maxima_km}
                  step="0.1"
                  value={distanciaCheckout}
                  readOnly
                  required={modalidadCheckout === 'envio'}
                />
              </label>
              {mensajeCobertura && (
                <p className="advertencia-cobertura" role="alert">
                  {mensajeCobertura}
                </p>
              )}
              {origenEntrega && (
                <div className="selector-ubicacion-entrega">
                  <div className="selector-ubicacion-entrega__acciones">
                    <button
                      type="button"
                      className="boton boton--secundario"
                      disabled={buscandoDireccion}
                      onClick={(e) =>
                        buscarDireccionEntrega(e.currentTarget.form)
                      }
                    >
                      {buscandoDireccion
                        ? 'Buscando…'
                        : 'Buscar dirección en el mapa'}
                    </button>
                  </div>
                  <p className="dato-secundario">
                    Seleccioná el punto exacto de entrega. La distancia y el
                    costo se calculan siguiendo el recorrido por calles.
                  </p>
                  <MapaEntrega
                    origen={origenEntrega}
                    ubicacion={ubicacionCheckout}
                    alCambiar={aplicarUbicacion}
                    recorrido={recorridoCheckout}
                  />
                  {ubicacionCheckout && (
                    <p className="ubicacion-entrega-confirmada">
                      Punto confirmado · Latitud{' '}
                      {Number(ubicacionCheckout.latitud).toFixed(6)} · Longitud{' '}
                      {Number(ubicacionCheckout.longitud).toFixed(6)} ·{' '}
                      {calculandoRuta
                        ? 'calculando recorrido…'
                        : `${distanciaCheckout} km por calles`}
                    </p>
                  )}
                </div>
              )}
            </fieldset>
            )}
            <label className="tienda__campo-pago">
              Medio de pago
              <select name="medio_pago">
                {portada.configuracion.permite_efectivo ? (
                  <option value="efectivo">Efectivo</option>
                ) : null}
                {portada.configuracion.permite_transferencia ? (
                  <option value="transferencia">Transferencia</option>
                ) : null}
                {portada.configuracion.permite_mercado_pago ? (
                  <option value="mercado_pago">Mercado Pago</option>
                ) : null}
              </select>
            </label>
            <div className="campo-cupon-checkout">
              <label htmlFor="cupon-checkout">Cupón</label>
              <input
                id="cupon-checkout"
                name="cupon"
                value={cuponCheckout}
                onChange={(e) => setCuponCheckout(e.target.value)}
              />
              <button
                type="button"
                className="boton boton--secundario"
                onClick={() => {
                  setMensaje('');
                  setCuponAplicado(cuponCheckout.trim());
                }}
              >
                Aplicar
              </button>
            </div>
            <label className="tienda__campo-observaciones">
              Observaciones
              <textarea name="observaciones" />
            </label>
            <label className="fila-check">
              <input name="sustituciones" type="checkbox" defaultChecked />{' '}
              Acepto sustituciones similares
            </label>
            {mensaje && <p className={mensaje.startsWith('Recorrido calculado:') ? 'mensaje-exito' : 'mensaje-error'}>{mensaje}</p>}
            <div className="resumen-pedido-online tienda__resumen-checkout">
              <span>
                Subtotal original{' '}
                <strong>{dinero(cotizacion?.subtotal ?? importe)}</strong>
              </span>
              <span>
                Descuentos{' '}
                <strong>
                  -
                  {dinero(
                    Number(cotizacion?.descuento_productos || 0) +
                      Number(cotizacion?.descuento_pedido || 0),
                  )}
                </strong>
              </span>
              <span>
                Envío{' '}
                <strong>
                  {costoEnvioCheckout
                    ? dinero(costoEnvioCheckout)
                    : 'Sin cargo'}
                </strong>
              </span>
              <span>
                Total a pagar <strong>{dinero(totalCheckout)}</strong>
              </span>
            </div>
            <button className="boton" disabled={modalidadCheckout === 'envio' && !rutaEntregaValida}>
              Confirmar pedido · {dinero(totalCheckout)}
            </button>
          </form>
        </Modal>
      )}
      {modal === 'acceso' && (
        <Modal abierto titulo="Mi cuenta" alCerrar={() => setModal(null)}>
          <div className="cuenta-online">
            <form onSubmit={(e) => acceso(e, false)}>
              <h3>Ingresar</h3>
              <label>
                Correo
                <input name="correo" type="email" required />
              </label>
              <label>
                Contraseña
                <CampoClave name="clave" required />
              </label>
              <button className="boton">Ingresar</button>
            </form>
            <form onSubmit={(e) => acceso(e, true)}>
              <h3>Crear cuenta</h3>
              <label>
                Nombre
                <input name="nombre" required />
              </label>
              <label>
                Teléfono
                <input name="telefono" required />
              </label>
              <label>
                Correo
                <input name="correo" type="email" required />
              </label>
              <label>
                Contraseña
                <CampoClave name="clave" minLength="12" required />
              </label>
              <button className="boton">Registrarme</button>
            </form>
          </div>
        </Modal>
      )}
      {modal === 'resultado' && (
        <Modal abierto titulo="Pedido recibido" alCerrar={() => setModal(null)}>
          <p>
            Tu código de seguimiento es <strong>{pedido.codigo}</strong>.
          </p>
          <div className="resumen-pedido-online">
            <span>
              Subtotal <strong>{dinero(pedido.subtotal)}</strong>
            </span>
            <span>
              Descuento <strong>-{dinero(pedido.descuento)}</strong>
            </span>
            <span>
              Envío <strong>{dinero(pedido.costo_envio)}</strong>
            </span>
            <span>
              Total <strong>{dinero(pedido.total)}</strong>
            </span>
          </div>
          <p>
            Guardalo junto con el correo utilizado para consultar el pedido.
          </p>
        </Modal>
      )}
      {modal === 'seguimiento' && (
        <Modal abierto titulo="Seguir pedido" alCerrar={() => setModal(null)}>
          <form className="formulario" onSubmit={consultar}>
            <label>
              Código
              <input name="codigo" maxLength="12" required />
            </label>
            <label>
              Correo utilizado
              <input name="correo" type="email" required />
            </label>
            {mensaje && <p className="mensaje-error">{mensaje}</p>}
            <button className="boton">Consultar</button>
          </form>
        </Modal>
      )}
      {modal === 'seguimiento-resultado' && (
        <Modal
          abierto
          titulo={`Pedido #${pedido.codigo}`}
          alCerrar={() => setModal(null)}
        >
          <p>
            Estado: <strong>{pedido.estado.replaceAll('_', ' ')}</strong>
          </p>
          <p>
            Pago: <strong>{pedido.estado_pago.replaceAll('_', ' ')}</strong>
          </p>
          <p>Entrega: {pedido.modalidad_entrega}</p>
          <div className="resumen-pedido-online">
            <span>
              Subtotal <strong>{dinero(pedido.subtotal)}</strong>
            </span>
            <span>
              Descuento <strong>-{dinero(pedido.descuento)}</strong>
            </span>
            <span>
              Envío <strong>{dinero(pedido.costo_envio)}</strong>
            </span>
            <span>
              Total <strong>{dinero(pedido.total)}</strong>
            </span>
          </div>
          <h3>Productos</h3>
          {pedido.detalles.map((d) => (
            <p key={d.id}>
              {Number(d.cantidad_confirmada ?? d.cantidad_solicitada)} ×{' '}
              {d.nombre_sustituto || d.nombre_producto}
            </p>
          ))}
        </Modal>
      )}
    </div>
  );
}
