import { Router } from "express";
import {
  actualizarDireccion,
  crearDireccion,
  eliminarDireccion,
  listarDirecciones,
  obtenerDireccion,
} from "../controllers/direcciones.controller.js";

const router = Router();

router.get("/", listarDirecciones);
router.get("/:id", obtenerDireccion);
router.post("/", crearDireccion);
router.put("/:id", actualizarDireccion);
router.delete("/:id", eliminarDireccion);

export default router;
