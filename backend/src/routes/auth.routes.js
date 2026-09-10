import { Router } from "express";
import {
  iniciarSesion,
  obtenerSesion,
} from "../controllers/auth.controller.js";
import { autenticar } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/login", iniciarSesion);
router.get("/sesion", autenticar, obtenerSesion);

export default router;
