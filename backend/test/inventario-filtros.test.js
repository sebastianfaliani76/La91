import test from 'node:test';
import assert from 'node:assert/strict';

import { esquemaConsultaMovimientos } from '../src/modulos/inventario/inventario.esquemas.js';

test('acepta filtros combinados del historial de stock', () => {
  const resultado = esquemaConsultaMovimientos.safeParse({
    buscar: 'CAÑUELAS',
    tipo: 'salida',
    sentido: 'salidas',
    fecha_desde: '2026-08-15',
    fecha_hasta: '2026-08-16',
    pagina: '1',
    limite: '25',
  });
  assert.equal(resultado.success, true);
  assert.equal(resultado.data.pagina, 1);
  assert.equal(resultado.data.sentido, 'salidas');
});

test('rechaza rangos de fechas invertidos', () => {
  const resultado = esquemaConsultaMovimientos.safeParse({
    fecha_desde: '2026-08-16',
    fecha_hasta: '2026-08-15',
  });
  assert.equal(resultado.success, false);
});
