import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  cerrarPool,
  consultar,
} from "../database.js";

async function crearAdministrador() {
  const nombre = process.env.ADMIN_NOMBRE;
  const usuario = process.env.ADMIN_USUARIO;
  const password = process.env.ADMIN_PASSWORD;

  if (!nombre || !usuario || !password) {
    console.error(
      "Faltan ADMIN_NOMBRE, ADMIN_USUARIO o ADMIN_PASSWORD."
    );
    process.exitCode = 1;
    return;
  }

  if (password.length < 10) {
    console.error(
      "La contraseña debe contener al menos 10 caracteres."
    );
    process.exitCode = 1;
    return;
  }

  const existente = await consultar(
    "SELECT id FROM usuarios WHERE usuario = ?",
    [usuario]
  );

  if (existente.length > 0) {
    console.error("El nombre de usuario ya existe.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await consultar(
    `
      INSERT INTO usuarios (
        nombre,
        usuario,
        password_hash,
        rol
      )
      VALUES (?, ?, ?, 'Administrador')
    `,
    [nombre, usuario, passwordHash]
  );

  console.log("Administrador creado correctamente.");
}

try {
  await crearAdministrador();
} catch (error) {
  console.error("No fue posible crear el administrador:");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await cerrarPool();
}
