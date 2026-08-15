const OPCIONES = [10, 25, 50, 100];

export function Paginacion({
  pagina,
  paginas,
  limite,
  alCambiarPagina,
  alCambiarLimite,
}) {
  const totalPaginas = Math.max(1, Number(paginas) || 1);
  return (
    <div className="paginacion paginacion--completa">
      <span>
        Página {pagina} de {totalPaginas}
      </span>
      {alCambiarLimite && (
        <label>
          Mostrar{' '}
          <select
            value={limite}
            onChange={(e) => alCambiarLimite(Number(e.target.value))}
          >
            {OPCIONES.map((cantidad) => (
              <option key={cantidad} value={cantidad}>
                {cantidad}
              </option>
            ))}
          </select>{' '}
          por página
        </label>
      )}
      <div className="paginacion__acciones">
        <button
          type="button"
          disabled={pagina <= 1}
          onClick={() => alCambiarPagina(pagina - 1)}
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={pagina >= totalPaginas}
          onClick={() => alCambiarPagina(pagina + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
