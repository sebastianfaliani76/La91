import { useCallback, useEffect, useState } from 'react';
import { Modal } from './componentes/Modal.jsx';
import { Paginacion } from './componentes/Paginacion.jsx';

async function solicitar(ruta, token, opciones = {}) {
  const respuesta = await fetch(ruta, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      ...opciones.headers,
    },
  });
  const datos = await respuesta.json();
  if (!respuesta.ok)
    throw new Error(datos.mensaje || 'No se pudo completar la operación');
  return datos;
}

function datosDesdeFormulario(formulario) {
  const dato = new FormData(formulario);
  const numeroOpcional = (nombre) =>
    dato.get(nombre) === '' ? null : Number(dato.get(nombre));
  return {
    nombre: dato.get('nombre'),
    codigo_interno: dato.get('codigo_interno') || null,
    codigos_barra: dato
      .get('codigos_barra')
      .split(',')
      .map((codigo) => codigo.trim())
      .filter(Boolean),
    categoria_id: Number(dato.get('categoria_id')),
    marca_id: numeroOpcional('marca_id'),
    unidad_medida_id: Number(dato.get('unidad_medida_id')),
    contenido_neto: numeroOpcional('contenido_neto'),
    precio_costo: Number(dato.get('precio_costo')),
    precio_venta: Number(dato.get('precio_venta')),
    precio_venta_editado_manualmente:
      dato.get('precio_venta_editado_manualmente') === 'on',
    precio_mayorista: numeroOpcional('precio_mayorista'),
    porcentaje_margen: numeroOpcional('porcentaje_margen'),
    cantidad_minima_mayorista: numeroOpcional('cantidad_minima_mayorista'),
    stock_minimo: Number(dato.get('stock_minimo') || 0),
    es_pesable: dato.get('es_pesable') === 'on',
    descripcion: dato.get('descripcion') || null,
    imagen_url: dato.get('imagen_url') || null,
  };
}

function FormularioProducto({
  producto,
  categorias,
  referencias,
  alGuardar,
  alCancelar,
}) {
  const [esPesable, setEsPesable] = useState(Boolean(producto?.es_pesable));
  const [ventaManual, setVentaManual] = useState(
    Boolean(producto?.precio_venta_editado_manualmente),
  );
  const seleccionarContenido = (evento) => evento.currentTarget.select();
  function calcularVenta(formulario) {
    const costo = Number(formulario.elements.precio_costo.value);
    const margen = Number(formulario.elements.porcentaje_margen.value);
    if (Number.isFinite(costo) && Number.isFinite(margen)) {
      formulario.elements.precio_venta.value =
        Math.round((costo * (1 + margen / 100)) / 10) * 10;
    }
  }
  function recalcularVenta(evento) {
    if (!ventaManual) calcularVenta(evento.currentTarget.form);
  }

  return (
    <form className="formulario-producto" onSubmit={alGuardar}>
      <div className="campos-producto">
        <div className="campo campo--ancho">
          <label htmlFor="producto_nombre">Nombre</label>
          <input
            id="producto_nombre"
            name="nombre"
            defaultValue={producto?.nombre ?? ''}
            minLength="2"
            maxLength="180"
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="producto_codigo_barra">Código de barras</label>
          <input
            id="producto_codigo_barra"
            name="codigos_barra"
            defaultValue={producto?.codigos_barra?.join(', ') ?? ''}
            minLength="4"
            required
            placeholder="Separar varios con comas"
          />
        </div>
        <div className="campo">
          <label htmlFor="producto_codigo_interno">Código interno</label>
          <input
            id="producto_codigo_interno"
            name="codigo_interno"
            defaultValue={producto?.codigo_interno ?? ''}
          />
        </div>
        <div className="campo">
          <label htmlFor="producto_categoria">Categoría</label>
          <select
            id="producto_categoria"
            name="categoria_id"
            required
            defaultValue={producto?.categoria_id ?? ''}
          >
            <option value="" disabled>
              Seleccionar
            </option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="producto_marca">Marca</label>
          <select
            id="producto_marca"
            name="marca_id"
            defaultValue={producto?.marca_id ?? ''}
          >
            <option value="">Sin marca</option>
            {referencias.marcas.map((marca) => (
              <option key={marca.id} value={marca.id}>
                {marca.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="producto_unidad">Unidad de medida</label>
          <select
            id="producto_unidad"
            name="unidad_medida_id"
            required
            defaultValue={producto?.unidad_medida_id ?? ''}
          >
            <option value="" disabled>
              Seleccionar
            </option>
            {referencias.unidades_medida.map((unidad) => (
              <option key={unidad.id} value={unidad.id}>
                {unidad.nombre} ({unidad.abreviatura})
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="producto_contenido">Contenido neto</label>
          <input
            id="producto_contenido"
            name="contenido_neto"
            type="number"
            min="0.001"
            step="0.001"
            defaultValue={producto?.contenido_neto ?? ''}
          />
        </div>
        <div className="campo">
          <label htmlFor="producto_costo">Precio de costo</label>
          <input
            id="producto_costo"
            name="precio_costo"
            type="number"
            min="0"
            step="0.01"
            defaultValue={producto?.precio_costo ?? ''}
            onInput={recalcularVenta}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="producto_margen">Margen (%)</label>
          <input
            id="producto_margen"
            name="porcentaje_margen"
            type="number"
            min="0"
            max="999.999"
            step="0.001"
            defaultValue={producto?.porcentaje_margen ?? 30}
            onInput={recalcularVenta}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="producto_venta">Precio de venta</label>
          <input
            id="producto_venta"
            name="precio_venta"
            type="number"
            min="0"
            step="0.01"
            defaultValue={producto?.precio_venta ?? ''}
            onInput={() => setVentaManual(true)}
            required
          />
          <label className="campo-verificacion">
            <input
              name="precio_venta_editado_manualmente"
              type="checkbox"
              checked={ventaManual}
              onChange={(evento) => {
                const manual = evento.target.checked;
                setVentaManual(manual);
                if (!manual) calcularVenta(evento.currentTarget.form);
              }}
            />{' '}
            Precio manual
          </label>
        </div>
        <div className="campo">
          <label htmlFor="producto_mayorista">Nuestro precio mayorista</label>
          <input
            id="producto_mayorista"
            name="precio_mayorista"
            type="number"
            min="0"
            step="0.01"
            defaultValue={producto?.precio_mayorista ?? ''}
          />
        </div>
        <div className="campo">
          <label htmlFor="producto_cantidad_mayorista">
            Cantidad mínima mayorista
          </label>
          <input
            id="producto_cantidad_mayorista"
            name="cantidad_minima_mayorista"
            type="number"
            min={esPesable ? '0.001' : '1'}
            step={esPesable ? '0.001' : '1'}
            defaultValue={producto?.cantidad_minima_mayorista ?? ''}
            onFocus={seleccionarContenido}
          />
        </div>
        <div className="campo">
          <label htmlFor="producto_stock_minimo">Stock mínimo</label>
          <input
            id="producto_stock_minimo"
            name="stock_minimo"
            type="number"
            min="0"
            step={esPesable ? '0.001' : '1'}
            defaultValue={producto?.stock_minimo ?? 0}
            onFocus={seleccionarContenido}
          />
        </div>
        <div className="campo campo--ancho">
          <label htmlFor="producto_imagen">URL de imagen</label>
          <input
            id="producto_imagen"
            name="imagen_url"
            maxLength="500"
            defaultValue={producto?.imagen_url ?? ''}
          />
        </div>
        <div className="campo campo--ancho">
          <label htmlFor="producto_descripcion">Descripción</label>
          <textarea
            id="producto_descripcion"
            name="descripcion"
            rows="3"
            defaultValue={producto?.descripcion ?? ''}
          />
        </div>
        <label className="campo-verificacion">
          <input
            name="es_pesable"
            type="checkbox"
            checked={esPesable}
            onChange={(evento) => setEsPesable(evento.target.checked)}
          />{' '}
          Producto pesable
        </label>
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
          {producto ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </div>
    </form>
  );
}

export function Catalogo({ token, permisos }) {
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [totalProductos, setTotalProductos] = useState(0);
  const [referencias, setReferencias] = useState({
    marcas: [],
    unidades_medida: [],
  });
  const [mensaje, setMensaje] = useState('');
  const [modalActivo, setModalActivo] = useState(null);
  const [productoEditado, setProductoEditado] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [marcaId, setMarcaId] = useState('');
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(25);
  const puedeGestionar = permisos.includes('productos.gestionar');

  const cargar = useCallback(async () => {
    try {
      const parametros = new URLSearchParams({
        pagina: String(pagina),
        limite: String(limite),
      });
      if (buscar) parametros.set('buscar', buscar);
      if (categoriaId) parametros.set('categoria_id', categoriaId);
      if (marcaId) parametros.set('marca_id', marcaId);
      const [respuestaCategorias, respuestaProductos, respuestaReferencias] =
        await Promise.all([
          solicitar('/api/catalogo/categorias', token),
          solicitar(`/api/catalogo/productos?${parametros}`, token),
          solicitar('/api/catalogo/referencias', token),
        ]);
      setCategorias(respuestaCategorias.datos);
      setProductos(respuestaProductos.datos);
      setTotalProductos(respuestaProductos.total);
      setReferencias(respuestaReferencias);
    } catch (error) {
      setMensaje(error.message);
    }
  }, [token, pagina, limite, buscar, categoriaId, marcaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setPagina(1);
      setBuscar(textoBusqueda.trim());
    }, 300);
    return () => clearTimeout(temporizador);
  }, [textoBusqueda]);

  async function crearCategoria(evento) {
    evento.preventDefault();
    try {
      const formulario = new FormData(evento.currentTarget);
      await solicitar('/api/catalogo/categorias', token, {
        method: 'POST',
        body: JSON.stringify({ nombre: formulario.get('nombre') }),
      });
      setModalActivo(null);
      setMensaje('Categoría creada correctamente.');
      await cargar();
    } catch (error) {
      setMensaje(error.message);
    }
  }

  async function crearMarca(evento) {
    evento.preventDefault();
    try {
      const formulario = new FormData(evento.currentTarget);
      await solicitar('/api/catalogo/marcas', token, {
        method: 'POST',
        body: JSON.stringify({ nombre: formulario.get('nombre') }),
      });
      setModalActivo(null);
      setMensaje(
        'Marca creada correctamente. Ya está disponible en productos.',
      );
      await cargar();
    } catch (error) {
      setMensaje(error.message);
    }
  }

  async function guardarProducto(evento) {
    evento.preventDefault();
    try {
      const datos = datosDesdeFormulario(evento.currentTarget);
      const ruta = productoEditado
        ? `/api/catalogo/productos/${productoEditado.id}`
        : '/api/catalogo/productos';
      await solicitar(ruta, token, {
        method: productoEditado ? 'PUT' : 'POST',
        body: JSON.stringify(datos),
      });
      setModalActivo(null);
      setProductoEditado(null);
      setMensaje(
        productoEditado
          ? 'Producto actualizado correctamente.'
          : 'Producto creado correctamente.',
      );
      await cargar();
    } catch (error) {
      setMensaje(error.message);
    }
  }

  async function abrirEdicion(productoId) {
    try {
      const respuesta = await solicitar(
        `/api/catalogo/productos/${productoId}`,
        token,
      );
      setProductoEditado(respuesta.dato);
      setModalActivo('producto');
    } catch (error) {
      setMensaje(error.message);
    }
  }

  function filtrarPorCategoria(id) {
    setCategoriaId(id ? String(id) : '');
    setPagina(1);
  }

  const paginas = Math.max(1, Math.ceil(totalProductos / limite));

  return (
    <section className="modulo">
      <div className="modulo__encabezado">
        <div>
          <p className="etiqueta">CATÁLOGO</p>
          <h2>Productos y categorías</h2>
        </div>
        <div className="acciones-encabezado">
          {puedeGestionar && (
            <button
              className="boton boton--secundario"
              onClick={() => setModalActivo('categoria')}
            >
              Nueva categoría
            </button>
          )}
          {puedeGestionar && (
            <button
              className="boton boton--secundario"
              onClick={() => setModalActivo('marca')}
            >
              Nueva marca
            </button>
          )}
          {puedeGestionar && (
            <button
              className="boton"
              onClick={() => {
                setProductoEditado(null);
                setModalActivo('producto');
              }}
            >
              Nuevo producto
            </button>
          )}
        </div>
      </div>

      <div className="barra-filtros" role="search">
        <input
          name="buscar"
          value={textoBusqueda}
          onChange={(evento) => setTextoBusqueda(evento.target.value)}
          placeholder="Buscar por nombre, código interno o código de barras"
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
          {referencias.marcas.map((marca) => (
            <option key={marca.id} value={marca.id}>
              {marca.nombre}
            </option>
          ))}
        </select>
      </div>
      <p className="filtro-activo">
        Mostrando {totalProductos.toLocaleString('es-AR')}{' '}
        {buscar || categoriaId || marcaId ? 'resultados' : 'productos'}
        {buscar ? ` para “${buscar}”` : ''}
        {categoriaId
          ? ` en ${categorias.find((categoria) => String(categoria.id) === categoriaId)?.nombre ?? 'la categoría seleccionada'}`
          : ''}
        .
        {marcaId
          ? ` Marca: ${referencias.marcas.find((marca) => String(marca.id) === marcaId)?.nombre ?? 'seleccionada'}.`
          : ''}
      </p>
      {mensaje && (
        <p className="mensaje" role="status">
          {mensaje}
        </p>
      )}

      <div className="rejilla-catalogo">
        <article className="panel">
          <h3>Categorías</h3>
          <nav className="lista-categorias" aria-label="Filtrar por categoría">
            <button
              type="button"
              className={!categoriaId ? 'categoria-activa' : ''}
              onClick={() => filtrarPorCategoria(null)}
            >
              <span className="icono-todas">≡</span>
              <span>Todas</span>
            </button>
            {categorias.map((categoria) => (
              <button
                type="button"
                key={categoria.id}
                className={
                  categoriaId === String(categoria.id) ? 'categoria-activa' : ''
                }
                onClick={() => filtrarPorCategoria(categoria.id)}
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
            <h3>Productos</h3>
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
                  <th>Categoría</th>
                  <th>Precio</th>
                  {puedeGestionar && <th></th>}
                </tr>
              </thead>
              <tbody>
                {productos.map((producto) => (
                  <tr key={producto.id}>
                    <td>
                      {producto.imagen_url ? (
                        <img
                          className="miniatura-producto"
                          src={producto.imagen_url}
                          alt=""
                        />
                      ) : (
                        <span className="miniatura-vacia" />
                      )}
                    </td>
                    <td>{producto.nombre}</td>
                    <td>{producto.codigo_barra}</td>
                    <td>{producto.categoria}</td>
                    <td>
                      $
                      {Number(producto.precio_venta).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    {puedeGestionar && (
                      <td>
                        <button
                          className="boton-tabla"
                          onClick={() => abrirEdicion(producto.id)}
                        >
                          Editar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
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

      <Modal
        abierto={modalActivo === 'producto'}
        titulo={productoEditado ? 'Editar producto' : 'Nuevo producto'}
        ancho="grande"
        alCerrar={() => {
          setModalActivo(null);
          setProductoEditado(null);
        }}
      >
        <FormularioProducto
          key={productoEditado?.id ?? 'nuevo'}
          producto={productoEditado}
          categorias={categorias}
          referencias={referencias}
          alGuardar={guardarProducto}
          alCancelar={() => {
            setModalActivo(null);
            setProductoEditado(null);
          }}
        />
      </Modal>
      <Modal
        abierto={modalActivo === 'categoria'}
        titulo="Nueva categoría"
        alCerrar={() => setModalActivo(null)}
      >
        <form className="formulario-modal" onSubmit={crearCategoria}>
          <div>
            <label htmlFor="categoria_nombre">Nombre</label>
            <input
              id="categoria_nombre"
              name="nombre"
              minLength="2"
              maxLength="100"
              required
              placeholder="Ej.: Almacén"
            />
          </div>
          <div className="modal__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setModalActivo(null)}
            >
              Cancelar
            </button>
            <button className="boton">Guardar categoría</button>
          </div>
        </form>
      </Modal>
      <Modal
        abierto={modalActivo === 'marca'}
        titulo="Nueva marca"
        alCerrar={() => setModalActivo(null)}
      >
        <form className="formulario-modal" onSubmit={crearMarca}>
          <div>
            <label htmlFor="marca_nombre">Nombre</label>
            <input
              id="marca_nombre"
              name="nombre"
              minLength="2"
              maxLength="100"
              required
              placeholder="Ej.: La Serenísima"
            />
          </div>
          <div className="modal__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setModalActivo(null)}
            >
              Cancelar
            </button>
            <button className="boton">Guardar marca</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
