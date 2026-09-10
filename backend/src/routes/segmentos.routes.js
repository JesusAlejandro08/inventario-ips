import { Router } from "express";
import {
  actualizarSegmento,
  crearSegmento,
  eliminarSegmento,
  listarSegmentos,
  obtenerDireccionesSegmento,
  obtenerSegmento,
} from "../controllers/segmentos.controller.js";

const router = Router();

router.get("/", listarSegmentos);
router.get("/:id/direcciones", obtenerDireccionesSegmento);
router.get("/:id", obtenerSegmento);
router.post("/", crearSegmento);
router.put("/:id", actualizarSegmento);
router.delete("/:id", eliminarSegmento);

export default router;
