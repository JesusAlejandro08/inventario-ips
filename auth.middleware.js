import jwt from "jsonwebtoken";

export function autenticar(req, res, next) {
  const autorizacion = req.headers.authorization;

  if (!autorizacion?.startsWith("Bearer ")) {
    return res.status(401).json({
      mensaje: "Debes iniciar sesión.",
    });
  }

  const token = autorizacion.slice(7);

  try {
    const contenido = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.usuario = {
      id: contenido.id,
      nombre: contenido.nombre,
      usuario: contenido.usuario,
      rol: contenido.rol,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      mensaje:
        error.name === "TokenExpiredError"
          ? "La sesión ha expirado."
          : "La sesión no es válida.",
    });
  }
}

export function permitirRoles(...roles) {
  return function verificarRol(req, res, next) {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({
        mensaje:
          "No tienes permisos para realizar esta acción.",
      });
    }

    next();
  };
}
