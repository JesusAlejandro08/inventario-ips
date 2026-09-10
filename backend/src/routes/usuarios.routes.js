import { Router } from "express";
import {
  actualizarUsuario,
  cambiarPassword,
  crearUsuario,
  eliminarUsuario,
  listarUsuarios,
} from "../controllers/usuarios.controller.js";
import { permitirRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.use(permitirRoles("Administrador"));

router.get("/", listarUsuarios);
router.post("/", crearUsuario);
router.put("/:id", actualizarUsuario);
router.put("/:id/password", cambiarPassword);
router.delete("/:id", eliminarUsuario);

export default router;
