import { Router } from "express";
import {
  crearRespaldo,
  descargarRespaldo,
  eliminarRespaldo,
  listarRespaldos,
  restaurarRespaldo,
} from "../controllers/respaldos.controller.js";
import { permitirRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(permitirRoles("Administrador"));

router.get("/", listarRespaldos);

router.post("/", crearRespaldo);

router.get("/:nombre", descargarRespaldo);

router.post("/:nombre/restaurar", restaurarRespaldo);

router.delete("/:nombre", eliminarRespaldo);

export default router;
