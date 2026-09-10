import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { consultar } from "../database.js";

export async function iniciarSesion(req, res, next) {
  try {
    const { usuario, password } = req.body;

    if (!usuario?.trim() || !password) {
      return res.status(400).json({
        mensaje: "Usuario y contraseña son obligatorios.",
      });
    }

    const registros = await consultar(
      `
        SELECT
          id,
          nombre,
          usuario,
          password_hash,
          rol,
          activo
        FROM usuarios
        WHERE usuario = ?
        LIMIT 1
      `,
      [usuario.trim()]
    );

    const cuenta = registros[0];

    if (!cuenta || !cuenta.activo) {
      return res.status(401).json({
        mensaje: "Usuario o contraseña incorrectos.",
      });
    }

    const passwordCorrecto = await bcrypt.compare(
      password,
      cuenta.password_hash
    );

    if (!passwordCorrecto) {
      return res.status(401).json({
        mensaje: "Usuario o contraseña incorrectos.",
      });
    }

    const token = jwt.sign(
      {
        id: cuenta.id,
        nombre: cuenta.nombre,
        usuario: cuenta.usuario,
        rol: cuenta.rol,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      }
    );

    await consultar(
      `
        UPDATE usuarios
        SET ultimo_acceso = NOW()
        WHERE id = ?
      `,
      [cuenta.id]
    );

    await consultar(
      `
        INSERT INTO auditoria (
          usuario_id,
          accion,
          entidad,
          entidad_id,
          detalles,
          direccion_ip
        )
        VALUES (?, 'INICIAR_SESION', 'sesion', ?, ?, ?)
      `,
      [
        cuenta.id,
        String(cuenta.id),
        JSON.stringify({
          usuario: cuenta.usuario,
        }),
        req.ip,
      ]
    );

    res.json({
      token,
      usuario: {
        id: cuenta.id,
        nombre: cuenta.nombre,
        usuario: cuenta.usuario,
        rol: cuenta.rol,
      },
    });
  } catch (error) {
    next(error);
  }
}

export function obtenerSesion(req, res) {
  res.json({
    usuario: req.usuario,
  });
}
