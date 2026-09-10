import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import auditoriaRoutes from "./routes/auditoria.routes.js";
import authRoutes from "./routes/auth.routes.js";
import direccionesRoutes from "./routes/direcciones.routes.js";
import segmentosRoutes from "./routes/segmentos.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";

import { auditarCambios } from "./middleware/auditoria.middleware.js";
import { autenticar } from "./middleware/auth.middleware.js";
import {
  manejarError,
  rutaNoEncontrada,
} from "./middleware/error.middleware.js";

const app = express();

/*
 * Middleware generales
 */
app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
  }),
);

app.use(express.json({ limit: "100kb" }));
app.use(morgan("dev"));

/*
 * Comprobación pública del estado de la API
 */
app.get("/api/salud", (req, res) => {
  res.json({
    estado: "correcto",
    servicio: "API Inventario de IP",
  });
});

/*
 * Autenticación: rutas públicas
 */
app.use("/api/auth", authRoutes);

/*
 * Inventario de segmentos
 */
app.use(
  "/api/segmentos",
  autenticar,
  auditarCambios("segmento"),
  segmentosRoutes,
);

/*
 * Inventario de direcciones IP
 */
app.use(
  "/api/direcciones",
  autenticar,
  auditarCambios("direccion_ip"),
  direccionesRoutes,
);

/*
 * Consulta de la bitácora.
 * El rol se valida dentro de auditoria.routes.js.
 */
app.use("/api/auditoria", autenticar, auditoriaRoutes);

/*
 * Administración de usuarios.
 * El rol se valida dentro de usuarios.routes.js.
 */
app.use("/api/usuarios", autenticar, auditarCambios("usuario"), usuariosRoutes);

/*
 * Estos middleware siempre deben permanecer al final.
 */
app.use(rutaNoEncontrada);
app.use(manejarError);

export default app;
