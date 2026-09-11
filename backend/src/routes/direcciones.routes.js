import { Router } from "express";
import {
  actualizarDireccion,
  crearDireccion,
  eliminarDireccion,
  exportarDireccionesCsv,
  importarDirecciones,
  listarDirecciones,
  obtenerDireccion,
} from "../controllers/direcciones.controller.js";

const router = Router();

router.get("/", listarDirecciones);
router.get("/exportar/csv", exportarDireccionesCsv);
router.post("/importar", importarDirecciones);

router.get("/:id", obtenerDireccion);
router.post("/", crearDireccion);
router.put("/:id", actualizarDireccion);
router.delete("/:id", eliminarDireccion);

export default router;
