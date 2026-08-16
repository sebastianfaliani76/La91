import { useEffect, useMemo, useState } from 'react';
import { MapaEntrega } from '../Tienda.jsx';

function CampoAjuste({ titulo, ayuda, children }) {
  return <div className="ajuste-ecommerce"><div className="ajuste-ecommerce__texto"><strong>{titulo}</strong>{ayuda&&<span>{ayuda}</span>}</div><div className="ajuste-ecommerce__control">{children}</div></div>;
}

function Interruptor({ nombre, etiqueta, activo }) {
  return <label className="interruptor"><input type="checkbox" name={nombre} defaultChecked={Boolean(activo)}/><span className="interruptor__pista" aria-hidden="true"><span/></span><span>{etiqueta}</span></label>;
}

export function ConfiguracionEcommerce({ datos, alGuardar }) {
  const c=datos.configuracion;
  const [latitud, setLatitud] = useState(c.latitud_origen ?? '');
  const [longitud, setLongitud] = useState(c.longitud_origen ?? '');
  const [estadoUbicacion, setEstadoUbicacion] = useState('');
  const [direccion, setDireccion] = useState(c.direccion_origen ?? '');
  const [buscando, setBuscando] = useState(false);
  const [centroMapa] = useState(() => ({
    latitud: Number(c.latitud_origen ?? -34.9214),
    longitud: Number(c.longitud_origen ?? -57.9544),
  }));

  useEffect(() => {
    setLatitud(c.latitud_origen ?? '');
    setLongitud(c.longitud_origen ?? '');
    setDireccion(c.direccion_origen ?? '');
  }, [c.direccion_origen, c.latitud_origen, c.longitud_origen]);

  const puntoNegocio = useMemo(
    () => latitud !== '' && longitud !== ''
      ? { latitud: Number(latitud), longitud: Number(longitud) }
      : null,
    [latitud, longitud],
  );

  function seleccionarPunto(punto) {
    setLatitud(Number(punto.latitud).toFixed(7));
    setLongitud(Number(punto.longitud).toFixed(7));
    setEstadoUbicacion('Punto del negocio seleccionado. Guardá los cambios para aplicarlo.');
  }

  async function buscarDireccion() {
    if (!direccion.trim()) {
      setEstadoUbicacion('Ingresá la dirección del negocio.');
      return;
    }
    setBuscando(true);
    setEstadoUbicacion('Buscando dirección…');
    try {
      const consulta = encodeURIComponent(`${direccion}, Buenos Aires, Argentina`);
      const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ar&limit=1&q=${consulta}`);
      if (!respuesta.ok) throw new Error('No se pudo consultar la dirección.');
      const [resultado] = await respuesta.json();
      if (!resultado) throw new Error('No encontramos esa dirección en el mapa.');
      seleccionarPunto({ latitud: Number(resultado.lat), longitud: Number(resultado.lon) });
      setEstadoUbicacion('Dirección encontrada. Ajustá el punto en el mapa y guardá los cambios.');
    } catch (error) {
      setEstadoUbicacion(error.message);
    } finally {
      setBuscando(false);
    }
  }

  return <form className="configuracion-ecommerce" onSubmit={alGuardar}>
    <header className="configuracion-ecommerce__introduccion"><div><h2>Configuración de la tienda</h2><p>Administrá cómo funciona el canal online. Los cambios no afectan el punto de venta local.</p></div><span className={`estado-tienda ${c.esta_activa?'estado-tienda--activa':''}`}>{c.esta_activa?'Tienda abierta':'Tienda cerrada'}</span></header>

    <section className="grupo-ajustes"><header><h3>Información general</h3><p>Datos que identifican la tienda y se muestran al cliente.</p></header><div>
      <CampoAjuste titulo="Nombre de la tienda" ayuda="Nombre comercial visible en la portada y en los pedidos."><input name="nombre_tienda" defaultValue={c.nombre_tienda} required/></CampoAjuste>
      <CampoAjuste titulo="Mensaje de portada" ayuda="Una frase breve para presentar la tienda online."><input name="mensaje_portada" defaultValue={c.mensaje_portada||''}/></CampoAjuste>
      <CampoAjuste titulo="Teléfono de contacto" ayuda="Se utilizará para consultas relacionadas con los pedidos."><input name="telefono_contacto" defaultValue={c.telefono_contacto||''}/></CampoAjuste>
      <CampoAjuste titulo="Estado del canal" ayuda="Al cerrarla, los clientes pueden recorrerla pero no confirmar pedidos."><Interruptor nombre="esta_activa" etiqueta="Recibir pedidos online" activo={c.esta_activa}/></CampoAjuste>
    </div></section>

    <section className="grupo-ajustes"><header><h3>Entregas</h3><p>Origen, cobertura y costo del reparto.</p></header><div>
      <CampoAjuste titulo="Dirección de origen" ayuda="Punto desde el que se calculan y despachan las entregas."><div className="coordenadas-ecommerce"><div className="controles-en-linea"><input name="direccion_origen" value={direccion} onChange={(e)=>setDireccion(e.target.value)}/><button className="boton boton--secundario boton--ubicacion" type="button" disabled={buscando} onClick={buscarDireccion}>{buscando?'Buscando…':'Buscar en el mapa'}</button></div><MapaEntrega origen={centroMapa} ubicacion={puntoNegocio} alCambiar={seleccionarPunto} mostrarRecorrido={false}/><span className="dato-secundario">Buscá la dirección y hacé clic en el mapa para ajustar el punto exacto del supermercado.</span></div></CampoAjuste>
      <CampoAjuste titulo="Coordenadas del negocio" ayuda="Se completan al buscar o seleccionar el punto en el mapa."><div className="coordenadas-ecommerce"><div className="controles-en-linea"><input aria-label="Latitud" name="latitud_origen" type="number" step="any" placeholder="Latitud" value={latitud} readOnly/><input aria-label="Longitud" name="longitud_origen" type="number" step="any" placeholder="Longitud" value={longitud} readOnly/></div>{estadoUbicacion&&<span className="ayuda-ubicacion">{estadoUbicacion}</span>}</div></CampoAjuste>
      <CampoAjuste titulo="Distancia máxima" ayuda="No se aceptarán entregas fuera de este límite."><div className="campo-con-unidad"><input name="distancia_maxima_km" type="number" min="0.1" step="0.1" defaultValue={c.distancia_maxima_km}/><span>km</span></div></CampoAjuste>
      <CampoAjuste titulo="Costo de envío" ayuda="Importe fijo más el adicional calculado por kilómetro."><div className="controles-en-linea"><label>Base<input name="costo_envio_base" type="number" min="0" step="0.01" defaultValue={c.costo_envio_base}/></label><label>Por km<input name="costo_por_km" type="number" min="0" step="0.01" defaultValue={c.costo_por_km}/></label></div></CampoAjuste>
      <CampoAjuste titulo="Opciones de entrega" ayuda="Elegí las modalidades que estarán disponibles en el checkout."><div className="lista-interruptores"><Interruptor nombre="permite_envio" etiqueta="Envío a domicilio" activo={c.permite_envio}/><Interruptor nombre="permite_retiro" etiqueta="Retiro en el local" activo={c.permite_retiro}/></div></CampoAjuste>
    </div></section>

    <section className="grupo-ajustes"><header><h3>Condiciones del pedido</h3><p>Importes mínimos, beneficios y tiempo de reserva.</p></header><div>
      <CampoAjuste titulo="Pedido mínimo" ayuda="Total mínimo de productos requerido para comprar."><div className="campo-con-unidad campo-con-unidad--moneda"><span>$</span><input name="pedido_minimo" type="number" min="0" step="0.01" defaultValue={c.pedido_minimo}/></div></CampoAjuste>
      <CampoAjuste titulo="Envío gratis desde" ayuda="Dejalo vacío si el beneficio no se aplica automáticamente."><div className="campo-con-unidad campo-con-unidad--moneda"><span>$</span><input name="envio_gratis_desde" type="number" min="0" step="0.01" defaultValue={c.envio_gratis_desde||''}/></div></CampoAjuste>
      <CampoAjuste titulo="Reserva de productos" ayuda="Tiempo durante el cual se conserva el stock de un pedido sin pagar."><div className="campo-con-unidad"><input name="minutos_reserva" type="number" min="5" max="1440" defaultValue={c.minutos_reserva}/><span>minutos</span></div></CampoAjuste>
    </div></section>

    <section className="grupo-ajustes"><header><h3>Medios de pago</h3><p>Activá únicamente los medios que el negocio esté preparado para recibir.</p></header><div><CampoAjuste titulo="Opciones disponibles" ayuda="Mercado Pago requiere credenciales productivas antes de habilitarse."><div className="lista-interruptores"><Interruptor nombre="permite_efectivo" etiqueta="Efectivo" activo={c.permite_efectivo}/><Interruptor nombre="permite_transferencia" etiqueta="Transferencia bancaria" activo={c.permite_transferencia}/><Interruptor nombre="permite_mercado_pago" etiqueta="Mercado Pago" activo={c.permite_mercado_pago}/></div></CampoAjuste></div></section>

    <footer className="configuracion-ecommerce__acciones"><span>Los cambios se aplican inmediatamente.</span><button className="boton">Guardar cambios</button></footer>
  </form>;
}
