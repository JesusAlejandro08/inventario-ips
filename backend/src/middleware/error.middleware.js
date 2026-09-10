export function rutaNoEncontrada(req, res) {
  res.status(404).json({
    mensaje: `La ruta ${req.method} ${req.originalUrl} no existe.`,
  });
}

export function manejarError(error, req, res, next) {
  console.error(error);

  res.status(500).json({
    mensaje: "Ocurrió un error interno en el servidor.",
  });
}
