import { z } from 'zod';

export const esquemaConsultaStock = z.object({
  buscar: z.string().trim().max(180).optional(),
  categoria_id: z.coerce.number().int().positive().optional(),
  marca_id: z.coerce.number().int().positive().optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(25),
  solo_bajo_minimo: z.enum(['true', 'false']).optional().transform((valor) => valor === 'true'),
});

export const esquemaAjusteStock = z.object({
  producto_id: z.coerce.number().int().positive(),
  ubicacion_id: z.coerce.number().int().positive(),
  cantidad_nueva: z.coerce.number().min(0).max(999999999999.999),
  motivo: z.string().trim().min(5).max(255),
});

export const esquemaAjusteStockMasivo = z.object({
  ubicacion_id: z.coerce.number().int().positive(),
  motivo: z.string().trim().min(5).max(255),
  ajustes: z.array(z.object({
    producto_id: z.coerce.number().int().positive(),
    cantidad_nueva: z.coerce.number().min(0).max(999999999999.999),
  })).min(1).max(100).refine(
    (ajustes) => new Set(ajustes.map((ajuste) => ajuste.producto_id)).size === ajustes.length,
    'No puede repetirse un producto',
  ),
});

export const esquemaConsultaMovimientos = z.object({
  buscar: z.string().trim().max(180).optional(),
  tipo: z.string().trim().max(60).optional(),
  sentido: z.enum(['todos', 'entradas', 'salidas']).default('todos'),
  fecha_desde: z.string().date().optional(),
  fecha_hasta: z.string().date().optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(25),
}).refine(
  (consulta) => !consulta.fecha_desde || !consulta.fecha_hasta || consulta.fecha_desde <= consulta.fecha_hasta,
  { message: 'El rango de fechas no es válido', path: ['fecha_hasta'] },
);
