import { useEffect, useRef } from 'react';

export function useActualizacionAutomatica(actualizar, activo = true, intervaloMs = 10000) {
  const actualizarRef = useRef(actualizar);
  const actualizandoRef = useRef(false);

  useEffect(() => {
    actualizarRef.current = actualizar;
  }, [actualizar]);

  useEffect(() => {
    if (!activo) return undefined;
    const ejecutar = async () => {
      if (document.visibilityState !== 'visible' || actualizandoRef.current) return;
      actualizandoRef.current = true;
      try {
        await actualizarRef.current?.();
      } catch {
        // La actualización manual del módulo seguirá mostrando errores persistentes.
      } finally {
        actualizandoRef.current = false;
      }
    };
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') ejecutar();
    };
    const temporizador = window.setInterval(ejecutar, intervaloMs);
    window.addEventListener('focus', ejecutar);
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      window.clearInterval(temporizador);
      window.removeEventListener('focus', ejecutar);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [activo, intervaloMs]);
}
