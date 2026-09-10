import { consultar } from "../database.js";

export async function registrarAuditoria({
  usuarioId,
  accion,
  entidad,
  entidadId,
  detalles,
  direccionIp,
}) {
  try {
    await consultar(
      `
        INSERT INTO auditoria (
          usuario_id,
          accion,
          entidad,
          entidad_id,
          detalles,
          direccion_ip
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        usuarioId || null,
        accion,
        entidad,
        entidadId ? String(entidadId) : null,
        detalles ? JSON.stringify(detalles) : null,
        direccionIp || null,
      ]
    );
  } catch (error) {
    console.error(
      "No fue posible registrar la auditoría:",
      error.message
    );
  }
}
