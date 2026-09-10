import { registrarAuditoria } from "../services/auditoria.service.js";

const acciones = {
  POST: "CREAR",
  PUT: "ACTUALIZAR",
  PATCH: "ACTUALIZAR",
  DELETE: "ELIMINAR",
};

function limpiarDatos(datos) {
  if (!datos || typeof datos !== "object") {
    return null;
  }

  const copia = { ...datos };

  delete copia.password;
  delete copia.passwordActual;
  delete copia.passwordNueva;
  delete copia.password_hash;
  delete copia.token;

  return copia;
}

export function auditarCambios(entidad) {
  return function middlewareAuditoria(req, res, next) {
    const accion = acciones[req.method];

    if (!accion) {
      return next();
    }

    let respuestaJson = null;
    const jsonOriginal = res.json.bind(res);

    res.json = function jsonConAuditoria(contenido) {
      respuestaJson = contenido;
      return jsonOriginal(contenido);
    };

    res.on("finish", () => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return;
      }

      const partesRuta = req.path
        .split("/")
        .filter(Boolean);

      const idRuta = partesRuta.find((parte) =>
        /^\d+$/.test(parte)
      );

      const entidadId =
        respuestaJson?.id ||
        idRuta ||
        req.body?.id ||
        null;

      void registrarAuditoria({
        usuarioId: req.usuario?.id,
        accion,
        entidad,
        entidadId,
        detalles: {
          metodo: req.method,
          ruta: req.originalUrl,
          datos: limpiarDatos(req.body),
        },
        direccionIp: req.ip,
      });
    });

    next();
  };
}
