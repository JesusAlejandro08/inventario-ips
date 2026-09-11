import pool, { consultar } from "../database.js";
import {
  ipPerteneceAlSegmento,
  obtenerBroadcast,
  validarIPv4,
} from "../utils/red.js";

const estadosPermitidos = ["Disponible", "En uso", "Reservada", "Inactiva"];

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
    [id],
  );

  return registros[0] || null;
}

function validarDireccionEnSegmento(ip, segmento) {
  if (
    !ipPerteneceAlSegmento(ip, segmento.direccion_red, Number(segmento.prefijo))
  ) {
    return `La IP ${ip} no pertenece al segmento ${segmento.direccion_red}/${segmento.prefijo}.`;
  }

  const prefijo = Number(segmento.prefijo);

  if (prefijo <= 30 && ip === segmento.direccion_red) {
    return "No puedes asignar la dirección de red.";
  }

  const broadcast = obtenerBroadcast(segmento.direccion_red, prefijo);

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

      parametros.push(texto, texto, texto, texto, texto, texto);
    }

    const where =
      condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

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
      parametros,
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
      [req.params.id],
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

    const errorSegmento = validarDireccionEnSegmento(ip.trim(), segmento);

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
      ],
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
      [resultado.insertId],
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

    const errorSegmento = validarDireccionEnSegmento(ip.trim(), segmento);

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
      ],
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
      [req.params.id],
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
      [req.params.id],
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

function protegerCeldaCsv(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  let texto = String(valor);

  // Evita que Excel interprete contenido como fórmula.
  if (/^[=+\-@]/.test(texto)) {
    texto = `'${texto}`;
  }

  if (
    texto.includes(",") ||
    texto.includes('"') ||
    texto.includes("\n") ||
    texto.includes("\r")
  ) {
    texto = `"${texto.replaceAll('"', '""')}"`;
  }

  return texto;
}

function fechaNombreArchivo() {
  return new Date().toISOString().slice(0, 10);
}

export async function exportarDireccionesCsv(req, res, next) {
  try {
    const condiciones = [];
    const parametros = [];

    if (req.query.segmentoId && req.query.segmentoId !== "Todos") {
      condiciones.push("d.segmento_id = ?");
      parametros.push(req.query.segmentoId);
    }

    if (req.query.estado && req.query.estado !== "Todos") {
      condiciones.push("d.estado = ?");
      parametros.push(req.query.estado);
    }

    if (req.query.buscar) {
      condiciones.push(`
        (
          d.direccion_ip LIKE ?
          OR d.hostname LIKE ?
          OR d.dispositivo LIKE ?
          OR d.ubicacion LIKE ?
          OR d.responsable LIKE ?
          OR d.observaciones LIKE ?
          OR s.nombre LIKE ?
        )
      `);

      const busqueda = `%${req.query.buscar}%`;

      parametros.push(
        busqueda,
        busqueda,
        busqueda,
        busqueda,
        busqueda,
        busqueda,
        busqueda,
      );
    }

    const where =
      condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

    const direcciones = await consultar(
      `
        SELECT
          d.direccion_ip,
          d.hostname,
          d.dispositivo,
          s.nombre AS segmento,
          CONCAT(s.direccion_red, '/', s.prefijo) AS cidr,
          s.vlan,
          d.ubicacion,
          d.responsable,
          d.estado,
          d.observaciones,
          d.creado_en
        FROM direcciones_ip d
        INNER JOIN segmentos_red s
          ON s.id = d.segmento_id
        ${where}
        ORDER BY INET_ATON(d.direccion_ip) ASC
      `,
      parametros,
    );

    const encabezados = [
      "Dirección IP",
      "Hostname",
      "Dispositivo",
      "Segmento",
      "CIDR",
      "VLAN",
      "Ubicación",
      "Responsable",
      "Estado",
      "Observaciones",
      "Fecha de registro",
    ];

    const filas = direcciones.map((direccion) =>
      [
        direccion.direccion_ip,
        direccion.hostname,
        direccion.dispositivo,
        direccion.segmento,
        direccion.cidr,
        direccion.vlan,
        direccion.ubicacion,
        direccion.responsable,
        direccion.estado,
        direccion.observaciones,
        direccion.creado_en ? new Date(direccion.creado_en).toISOString() : "",
      ]
        .map(protegerCeldaCsv)
        .join(","),
    );

    // BOM para que Excel reconozca correctamente UTF-8.
    const contenido = `\uFEFF${[
      encabezados.map(protegerCeldaCsv).join(","),
      ...filas,
    ].join("\r\n")}`;

    const nombre = `inventario-direcciones-${fechaNombreArchivo()}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
    res.setHeader("Cache-Control", "no-store");

    res.status(200).send(contenido);
  } catch (error) {
    next(error);
  }
}

function limpiarTexto(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function enteroPositivo(valor) {
  const numero = Number(valor);

  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

export async function importarDirecciones(req, res, next) {
  let conexion;

  try {
    if (req.usuario?.rol !== "Administrador") {
      return res.status(403).json({
        mensaje: "Solamente los administradores pueden importar direcciones.",
      });
    }

    const registros = req.body?.registros;
    const confirmar = req.body?.confirmar === true;

    if (!Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({
        mensaje: "El archivo no contiene registros para importar.",
      });
    }

    if (registros.length > 500) {
      return res.status(400).json({
        mensaje: "Solamente se permiten 500 direcciones por importación.",
      });
    }

    const segmentos = await consultar(`
      SELECT
        id,
        nombre,
        direccion_red,
        prefijo,
        gateway
      FROM segmentos_red
      ORDER BY id
    `);

    const segmentosPorId = new Map(
      segmentos.map((segmento) => [Number(segmento.id), segmento]),
    );

    const ipsArchivo = new Map();

    for (const registro of registros) {
      const ip = limpiarTexto(registro.ip);

      ipsArchivo.set(ip, (ipsArchivo.get(ip) || 0) + 1);
    }

    const ipsExistentes = await consultar(`
      SELECT direccion_ip
      FROM direcciones_ip
    `);

    const conjuntoIpsExistentes = new Set(
      ipsExistentes.map((registro) => String(registro.direccion_ip)),
    );

    const resultado = registros.map((registro, indice) => {
      const fila = indice + 2;
      const errores = [];

      const segmentoId = enteroPositivo(registro.segmentoId);

      const ip = limpiarTexto(registro.ip);
      const hostname = limpiarTexto(registro.hostname) || null;
      const dispositivo = limpiarTexto(registro.dispositivo);
      const ubicacion = limpiarTexto(registro.ubicacion);
      const responsable = limpiarTexto(registro.responsable) || null;
      const estado = limpiarTexto(registro.estado) || "Disponible";
      const observaciones = limpiarTexto(registro.observaciones) || null;

      if (!segmentoId) {
        errores.push("El identificador del segmento no es válido.");
      }

      const segmento = segmentosPorId.get(segmentoId);

      if (segmentoId && !segmento) {
        errores.push(`El segmento ${segmentoId} no existe.`);
      }

      if (!validarIPv4(ip)) {
        errores.push("La dirección IPv4 no es válida.");
      }

      if (!dispositivo) {
        errores.push("El dispositivo es obligatorio.");
      }

      if (!ubicacion) {
        errores.push("La ubicación es obligatoria.");
      }

      if (!estadosPermitidos.includes(estado)) {
        errores.push(`El estado "${estado}" no es válido.`);
      }

      if (ip && ipsArchivo.get(ip) > 1) {
        errores.push("La dirección IP está repetida dentro del archivo.");
      }

      if (ip && conjuntoIpsExistentes.has(ip)) {
        errores.push("La dirección IP ya está registrada.");
      }

      if (segmento && validarIPv4(ip)) {
        const errorSegmento = validarDireccionEnSegmento(ip, segmento);

        if (errorSegmento) {
          errores.push(errorSegmento);
        }
      }

      return {
        fila,
        segmentoId,
        segmento: segmento?.nombre || null,
        ip,
        hostname,
        dispositivo,
        ubicacion,
        responsable,
        estado,
        observaciones,
        valido: errores.length === 0,
        errores,
      };
    });

    const validos = resultado.filter((registro) => registro.valido);

    const invalidos = resultado.filter((registro) => !registro.valido);

    if (!confirmar) {
      return res.json({
        vistaPrevia: true,
        total: resultado.length,
        validos: validos.length,
        invalidos: invalidos.length,
        registros: resultado,
      });
    }

    if (invalidos.length > 0) {
      return res.status(400).json({
        mensaje:
          "Corrige los registros inválidos antes de confirmar la importación.",
        vistaPrevia: true,
        total: resultado.length,
        validos: validos.length,
        invalidos: invalidos.length,
        registros: resultado,
      });
    }

    conexion = await pool.getConnection();
    await conexion.beginTransaction();

    for (const registro of validos) {
      await conexion.query(
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
          registro.segmentoId,
          registro.ip,
          registro.hostname,
          registro.dispositivo,
          registro.ubicacion,
          registro.responsable,
          registro.estado,
          registro.observaciones,
        ],
      );
    }

    await conexion.commit();

    res.status(201).json({
      mensaje: `${validos.length} direcciones importadas correctamente.`,
      importados: validos.length,
    });
  } catch (error) {
    if (conexion) {
      await conexion.rollback().catch(() => {});
    }

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        mensaje: "Una dirección IP ya fue registrada durante la importación.",
      });
    }

    next(error);
  } finally {
    if (conexion) {
      conexion.release();
    }
  }
}
