import { Router } from "express";
import { crearRespaldo } from "../controllers/respaldos.controller.js";
import { permitirRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", permitirRoles("Administrador"), crearRespaldo);

export default router;
