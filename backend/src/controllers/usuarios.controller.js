import bcrypt from "bcryptjs";
import { consultar } from "../database.js";

const rolesPermitidos = ["Administrador", "Consulta"];

function prepararUsuario(registro) {
  return {
    id: registro.id,
    nombre: registro.nombre,
    usuario: registro.usuario,
    rol: registro.rol,
    activo: Boolean(registro.activo),
    ultimoAcceso: registro.ultimo_acceso,
    creadoEn: registro.creado_en,
    actualizadoEn: registro.actualizado_en,
  };
}

export async function listarUsuarios(req, res, next) {
  try {
    const registros = await consultar(`
      SELECT
        id,
        nombre,
        usuario,
        rol,
        activo,
        ultimo_acceso,
        creado_en,
        actualizado_en
      FROM usuarios
      ORDER BY activo DESC, nombre
    `);

    res.json(registros.map(prepararUsuario));
  } catch (error) {
    next(error);
  }
}

export async function crearUsuario(req, res, next) {
  try {
    const { nombre, usuario, password, rol = "Consulta" } = req.body;

    if (!nombre?.trim() || !usuario?.trim() || !password) {
      return res.status(400).json({
        mensaje: "Nombre, usuario y contraseña son obligatorios.",
      });
    }

    if (usuario.trim().length < 3) {
      return res.status(400).json({
        mensaje: "El nombre de usuario debe tener al menos 3 caracteres.",
      });
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(usuario.trim())) {
      return res.status(400).json({
        mensaje:
          "El usuario solamente puede contener letras, números, punto, guion y guion bajo.",
      });
    }

    if (password.length < 10) {
      return res.status(400).json({
        mensaje: "La contraseña debe tener al menos 10 caracteres.",
      });
    }

    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({
        mensaje: "El rol seleccionado no es válido.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const resultado = await consultar(
      `
        INSERT INTO usuarios (
          nombre,
          usuario,
          password_hash,
          rol,
          activo
        )
        VALUES (?, ?, ?, ?, TRUE)
      `,
      [nombre.trim(), usuario.trim(), passwordHash, rol],
    );

    const creado = await consultar(
      `
        SELECT
          id,
          nombre,
          usuario,
          rol,
          activo,
          ultimo_acceso,
          creado_en,
          actualizado_en
        FROM usuarios
        WHERE id = ?
      `,
      [resultado.insertId],
    );

    res.status(201).json(prepararUsuario(creado[0]));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        mensaje: "El nombre de usuario ya existe.",
      });
    }

    next(error);
  }
}

export async function actualizarUsuario(req, res, next) {
  try {
    const { nombre, usuario, rol, activo } = req.body;

    if (!nombre?.trim() || !usuario?.trim()) {
      return res.status(400).json({
        mensaje: "Nombre y usuario son obligatorios.",
      });
    }

    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({
        mensaje: "El rol seleccionado no es válido.",
      });
    }

    const activoNormalizado = activo === true || activo === 1;

    if (
      Number(req.params.id) === Number(req.usuario.id) &&
      (!activoNormalizado || rol !== "Administrador")
    ) {
      return res.status(400).json({
        mensaje:
          "No puedes desactivar tu propia cuenta ni retirar tu rol de administrador.",
      });
    }

    const resultado = await consultar(
      `
        UPDATE usuarios
        SET
          nombre = ?,
          usuario = ?,
          rol = ?,
          activo = ?
        WHERE id = ?
      `,
      [nombre.trim(), usuario.trim(), rol, activoNormalizado, req.params.id],
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensaje: "El usuario no existe.",
      });
    }

    const actualizado = await consultar(
      `
        SELECT
          id,
          nombre,
          usuario,
          rol,
          activo,
          ultimo_acceso,
          creado_en,
          actualizado_en
        FROM usuarios
        WHERE id = ?
      `,
      [req.params.id],
    );

    res.json(prepararUsuario(actualizado[0]));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        mensaje: "El nombre de usuario ya existe.",
      });
    }

    next(error);
  }
}

export async function cambiarPassword(req, res, next) {
  try {
    const { password } = req.body;

    if (!password || password.length < 10) {
      return res.status(400).json({
        mensaje: "La nueva contraseña debe tener al menos 10 caracteres.",
      });
    }

    const existente = await consultar("SELECT id FROM usuarios WHERE id = ?", [
      req.params.id,
    ]);

    if (existente.length === 0) {
      return res.status(404).json({
        mensaje: "El usuario no existe.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await consultar(
      `
        UPDATE usuarios
        SET password_hash = ?
        WHERE id = ?
      `,
      [passwordHash, req.params.id],
    );

    res.json({
      mensaje: "Contraseña actualizada correctamente.",
      id: Number(req.params.id),
    });
  } catch (error) {
    next(error);
  }
}

export async function eliminarUsuario(req, res, next) {
  try {
    const usuarioId = Number(req.params.id);

    if (usuarioId === Number(req.usuario.id)) {
      return res.status(400).json({
        mensaje: "No puedes eliminar tu propia cuenta.",
      });
    }

    const registros = await consultar(
      `
        SELECT id, nombre, usuario, rol, activo
        FROM usuarios
        WHERE id = ?
      `,
      [usuarioId],
    );

    if (registros.length === 0) {
      return res.status(404).json({
        mensaje: "El usuario no existe.",
      });
    }

    const usuario = registros[0];

    if (usuario.rol === "Administrador" && Boolean(usuario.activo)) {
      const administradores = await consultar(`
        SELECT COUNT(*) AS total
        FROM usuarios
        WHERE rol = 'Administrador'
          AND activo = TRUE
      `);

      if (Number(administradores[0].total) <= 1) {
        return res.status(400).json({
          mensaje: "No puedes eliminar al último administrador activo.",
        });
      }
    }

    await consultar("DELETE FROM usuarios WHERE id = ?", [usuarioId]);

    res.json({
      id: usuarioId,
      mensaje: "Usuario eliminado correctamente.",
      usuario: usuario.usuario,
    });
  } catch (error) {
    next(error);
  }
}
