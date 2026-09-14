import { consultar } from "../database.js";
import {
  calcularCapacidad,
  enteroAIp,
  ipAEntero,
  obtenerBroadcast,
  obtenerDireccionRed,
  validarIPv4,
} from "../utils/red.js";

function calcularCapacidadAsignable(prefijo, gateway) {
  const capacidadRango = calcularCapacidad(prefijo);

  return Math.max(capacidadRango - (gateway ? 1 : 0), 0);
}

function validarGatewaySegmento(gateway, direccionRed, prefijo) {
  if (!gateway) {
    return null;
  }

  const gatewayLimpio = gateway.trim();

  if (!validarIPv4(gatewayLimpio)) {
    return "El gateway no es una IPv4 válida.";
  }

  const redGateway = obtenerDireccionRed(gatewayLimpio, prefijo);

  if (redGateway !== direccionRed) {
    return `El gateway ${gatewayLimpio} no pertenece al segmento ${direccionRed}/${prefijo}.`;
  }

  if (prefijo <= 30 && gatewayLimpio === direccionRed) {
    return "El gateway no puede ser la dirección de red.";
  }

  const broadcast = obtenerBroadcast(direccionRed, prefijo);

  if (prefijo <= 30 && gatewayLimpio === broadcast) {
    return "El gateway no puede ser la dirección de broadcast.";
  }

  return null;
}

function normalizarUbicacion(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function buscarSegmentoSolapado(
  direccionRed,
  prefijo,
  ubicacion,
  segmentoExcluirId = null,
) {
  const nuevaUbicacion = normalizarUbicacion(ubicacion);

  const nuevaRedInicio = ipAEntero(obtenerDireccionRed(direccionRed, prefijo));

  const nuevaRedFin = ipAEntero(obtenerBroadcast(direccionRed, prefijo));

  const segmentos = await consultar(`
    SELECT
      id,
      nombre,
      direccion_red,
      prefijo,
      vlan,
      ubicacion
    FROM segmentos_red
  `);

  for (const segmento of segmentos) {
    if (
      segmentoExcluirId !== null &&
      String(segmento.id) === String(segmentoExcluirId)
    ) {
      continue;
    }

    const ubicacionExistente = normalizarUbicacion(segmento.ubicacion);

    /*
     * Los rangos repetidos se permiten cuando
     * pertenecen a ubicaciones diferentes.
     */
    if (ubicacionExistente !== nuevaUbicacion) {
      continue;
    }

    const prefijoExistente = Number(segmento.prefijo);

    const redExistenteInicio = ipAEntero(
      obtenerDireccionRed(segmento.direccion_red, prefijoExistente),
    );

    const redExistenteFin = ipAEntero(
      obtenerBroadcast(segmento.direccion_red, prefijoExistente),
    );

    const existeSolapamiento =
      nuevaRedInicio <= redExistenteFin && nuevaRedFin >= redExistenteInicio;

    if (existeSolapamiento) {
      return {
        ...segmento,
        cidr: `${segmento.direccion_red}/${prefijoExistente}`,
        inicio: enteroAIp(redExistenteInicio),
        fin: enteroAIp(redExistenteFin),
      };
    }
  }

  return null;
}

function responderSolapamiento(
  res,
  direccionRed,
  prefijo,
  ubicacion,
  segmento,
) {
  const nuevoBroadcast = obtenerBroadcast(direccionRed, prefijo);

  return res.status(409).json({
    mensaje:
      `No se puede guardar ${direccionRed}/${prefijo} en "${ubicacion}" porque se superpone con ` +
      `"${segmento.nombre}" (${segmento.cidr}) de la misma ubicación.`,
    conflicto: {
      segmentoId: segmento.id,
      nombre: segmento.nombre,
      cidr: segmento.cidr,
      vlan: segmento.vlan,
      ubicacion: segmento.ubicacion,
      rangoExistente: `${segmento.inicio} - ${segmento.fin}`,
      rangoSolicitado: `${direccionRed} - ${nuevoBroadcast}`,
    },
  });
}

function prepararSegmento(registro) {
  const prefijo = Number(registro.prefijo);

  const capacidad = calcularCapacidadAsignable(prefijo, registro.gateway);

  const asignadas = Number(registro.direcciones_asignadas || 0);

  return {
    id: registro.id,
    nombre: registro.nombre,
    direccionRed: registro.direccion_red,
    prefijo,
    cidr: `${registro.direccion_red}/${prefijo}`,
    gateway: registro.gateway,
    vlan: registro.vlan,
    ubicacion: registro.ubicacion,
    descripcion: registro.descripcion,
    broadcast: obtenerBroadcast(registro.direccion_red, prefijo),
    capacidad,
    asignadas,
    disponibles: Math.max(capacidad - asignadas, 0),
    creadoEn: registro.creado_en,
    actualizadoEn: registro.actualizado_en,
  };
}

export async function listarSegmentos(req, res, next) {
  try {
    const registros = await consultar(`
      SELECT
        s.*,
        COUNT(
          CASE
            WHEN s.gateway IS NULL
              OR d.direccion_ip <> s.gateway
            THEN d.id
          END
        ) AS direcciones_asignadas
      FROM segmentos_red s
      LEFT JOIN direcciones_ip d
        ON d.segmento_id = s.id
      GROUP BY s.id
      ORDER BY
        INET_ATON(s.direccion_red),
        s.prefijo
    `);

    res.json(registros.map(prepararSegmento));
  } catch (error) {
    next(error);
  }
}

export async function obtenerSegmento(req, res, next) {
  try {
    const registros = await consultar(
      `
        SELECT
          s.*,
          COUNT(
            CASE
              WHEN s.gateway IS NULL
                OR d.direccion_ip <> s.gateway
              THEN d.id
            END
          ) AS direcciones_asignadas
        FROM segmentos_red s
        LEFT JOIN direcciones_ip d
          ON d.segmento_id = s.id
        WHERE s.id = ?
        GROUP BY s.id
      `,
      [req.params.id],
    );

    if (registros.length === 0) {
      return res.status(404).json({
        mensaje: "El segmento de red no existe.",
      });
    }

    res.json(prepararSegmento(registros[0]));
  } catch (error) {
    next(error);
  }
}

export async function crearSegmento(req, res, next) {
  try {
    const {
      nombre,
      direccionRed,
      prefijo,
      gateway,
      vlan,
      ubicacion,
      descripcion,
    } = req.body;

    const prefijoNumerico = Number(prefijo);

    const vlanNumerica =
      vlan === "" || vlan === null || vlan === undefined ? null : Number(vlan);

    if (!nombre?.trim() || !ubicacion?.trim()) {
      return res.status(400).json({
        mensaje: "Nombre y ubicación son obligatorios.",
      });
    }

    if (!validarIPv4(direccionRed)) {
      return res.status(400).json({
        mensaje: "La dirección de red no es una IPv4 válida.",
      });
    }

    if (
      !Number.isInteger(prefijoNumerico) ||
      prefijoNumerico < 0 ||
      prefijoNumerico > 32
    ) {
      return res.status(400).json({
        mensaje: "El prefijo debe estar entre 0 y 32.",
      });
    }

    const redNormalizada = obtenerDireccionRed(direccionRed, prefijoNumerico);

    if (redNormalizada !== direccionRed) {
      return res.status(400).json({
        mensaje: `La dirección de red correcta para este prefijo es ${redNormalizada}/${prefijoNumerico}.`,
      });
    }

    const gatewayNormalizado = gateway?.trim() || null;

    const errorGateway = validarGatewaySegmento(
      gatewayNormalizado,
      redNormalizada,
      prefijoNumerico,
    );

    if (errorGateway) {
      return res.status(400).json({
        mensaje: errorGateway,
      });
    }
    const segmentoSolapado = await buscarSegmentoSolapado(
      redNormalizada,
      prefijoNumerico,
      ubicacion.trim(),
      req.params.id,
    );

    if (segmentoSolapado) {
      return responderSolapamiento(
        res,
        redNormalizada,
        prefijoNumerico,
        ubicacion.trim(),
        segmentoSolapado,
      );
    }
    if (
      vlanNumerica !== null &&
      (!Number.isInteger(vlanNumerica) ||
        vlanNumerica < 1 ||
        vlanNumerica > 4094)
    ) {
      return res.status(400).json({
        mensaje: "La VLAN debe estar entre 1 y 4094.",
      });
    }

    const resultado = await consultar(
      `
        INSERT INTO segmentos_red (
          nombre,
          direccion_red,
          prefijo,
          gateway,
          vlan,
          ubicacion,
          descripcion
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        nombre.trim(),
        redNormalizada,
        prefijoNumerico,
        gatewayNormalizado,
        vlanNumerica,
        ubicacion.trim(),
        descripcion?.trim() || null,
      ],
    );

    const creado = await consultar(
      `
        SELECT *
        FROM segmentos_red
        WHERE id = ?
      `,
      [resultado.insertId],
    );

    res.status(201).json(
      prepararSegmento({
        ...creado[0],
        direcciones_asignadas: 0,
      }),
    );
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        mensaje: "Este segmento de red ya está registrado.",
      });
    }

    next(error);
  }
}

export async function actualizarSegmento(req, res, next) {
  try {
    const {
      nombre,
      direccionRed,
      prefijo,
      gateway,
      vlan,
      ubicacion,
      descripcion,
    } = req.body;

    const prefijoNumerico = Number(prefijo);

    const vlanNumerica =
      vlan === "" || vlan === null || vlan === undefined ? null : Number(vlan);

    if (!nombre?.trim() || !ubicacion?.trim()) {
      return res.status(400).json({
        mensaje: "Nombre y ubicación son obligatorios.",
      });
    }

    if (
      !validarIPv4(direccionRed) ||
      !Number.isInteger(prefijoNumerico) ||
      prefijoNumerico < 0 ||
      prefijoNumerico > 32
    ) {
      return res.status(400).json({
        mensaje: "La red o el prefijo no son válidos.",
      });
    }

    const redNormalizada = obtenerDireccionRed(direccionRed, prefijoNumerico);

    if (redNormalizada !== direccionRed) {
      return res.status(400).json({
        mensaje: `La dirección de red correcta es ${redNormalizada}/${prefijoNumerico}.`,
      });
    }

    const gatewayNormalizado = gateway?.trim() || null;

    const errorGateway = validarGatewaySegmento(
      gatewayNormalizado,
      redNormalizada,
      prefijoNumerico,
    );

    if (errorGateway) {
      return res.status(400).json({
        mensaje: errorGateway,
      });
    }
    const segmentoSolapado = await buscarSegmentoSolapado(
      redNormalizada,
      prefijoNumerico,
      ubicacion.trim(),
      req.params.id,
    );

    if (segmentoSolapado) {
      return responderSolapamiento(
        res,
        redNormalizada,
        prefijoNumerico,
        ubicacion.trim(),
        segmentoSolapado,
      );
    }
    if (
      vlanNumerica !== null &&
      (!Number.isInteger(vlanNumerica) ||
        vlanNumerica < 1 ||
        vlanNumerica > 4094)
    ) {
      return res.status(400).json({
        mensaje: "La VLAN debe estar entre 1 y 4094.",
      });
    }

    const direccionesFueraDelNuevoRango = await consultar(
      `
          SELECT direccion_ip
          FROM direcciones_ip
          WHERE segmento_id = ?
        `,
      [req.params.id],
    );

    const direccionInvalida = direccionesFueraDelNuevoRango.find(
      (registro) =>
        obtenerDireccionRed(registro.direccion_ip, prefijoNumerico) !==
        redNormalizada,
    );

    if (direccionInvalida) {
      return res.status(409).json({
        mensaje: `No se puede cambiar el segmento porque la IP ${direccionInvalida.direccion_ip} quedaría fuera del nuevo rango.`,
      });
    }

    const gatewayYaRegistrado = gatewayNormalizado
      ? direccionesFueraDelNuevoRango.some(
          (registro) => registro.direccion_ip === gatewayNormalizado,
        )
      : false;

    if (gatewayYaRegistrado) {
      return res.status(409).json({
        mensaje: `La IP ${gatewayNormalizado} ya está registrada. Elimínala o cámbiala antes de utilizarla como gateway.`,
      });
    }

    const resultado = await consultar(
      `
        UPDATE segmentos_red
        SET
          nombre = ?,
          direccion_red = ?,
          prefijo = ?,
          gateway = ?,
          vlan = ?,
          ubicacion = ?,
          descripcion = ?
        WHERE id = ?
      `,
      [
        nombre.trim(),
        redNormalizada,
        prefijoNumerico,
        gatewayNormalizado,
        vlanNumerica,
        ubicacion.trim(),
        descripcion?.trim() || null,
        req.params.id,
      ],
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensaje: "El segmento de red no existe.",
      });
    }

    const actualizado = await consultar(
      `
        SELECT
          s.*,
          COUNT(
            CASE
              WHEN s.gateway IS NULL
                OR d.direccion_ip <> s.gateway
              THEN d.id
            END
          ) AS direcciones_asignadas
        FROM segmentos_red s
        LEFT JOIN direcciones_ip d
          ON d.segmento_id = s.id
        WHERE s.id = ?
        GROUP BY s.id
      `,
      [req.params.id],
    );

    res.json(prepararSegmento(actualizado[0]));
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        mensaje: "Este segmento de red ya está registrado.",
      });
    }

    next(error);
  }
}

export async function eliminarSegmento(req, res, next) {
  try {
    const resultado = await consultar(
      `
        DELETE FROM segmentos_red
        WHERE id = ?
      `,
      [req.params.id],
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensaje: "El segmento de red no existe.",
      });
    }

    res.status(204).send();
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        mensaje:
          "No se puede eliminar el segmento porque tiene direcciones IP asignadas.",
      });
    }

    next(error);
  }
}

export async function obtenerDireccionesSegmento(req, res, next) {
  try {
    const pagina = Math.max(Number(req.query.pagina) || 1, 1);

    const limite = Math.min(Math.max(Number(req.query.limite) || 256, 1), 256);

    const segmentos = await consultar(
      `
        SELECT *
        FROM segmentos_red
        WHERE id = ?
      `,
      [req.params.id],
    );

    if (segmentos.length === 0) {
      return res.status(404).json({
        mensaje: "El segmento de red no existe.",
      });
    }

    const segmento = segmentos[0];
    const prefijo = Number(segmento.prefijo);

    /*
     * La capacidad del rango se conserva para
     * recorrer todas las IP, incluido el gateway.
     */
    const capacidadRango = calcularCapacidad(prefijo);

    /*
     * Esta capacidad descuenta el gateway y es
     * la que se muestra como asignable.
     */
    const capacidadAsignable = calcularCapacidadAsignable(
      prefijo,
      segmento.gateway,
    );

    const redNumero = ipAEntero(segmento.direccion_red);

    const primerHost = prefijo <= 30 ? redNumero + 1 : redNumero;

    const registros = await consultar(
      `
        SELECT
          id,
          direccion_ip,
          hostname,
          dispositivo,
          responsable,
          estado,
          ubicacion
        FROM direcciones_ip
        WHERE segmento_id = ?
      `,
      [req.params.id],
    );

    const registrosPorIp = new Map(
      registros.map((registro) => [registro.direccion_ip, registro]),
    );

    const inicio = (pagina - 1) * limite;

    const fin = Math.min(inicio + limite, capacidadRango);

    const direcciones = [];

    for (let indice = inicio; indice < fin; indice += 1) {
      const ip = enteroAIp((primerHost + indice) >>> 0);

      const registro = registrosPorIp.get(ip);

      const esGateway = segmento.gateway === ip;

      direcciones.push({
        ip,
        tipo: esGateway ? "Gateway" : "Host",
        estado: esGateway
          ? "Reservada"
          : registro
            ? registro.estado
            : "Disponible",
        disponible: !registro && !esGateway,
        registro:
          registro && !esGateway
            ? {
                id: registro.id,
                hostname: registro.hostname,
                dispositivo: registro.dispositivo,
                responsable: registro.responsable,
                ubicacion: registro.ubicacion,
              }
            : null,
      });
    }

    const gatewayReservado = segmento.gateway ? 1 : 0;

    const registrosAsignables = registros.filter(
      (registro) => registro.direccion_ip !== segmento.gateway,
    ).length;

    const totalDisponibles = Math.max(
      capacidadAsignable - registrosAsignables,
      0,
    );

    res.json({
      segmento: {
        id: segmento.id,
        nombre: segmento.nombre,
        cidr: `${segmento.direccion_red}/${prefijo}`,
        direccionRed: segmento.direccion_red,
        prefijo,
        gateway: segmento.gateway,
        broadcast: obtenerBroadcast(segmento.direccion_red, prefijo),
        vlan: segmento.vlan,
        ubicacion: segmento.ubicacion,
      },
      resumen: {
        capacidad: capacidadAsignable,
        registradas: registrosAsignables,
        disponibles: totalDisponibles,
        gatewayReservado,
      },
      paginacion: {
        pagina,
        limite,
        total: capacidadRango,
        totalPaginas: Math.max(Math.ceil(capacidadRango / limite), 1),
      },
      direcciones,
    });
  } catch (error) {
    next(error);
  }
}
