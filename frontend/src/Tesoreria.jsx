import { useCallback, useEffect, useState } from 'react';
import { Modal } from './componentes/Modal.jsx';
import { fechaParaInput, formatearFecha } from './utilidades/fechas.js';
import { Paginacion } from './componentes/Paginacion.jsx';
import { useActualizacionAutomatica } from './hooks/useActualizacionAutomatica.js';
const moneda = (v) =>
    Number(v).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }),
  hoy = fechaParaInput;
async function api(u, t, o = {}) {
  const r = await fetch(u, {
      ...o,
      headers: {
        Authorization: `Bearer ${t}`,
        ...(o.body ? { 'Content-Type': 'application/json' } : {}),
      },
    }),
    d = await r.json();
  if (!r.ok) throw new Error(d.mensaje || 'No se pudo completar');
  return d;
}
export function Tesoreria({ token, permisos }) {
  const [cuentas, setCuentas] = useState([]),
    [movimientos, setMovimientos] = useState([]),
    [resumen, setResumen] = useState({
      disponible: 0,
      obligaciones: { proveedores: 0, gastos: 0, sueldos: 0 },
      mes: { ingresos: 0, egresos: 0 },
    }),
    [totales, setTotales] = useState({ ingresos: 0, egresos: 0 }),
    [cuenta, setCuenta] = useState(''),
    [tipo, setTipo] = useState('todos'),
    [buscar, setBuscar] = useState(''),
    [pagina, setPagina] = useState(1),
    [totalMovimientos, setTotalMovimientos] = useState(0),
    [modalCuenta, setModalCuenta] = useState(false),
    [modalMovimiento, setModalMovimiento] = useState(false),
    [modalTransferencia, setModalTransferencia] = useState(false),
    [mensaje, setMensaje] = useState(''),
    [procesando, setProcesando] = useState(false),
    [limite, setLimite] = useState(25);
  const gestionar = permisos.includes('tesoreria.gestionar');
  const paginas = Math.max(1, Math.ceil(totalMovimientos / limite));
  const cargar = useCallback(async () => {
    try {
      const p = new URLSearchParams({ tipo, pagina, limite });
      if (cuenta) p.set('cuenta_id', cuenta);
      if (buscar) p.set('buscar', buscar);
      const [c, m, r] = await Promise.all([
        api('/api/tesoreria/cuentas', token),
        api(`/api/tesoreria/movimientos?${p}`, token),
        api('/api/tesoreria/resumen', token),
      ]);
      setCuentas(c.datos);
      setMovimientos(m.datos);
      setTotalMovimientos(Number(m.total));
      setTotales({ ingresos: m.ingresos, egresos: m.egresos });
      setResumen(r.dato);
    } catch (e) {
      setMensaje(e.message);
    }
  }, [token, cuenta, tipo, buscar, pagina, limite]);
  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
  }, [cargar]);
  useActualizacionAutomatica(
    cargar,
    !modalCuenta && !modalMovimiento && !modalTransferencia && !procesando,
  );
  async function enviar(ruta, datos, cierre) {
    setProcesando(true);
    try {
      await api(ruta, token, { method: 'POST', body: JSON.stringify(datos) });
      cierre(false);
      await cargar();
      setMensaje('Movimiento registrado correctamente.');
    } catch (e) {
      setMensaje(e.message);
    } finally {
      setProcesando(false);
    }
  }
  function crearCuenta(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    enviar(
      '/api/tesoreria/cuentas',
      {
        nombre: f.get('nombre'),
        tipo: f.get('tipo'),
        moneda: 'ARS',
        saldo_inicial: Number(f.get('saldo_inicial')),
        observaciones: f.get('observaciones') || null,
      },
      setModalCuenta,
    );
  }
  function crearMovimiento(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    enviar(
      '/api/tesoreria/movimientos',
      {
        cuenta_tesoreria_id: Number(f.get('cuenta')),
        tipo: f.get('tipo'),
        categoria: f.get('categoria'),
        concepto: f.get('concepto'),
        monto: Number(f.get('monto')),
        referencia: f.get('referencia') || null,
        fecha: f.get('fecha'),
      },
      setModalMovimiento,
    );
  }
  function transferir(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    enviar(
      '/api/tesoreria/transferencias',
      {
        cuenta_origen_id: Number(f.get('origen')),
        cuenta_destino_id: Number(f.get('destino')),
        monto: Number(f.get('monto')),
        concepto: f.get('concepto'),
        referencia: f.get('referencia') || null,
        fecha: f.get('fecha'),
      },
      setModalTransferencia,
    );
  }
  return (
    <section className="modulo">
      <div className="modulo__encabezado">
        <div>
          <p className="etiqueta">FINANZAS</p>
          <h2>Tesorería</h2>
        </div>
        {gestionar && (
          <div className="acciones-encabezado">
            <button
              className="boton boton--secundario"
              onClick={() => setModalCuenta(true)}
            >
              Nueva cuenta
            </button>
            <button
              className="boton boton--secundario"
              onClick={() => setModalTransferencia(true)}
            >
              Transferir
            </button>
            <button className="boton" onClick={() => setModalMovimiento(true)}>
              Nuevo movimiento
            </button>
          </div>
        )}
      </div>
      <div className="tarjetas-resumen">
        <div>
          <span>Disponible</span>
          <strong>{moneda(resumen.disponible)}</strong>
        </div>
        <div>
          <span>Deuda proveedores</span>
          <strong>{moneda(resumen.obligaciones.proveedores)}</strong>
        </div>
        <div>
          <span>Gastos pendientes</span>
          <strong>{moneda(resumen.obligaciones.gastos)}</strong>
        </div>
        <div>
          <span>Sueldos pendientes</span>
          <strong>{moneda(resumen.obligaciones.sueldos)}</strong>
        </div>
        <div>
          <span>Ingresos del mes</span>
          <strong>{moneda(resumen.mes.ingresos)}</strong>
        </div>
        <div>
          <span>Egresos del mes</span>
          <strong>{moneda(resumen.mes.egresos)}</strong>
        </div>
      </div>
      <div className="rejilla-tablero">
        <article className="panel">
          <h3>Cuentas</h3>
          {cuentas.map((c) => (
            <div className="fila-reporte" key={c.id}>
              <span>
                {c.nombre}
                <small className="dato-secundario">
                  {c.tipo} · {c.moneda}
                </small>
              </span>
              <strong>{moneda(c.saldo)}</strong>
            </div>
          ))}
        </article>
        <article className="panel">
          <h3>Obligaciones consolidadas</h3>
          <div className="fila-reporte">
            <span>Total comprometido</span>
            <strong>
              {moneda(
                resumen.obligaciones.proveedores +
                  resumen.obligaciones.gastos +
                  resumen.obligaciones.sueldos,
              )}
            </strong>
          </div>
          <div className="fila-reporte">
            <span>Disponible neto proyectado</span>
            <strong>
              {moneda(
                resumen.disponible -
                  resumen.obligaciones.proveedores -
                  resumen.obligaciones.gastos -
                  resumen.obligaciones.sueldos,
              )}
            </strong>
          </div>
        </article>
      </div>
      <div className="barra-filtros">
        <input
          placeholder="Buscar concepto, categoría o referencia"
          value={buscar}
          onChange={(e) => {
            setBuscar(e.target.value);
            setPagina(1);
          }}
        />
        <select
          value={cuenta}
          onChange={(e) => {
            setCuenta(e.target.value);
            setPagina(1);
          }}
        >
          <option value="">Todas las cuentas</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);
            setPagina(1);
          }}
        >
          <option value="todos">Ingresos y egresos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
        </select>
      </div>
      {mensaje && <p className="mensaje">{mensaje}</p>}
      <article className="panel">
        <div className="panel__encabezado">
          <h3>Libro de tesorería</h3>
          <span>
            Ingresos {moneda(totales.ingresos)} · Egresos{' '}
            {moneda(totales.egresos)}
            {' · '}
            {totalMovimientos.toLocaleString('es-AR')} movimientos
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
                <th>Fecha</th>
                <th>Cuenta</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Concepto</th>
                <th>Referencia</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id}>
                  <td>{formatearFecha(m.fecha)}</td>
                  <td>
                    {m.cuenta}
                    {m.cuenta_destino && (
                      <small className="dato-secundario">
                        Contrapartida: {m.cuenta_destino}
                      </small>
                    )}
                  </td>
                  <td>{m.tipo}</td>
                  <td>{m.categoria}</td>
                  <td>{m.concepto}</td>
                  <td>{m.referencia || '—'}</td>
                  <td
                    className={`importe-movimiento importe-movimiento--${m.tipo}`}
                  >
                    {m.tipo === 'ingreso' ? '+' : '-'}
                    {moneda(m.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            onClick={() => setPagina((valor) => valor - 1)}
          >
            Anterior
          </button>
          <span>
            Página {pagina} de {paginas}
          </span>
          <button
            disabled={pagina >= paginas}
            onClick={() => setPagina((valor) => valor + 1)}
          >
            Siguiente
          </button>
          */}
        </div>
      </article>
      <Modal
        abierto={modalCuenta}
        titulo="Nueva cuenta de tesorería"
        alCerrar={() => setModalCuenta(false)}
      >
        <form className="formulario-modal" onSubmit={crearCuenta}>
          <label>Nombre</label>
          <input name="nombre" required />
          <label>Tipo</label>
          <select name="tipo">
            <option value="banco">Banco</option>
            <option value="efectivo">Efectivo</option>
            <option value="billetera">Billetera virtual</option>
            <option value="inversion">Inversión</option>
          </select>
          <label>Saldo inicial</label>
          <input
            name="saldo_inicial"
            type="number"
            step=".01"
            defaultValue="0"
            required
          />
          <label>Observaciones</label>
          <textarea name="observaciones" />
          <div className="modal__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setModalCuenta(false)}
            >
              Cancelar
            </button>
            <button className="boton">Crear cuenta</button>
          </div>
        </form>
      </Modal>
      <Modal
        abierto={modalMovimiento}
        titulo="Nuevo movimiento"
        alCerrar={() => setModalMovimiento(false)}
      >
        <form className="formulario-modal" onSubmit={crearMovimiento}>
          <label>Cuenta</label>
          <select name="cuenta" required>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <label>Tipo</label>
          <select name="tipo">
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </select>
          <label>Categoría</label>
          <select name="categoria">
            <option value="aporte">Aporte</option>
            <option value="retiro">Retiro</option>
            <option value="venta">Venta</option>
            <option value="cobranza">Cobranza</option>
            <option value="proveedor">Proveedor</option>
            <option value="gasto">Gasto</option>
            <option value="sueldo">Sueldo</option>
            <option value="impuesto">Impuesto</option>
            <option value="ajuste">Ajuste</option>
            <option value="otro">Otro</option>
          </select>
          <label>Concepto</label>
          <input name="concepto" required />
          <label>Importe</label>
          <input name="monto" type="number" min=".01" step=".01" required />
          <label>Fecha</label>
          <input name="fecha" type="date" defaultValue={hoy()} required />
          <label>Referencia</label>
          <input name="referencia" />
          <div className="modal__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setModalMovimiento(false)}
            >
              Cancelar
            </button>
            <button className="boton">Registrar</button>
          </div>
        </form>
      </Modal>
      <Modal
        abierto={modalTransferencia}
        titulo="Transferencia entre cuentas"
        alCerrar={() => setModalTransferencia(false)}
      >
        <form className="formulario-modal" onSubmit={transferir}>
          <label>Cuenta de origen</label>
          <select name="origen" required>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <label>Cuenta de destino</label>
          <select name="destino" required>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <label>Importe</label>
          <input name="monto" type="number" min=".01" step=".01" required />
          <label>Concepto</label>
          <input
            name="concepto"
            defaultValue="Transferencia entre cuentas"
            required
          />
          <label>Fecha</label>
          <input name="fecha" type="date" defaultValue={hoy()} required />
          <label>Referencia</label>
          <input name="referencia" />
          <div className="modal__acciones">
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setModalTransferencia(false)}
            >
              Cancelar
            </button>
            <button className="boton" disabled={procesando}>
              Transferir
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
