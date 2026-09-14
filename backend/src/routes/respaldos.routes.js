import { Router } from "express";
import multer from "multer";

import {
  crearRespaldo,
  descargarRespaldo,
  eliminarRespaldo,
  importarRespaldo,
  listarRespaldos,
  restaurarRespaldo,
} from "../controllers/respaldos.controller.js";

import { permitirRoles } from "../middleware/auth.middleware.js";

const router = Router();

const subirRespaldo = multer({
  dest: "/tmp/inventario-ips-uploads",

  limits: {
    files: 1,
    fileSize: 100 * 1024 * 1024,
  },

  fileFilter(req, archivo, callback) {
    if (archivo.originalname.toLowerCase().endsWith(".sql.gz")) {
      callback(null, true);
      return;
    }

    const error = new Error("Solamente se permiten respaldos .sql.gz.");

    error.status = 400;

    callback(error);
  },
});

router.use(permitirRoles("Administrador"));

router.get("/", listarRespaldos);

router.post("/", crearRespaldo);

router.post("/importar", subirRespaldo.single("respaldo"), importarRespaldo);

router.get("/:nombre", descargarRespaldo);

router.post("/:nombre/restaurar", restaurarRespaldo);

router.delete("/:nombre", eliminarRespaldo);

export default router;
