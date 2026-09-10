export function validarIPv4(ip) {
  if (typeof ip !== "string") {
    return false;
  }

  const partes = ip.trim().split(".");

  return (
    partes.length === 4 &&
    partes.every(
      (parte) =>
        /^\d{1,3}$/.test(parte) &&
        Number(parte) >= 0 &&
        Number(parte) <= 255 &&
        String(Number(parte)) === parte,
    )
  );
}

export function ipAEntero(ip) {
  return ip
    .split(".")
    .map(Number)
    .reduce((resultado, octeto) => ((resultado << 8) | octeto) >>> 0, 0);
}

export function enteroAIp(numero) {
  return [
    (numero >>> 24) & 255,
    (numero >>> 16) & 255,
    (numero >>> 8) & 255,
    numero & 255,
  ].join(".");
}

export function obtenerMascara(prefijo) {
  if (prefijo === 0) {
    return 0;
  }

  return (0xffffffff << (32 - prefijo)) >>> 0;
}

export function obtenerDireccionRed(ip, prefijo) {
  const mascara = obtenerMascara(prefijo);

  return enteroAIp((ipAEntero(ip) & mascara) >>> 0);
}

export function obtenerBroadcast(ip, prefijo) {
  const mascara = obtenerMascara(prefijo);
  const red = ipAEntero(ip) & mascara;

  return enteroAIp((red | (~mascara >>> 0)) >>> 0);
}

export function calcularCapacidad(prefijo) {
  const total = 2 ** (32 - prefijo);

  if (prefijo === 32) {
    return 1;
  }

  if (prefijo === 31) {
    return 2;
  }

  return Math.max(total - 2, 0);
}

export function ipPerteneceAlSegmento(ip, direccionRed, prefijo) {
  return (
    obtenerDireccionRed(ip, prefijo) ===
    obtenerDireccionRed(direccionRed, prefijo)
  );
}
