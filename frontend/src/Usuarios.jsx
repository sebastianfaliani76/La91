import { useCallback, useEffect, useState } from 'react';
import { Modal } from './componentes/Modal.jsx';
import { formatearFechaHora } from './utilidades/fechas.js';
import { CampoClave } from './componentes/CampoClave.jsx';
import { Paginacion } from './componentes/Paginacion.jsx';

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

function FormularioUsuario({ usuario, roles, alGuardar, alCancelar }) {
  return (
    <form className="formulario-modal" onSubmit={alGuardar}>
      <div className="campos-producto">
        <div className="campo">
          <label htmlFor="usuario_nombres">Nombres</label>
          <input
            id="usuario_nombres"
            name="nombres"
            defaultValue={usuario?.nombres ?? ''}
            minLength="2"
            maxLength="100"
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="usuario_apellidos">Apellidos</label>
          <input
            id="usuario_apellidos"
            name="apellidos"
            defaultValue={usuario?.apellidos ?? ''}
            minLength="2"
            maxLength="100"
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="usuario_nombre">Usuario</label>
          <input
            id="usuario_nombre"
            name="nombre_usuario"
            defaultValue={usuario?.nombre_usuario ?? ''}
            minLength="3"
            maxLength="60"
            pattern="[a-zA-Z0-9._-]+"
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="usuario_rol">Rol</label>
          <select
            id="usuario_rol"
            name="rol_id"
            defaultValue={usuario?.rol_id ?? ''}
            required
          >
            <option value="" disabled>
              Seleccionar
            </option>
            {roles.map((rol) => (
              <option key={rol.id} value={rol.id}>
                {rol.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="usuario_documento">Documento</label>
          <input
            id="usuario_documento"
            name="numero_documento"
            defaultValue={usuario?.numero_documento ?? ''}
            maxLength="20"
          />
        </div>
        <div className="campo">
          <label htmlFor="usuario_telefono">Teléfono</label>
          <input
            id="usuario_telefono"
            name="telefono"
            defaultValue={usuario?.telefono ?? ''}
            maxLength="30"
          />
        </div>
        <div className="campo campo--ancho">
          <label htmlFor="usuario_correo">Correo electrónico</label>
          <input
            id="usuario_correo"
            name="correo_electronico"
            type="email"
            defaultValue={usuario?.correo_electronico ?? ''}
            maxLength="254"
          />
        </div>
        <div className="campo campo--ancho">
          <label htmlFor="usuario_clave">
            {usuario ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}
          </label>
          <CampoClave
            id="usuario_clave"
            name="clave"
            minLength="12"
            maxLength="128"
            required={!usuario}
            autoComplete="new-password"
          />
          <small>Mínimo 12 caracteres. Al ingresar deberá cambiarla.</small>
        </div>
        {usuario && (
          <label className="filtro-verificacion campo--ancho">
            <input
              name="esta_activo"
              type="checkbox"
              defaultChecked={Boolean(usuario.esta_activo)}
            />{' '}
            Usuario activo
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
          {usuario ? 'Guardar cambios' : 'Crear usuario'}
        </button>
      </div>
    </form>
  );
}

export function Usuarios({ token, permisos }) {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('todos');
  const [usuarioEditado, setUsuarioEditado] = useState(undefined);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [limite, setLimite] = useState(25);
  const puedeGestionar = permisos.includes('usuarios.gestionar');

  const cargar = useCallback(async () => {
    try {
      const parametros = new URLSearchParams({
        pagina: String(pagina),
        limite: String(limite),
        estado,
      });
      if (buscar) parametros.set('buscar', buscar);
      const [respuestaUsuarios, respuestaRoles] = await Promise.all([
        solicitar(`/api/usuarios?${parametros}`, token),
        solicitar('/api/usuarios/roles', token),
      ]);
      setUsuarios(respuestaUsuarios.datos);
      setTotal(respuestaUsuarios.total);
      setRoles(respuestaRoles.datos);
    } catch (error) {
      setMensaje(error.message);
    }
  }, [token, pagina, limite, buscar, estado]);

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

  async function guardar(evento) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const datos = {
      nombre_usuario: formulario.get('nombre_usuario'),
      nombres: formulario.get('nombres'),
      apellidos: formulario.get('apellidos'),
      numero_documento: formulario.get('numero_documento') || null,
      correo_electronico: formulario.get('correo_electronico') || null,
      telefono: formulario.get('telefono') || null,
      rol_id: Number(formulario.get('rol_id')),
      clave: formulario.get('clave'),
      ...(usuarioEditado
        ? { esta_activo: formulario.get('esta_activo') === 'on' }
        : {}),
    };
    try {
      await solicitar(
        usuarioEditado ? `/api/usuarios/${usuarioEditado.id}` : '/api/usuarios',
        token,
        {
          method: usuarioEditado ? 'PUT' : 'POST',
          body: JSON.stringify(datos),
        },
      );
      setModalAbierto(false);
      setUsuarioEditado(undefined);
      setMensaje(
        usuarioEditado
          ? 'Usuario actualizado correctamente.'
          : 'Usuario creado correctamente.',
      );
      await cargar();
    } catch (error) {
      setMensaje(error.message);
    }
  }

  const paginas = Math.max(1, Math.ceil(total / limite));
  return (
    <section className="modulo">
      <div className="modulo__encabezado">
        <div>
          <p className="etiqueta">SEGURIDAD</p>
          <h2>Usuarios</h2>
        </div>
        {puedeGestionar && (
          <button
            className="boton"
            onClick={() => {
              setUsuarioEditado(undefined);
              setModalAbierto(true);
            }}
          >
            Nuevo usuario
          </button>
        )}
      </div>
      <div className="barra-filtros" role="search">
        <input
          value={textoBusqueda}
          onChange={(evento) => setTextoBusqueda(evento.target.value)}
          placeholder="Buscar por nombre, usuario, documento o correo"
        />
        <select
          aria-label="Filtrar por estado"
          value={estado}
          onChange={(evento) => {
            setEstado(evento.target.value);
            setPagina(1);
          }}
        >
          <option value="todos">Todos los estados</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
      </div>
      <p className="filtro-activo">
        Mostrando {total.toLocaleString('es-AR')} usuarios
        {buscar ? ` para “${buscar}”` : ''}.
      </p>
      {mensaje && (
        <p className="mensaje" role="status">
          {mensaje}
        </p>
      )}
      <article className="panel">
        <div className="panel__encabezado">
          <h3>Personal con acceso</h3>
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
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
                {puedeGestionar && <th></th>}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td>
                    <img
                      className="miniatura-producto"
                      src="/iconos/sistema/usuarios.png"
                      alt=""
                    />
                  </td>
                  <td>
                    {[usuario.nombres, usuario.apellidos]
                      .filter(Boolean)
                      .join(' ') || 'Sin datos personales'}
                  </td>
                  <td>{usuario.nombre_usuario}</td>
                  <td>{usuario.rol}</td>
                  <td>
                    <span
                      className={
                        usuario.esta_activo
                          ? 'estado-activo'
                          : 'estado-inactivo'
                      }
                    >
                      {usuario.esta_activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    {usuario.fecha_ultimo_acceso
                      ? formatearFechaHora(usuario.fecha_ultimo_acceso)
                      : 'Nunca'}
                  </td>
                  {puedeGestionar && (
                    <td>
                      <button
                        className="boton-tabla"
                        onClick={() => {
                          setUsuarioEditado(usuario);
                          setModalAbierto(true);
                        }}
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
      <Modal
        abierto={modalAbierto}
        titulo={usuarioEditado ? 'Editar usuario' : 'Nuevo usuario'}
        ancho="grande"
        alCerrar={() => {
          setModalAbierto(false);
          setUsuarioEditado(undefined);
        }}
      >
        <FormularioUsuario
          key={usuarioEditado?.id ?? 'nuevo'}
          usuario={usuarioEditado}
          roles={roles}
          alGuardar={guardar}
          alCancelar={() => {
            setModalAbierto(false);
            setUsuarioEditado(undefined);
          }}
        />
      </Modal>
    </section>
  );
}
