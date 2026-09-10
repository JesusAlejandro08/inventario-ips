import { Router } from "express";
import { listarAuditoria } from "../controllers/auditoria.controller.js";
import { permitirRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.get(
  "/",
  permitirRoles("Administrador"),
  listarAuditoria
);

export default router;
