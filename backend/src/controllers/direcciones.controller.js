import { consultar } from "../database.js";
import {
  ipPerteneceAlSegmento,
  obtenerBroadcast,
  validarIPv4,
} from "../utils/red.js";

const estadosPermitidos = [
  "Disponible",
  "En uso",
  "Reservada",
  "Inactiva",
];

function prepararDireccion(registro) {
  return {
    id: registro.id,
    segmentoId: registro.segmento_id,
    ip: registro.direccion_ip,
    hostname: registro.hostname,
    dispositivo: registro.dispositivo,
    ubicacion: registro.ubicacion,
    responsable: registro.responsable,
    estado: registro.estado,
    observaciones: registro.observaciones,
    fechaRegistro: registro.creado_en,
    actualizadoEn: registro.actualizado_en,
    segmento: registro.segmento_nombre,
    direccionRed: registro.direccion_red,
    prefijo: registro.prefijo,
    cidr: registro.direccion_red
      ? `${registro.direccion_red}/${registro.prefijo}`
      : null,
    vlan: registro.vlan,
  };
}

async function buscarSegmento(id) {
  const registros = await consultar(
    `
      SELECT id, nombre, direccion_red, prefijo, gateway, vlan
      FROM segmentos_red
      WHERE id = ?
    `,
    [id]
  );

  return registros[0] || null;
}

function validarDireccionEnSegmento(ip, segmento) {
  if (
    !ipPerteneceAlSegmento(
      ip,
      segmento.direccion_red,
      Number(segmento.prefijo)
    )
  ) {
    return `La IP ${ip} no pertenece al segmento ${segmento.direccion_red}/${segmento.prefijo}.`;
  }

  const prefijo = Number(segmento.prefijo);

  if (prefijo <= 30 && ip === segmento.direccion_red) {
    return "No puedes asignar la dirección de red.";
  }

  const broadcast = obtenerBroadcast(
    segmento.direccion_red,
    prefijo
  );

  if (prefijo <= 30 && ip === broadcast) {
    return "No puedes asignar la dirección de broadcast.";
  }

  return null;
}

export async function listarDirecciones(req, res, next) {
  try {
    const condiciones = [];
    const parametros = [];

    if (req.query.segmentoId) {
      condiciones.push("d.segmento_id = ?");
      parametros.push(req.query.segmentoId);
    }

    if (req.query.estado) {
      condiciones.push("d.estado = ?");
      parametros.push(req.query.estado);
    }

    if (req.query.buscar) {
      const texto = `%${req.query.buscar}%`;

      condiciones.push(`
        (
          d.direccion_ip LIKE ?
          OR d.hostname LIKE ?
          OR d.dispositivo LIKE ?
          OR d.ubicacion LIKE ?
          OR d.responsable LIKE ?
          OR s.nombre LIKE ?
        )
      `);

      parametros.push(
        texto,
        texto,
        texto,
        texto,
        texto,
        texto
      );
    }

    const where =
      condiciones.length > 0
        ? `WHERE ${condiciones.join(" AND ")}`
        : "";

    const registros = await consultar(
      `
        SELECT
          d.*,
          s.nombre AS segmento_nombre,
          s.direccion_red,
          s.prefijo,
          s.vlan
        FROM direcciones_ip d
        INNER JOIN segmentos_red s
          ON s.id = d.segmento_id
        ${where}
        ORDER BY INET_ATON(d.direccion_ip)
      `,
      parametros
    );

    res.json(registros.map(prepararDireccion));
  } catch (error) {
    next(error);
  }
}

export async function obtenerDireccion(req, res, next) {
  try {
    const registros = await consultar(
      `
        SELECT
          d.*,
          s.nombre AS segmento_nombre,
          s.direccion_red,
          s.prefijo,
          s.vlan
        FROM direcciones_ip d
        INNER JOIN segmentos_red s
          ON s.id = d.segmento_id
        WHERE d.id = ?
      `,
      [req.params.id]
    );

    if (registros.length === 0) {
      return res.status(404).json({
        mensaje: "La dirección IP no existe.",
      });
    }

    res.json(prepararDireccion(registros[0]));
  } catch (error) {
    next(error);
  }
}

export async function crearDireccion(req, res, next) {
  try {
    const {
      segmentoId,
      ip,
      hostname,
      dispositivo,
      ubicacion,
      responsable,
      estado = "Disponible",
      observaciones,
    } = req.body;

    if (!segmentoId) {
      return res.status(400).json({
        mensaje: "Selecciona un segmento de red.",
      });
    }

    if (!validarIPv4(ip)) {
      return res.status(400).json({
        mensaje: "Introduce una dirección IPv4 válida.",
      });
    }

    if (!dispositivo?.trim() || !ubicacion?.trim()) {
      return res.status(400).json({
        mensaje: "Dispositivo y ubicación son obligatorios.",
      });
    }

    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({
        mensaje: "El estado seleccionado no es válido.",
      });
    }

    const segmento = await buscarSegmento(segmentoId);

    if (!segmento) {
      return res.status(404).json({
        mensaje: "El segmento de red seleccionado no existe.",
      });
    }

    const errorSegmento = validarDireccionEnSegmento(
      ip.trim(),
      segmento
    );

    if (errorSegmento) {
      return res.status(400).json({
        mensaje: errorSegmento,
      });
    }

    const resultado = await consultar(
      `
        INSERT INTO direcciones_ip (
          segmento_id,
          direccion_ip,
          hostname,
          dispositivo,
          ubicacion,
          responsable,
          estado,
          observaciones
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        segmentoId,
        ip.trim(),
        hostname?.trim() || null,
        dispositivo.trim(),
        ubicacion.trim(),
        responsable?.trim() || null,
        estado,
        observaciones?.trim() || null,
      ]
    );

    const registros = await consultar(
      `
        SELECT
          d.*,
          s.nombre AS segmento_nombre,
          s.direccion_red,
          s.prefijo,
          s.vlan
        FROM direcciones_ip d
        INNER JOIN segmentos_red s
          ON s.id = d.segmento_id
        WHERE d.id = ?
      `,
      [resultado.insertId]
    );

    res.status(201).json(prepararDireccion(registros[0]));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        mensaje: "Esta dirección IP ya está registrada.",
      });
    }

    next(error);
  }
}

export async function actualizarDireccion(req, res, next) {
  try {
    const {
      segmentoId,
      ip,
      hostname,
      dispositivo,
      ubicacion,
      responsable,
      estado,
      observaciones,
    } = req.body;

    if (!segmentoId || !validarIPv4(ip)) {
      return res.status(400).json({
        mensaje: "El segmento y la dirección IP son obligatorios.",
      });
    }

    if (!dispositivo?.trim() || !ubicacion?.trim()) {
      return res.status(400).json({
        mensaje: "Dispositivo y ubicación son obligatorios.",
      });
    }

    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({
        mensaje: "El estado seleccionado no es válido.",
      });
    }

    const segmento = await buscarSegmento(segmentoId);

    if (!segmento) {
      return res.status(404).json({
        mensaje: "El segmento de red seleccionado no existe.",
      });
    }

    const errorSegmento = validarDireccionEnSegmento(
      ip.trim(),
      segmento
    );

    if (errorSegmento) {
      return res.status(400).json({
        mensaje: errorSegmento,
      });
    }

    const resultado = await consultar(
      `
        UPDATE direcciones_ip
        SET
          segmento_id = ?,
          direccion_ip = ?,
          hostname = ?,
          dispositivo = ?,
          ubicacion = ?,
          responsable = ?,
          estado = ?,
          observaciones = ?
        WHERE id = ?
      `,
      [
        segmentoId,
        ip.trim(),
        hostname?.trim() || null,
        dispositivo.trim(),
        ubicacion.trim(),
        responsable?.trim() || null,
        estado,
        observaciones?.trim() || null,
        req.params.id,
      ]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensaje: "La dirección IP no existe.",
      });
    }

    const registros = await consultar(
      `
        SELECT
          d.*,
          s.nombre AS segmento_nombre,
          s.direccion_red,
          s.prefijo,
          s.vlan
        FROM direcciones_ip d
        INNER JOIN segmentos_red s
          ON s.id = d.segmento_id
        WHERE d.id = ?
      `,
      [req.params.id]
    );

    res.json(prepararDireccion(registros[0]));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        mensaje: "Esta dirección IP ya está registrada.",
      });
    }

    next(error);
  }
}

export async function eliminarDireccion(req, res, next) {
  try {
    const resultado = await consultar(
      "DELETE FROM direcciones_ip WHERE id = ?",
      [req.params.id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensaje: "La dirección IP no existe.",
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
