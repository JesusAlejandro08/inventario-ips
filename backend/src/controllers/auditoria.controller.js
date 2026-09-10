import { consultar } from "../database.js";

function convertirDetalles(detalles) {
  if (!detalles) {
    return null;
  }

  if (typeof detalles === "object") {
    return detalles;
  }

  try {
    return JSON.parse(detalles);
  } catch {
    return null;
  }
}

export async function listarAuditoria(req, res, next) {
  try {
    const pagina = Math.max(
      Number(req.query.pagina) || 1,
      1
    );

    const limite = Math.min(
      Math.max(Number(req.query.limite) || 50, 1),
      100
    );

    const desplazamiento = (pagina - 1) * limite;
    const condiciones = [];
    const parametros = [];

    if (req.query.accion) {
      condiciones.push("a.accion = ?");
      parametros.push(req.query.accion);
    }

    if (req.query.entidad) {
      condiciones.push("a.entidad = ?");
      parametros.push(req.query.entidad);
    }

    if (req.query.usuarioId) {
      condiciones.push("a.usuario_id = ?");
      parametros.push(req.query.usuarioId);
    }

    const where =
      condiciones.length > 0
        ? `WHERE ${condiciones.join(" AND ")}`
        : "";

    const totales = await consultar(
      `
        SELECT COUNT(*) AS total
        FROM auditoria a
        ${where}
      `,
      parametros
    );

    const registros = await consultar(
      `
        SELECT
          a.id,
          a.accion,
          a.entidad,
          a.entidad_id,
          a.detalles,
          a.direccion_ip,
          a.creado_en,
          u.nombre AS usuario_nombre,
          u.usuario
        FROM auditoria a
        LEFT JOIN usuarios u
          ON u.id = a.usuario_id
        ${where}
        ORDER BY a.creado_en DESC, a.id DESC
        LIMIT ? OFFSET ?
      `,
      [...parametros, limite, desplazamiento]
    );

    const total = Number(totales[0].total);

    res.json({
      registros: registros.map((registro) => ({
        id: registro.id,
        accion: registro.accion,
        entidad: registro.entidad,
        entidadId: registro.entidad_id,
        detalles: convertirDetalles(registro.detalles),
        direccionIp: registro.direccion_ip,
        creadoEn: registro.creado_en,
        usuario: registro.usuario,
        usuarioNombre:
          registro.usuario_nombre || "Usuario eliminado",
      })),
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: Math.max(
          Math.ceil(total / limite),
          1
        ),
      },
    });
  } catch (error) {
    next(error);
  }
}
