import { Router } from "express";
import {
  actualizarDireccion,
  crearDireccion,
  eliminarDireccion,
  exportarDireccionesCsv,
  listarDirecciones,
  obtenerDireccion,
} from "../controllers/direcciones.controller.js";

const router = Router();

router.get("/", listarDirecciones);

/*
 * Esta ruta debe estar antes de /:id para evitar
 * que Express interprete "exportar" como un ID.
 */
router.get("/exportar/csv", exportarDireccionesCsv);

router.get("/:id", obtenerDireccion);
router.post("/", crearDireccion);
router.put("/:id", actualizarDireccion);
router.delete("/:id", eliminarDireccion);

export default router;
