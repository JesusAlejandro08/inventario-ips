import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  cerrarPool,
  consultar,
} from "../database.js";

async function crearUsuarioConsulta() {
  const nombre = process.env.CONSULTA_NOMBRE;
  const usuario = process.env.CONSULTA_USUARIO;
  const password = process.env.CONSULTA_PASSWORD;

  if (!nombre || !usuario || !password) {
    throw new Error(
      "Faltan nombre, usuario o contraseña."
    );
  }

  if (password.length < 10) {
    throw new Error(
      "La contraseña debe tener al menos 10 caracteres."
    );
  }

  const existentes = await consultar(
    "SELECT id FROM usuarios WHERE usuario = ?",
    [usuario]
  );

  if (existentes.length > 0) {
    throw new Error("El nombre de usuario ya existe.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await consultar(
    `
      INSERT INTO usuarios (
        nombre,
        usuario,
        password_hash,
        rol,
        activo
      )
      VALUES (?, ?, ?, 'Consulta', TRUE)
    `,
    [nombre, usuario, passwordHash]
  );

  console.log("Usuario de consulta creado correctamente.");
}

try {
  await crearUsuarioConsulta();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await cerrarPool();
}
