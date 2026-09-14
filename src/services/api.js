const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const CLAVE_TOKEN = "inventario_ips_token";

export function obtenerToken() {
  return sessionStorage.getItem(CLAVE_TOKEN);
}

export function guardarToken(token) {
  sessionStorage.setItem(CLAVE_TOKEN, token);
}

export function cerrarSesion() {
  sessionStorage.removeItem(CLAVE_TOKEN);
}

async function solicitar(ruta, opciones = {}) {
  const token = obtenerToken();

  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
      ...opciones.headers,
    },
  });

  if (respuesta.status === 204) {
    return null;
  }

  const contenido = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    if (respuesta.status === 401 && ruta !== "/auth/login") {
      cerrarSesion();
    }

    throw new Error(
      contenido?.mensaje ||
        `Error ${respuesta.status}: no fue posible completar la solicitud.`,
    );
  }

  return contenido;
}

export async function iniciarSesion(credenciales) {
  const resultado = await solicitar("/auth/login", {
    method: "POST",
    body: JSON.stringify(credenciales),
  });

  guardarToken(resultado.token);
  return resultado;
}

export function obtenerSesion() {
  return solicitar("/auth/sesion");
}

export function listarSegmentos() {
  return solicitar("/segmentos");
}

export function obtenerSegmento(id) {
  return solicitar(`/segmentos/${id}`);
}

export function crearSegmento(datos) {
  return solicitar("/segmentos", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function actualizarSegmento(id, datos) {
  return solicitar(`/segmentos/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

export function eliminarSegmento(id) {
  return solicitar(`/segmentos/${id}`, {
    method: "DELETE",
  });
}

export function listarDirecciones(filtros = {}) {
  const parametros = new URLSearchParams();

  if (filtros.buscar) {
    parametros.set("buscar", filtros.buscar);
  }

  if (filtros.estado && filtros.estado !== "Todos") {
    parametros.set("estado", filtros.estado);
  }

  if (filtros.segmentoId && filtros.segmentoId !== "Todos") {
    parametros.set("segmentoId", filtros.segmentoId);
  }

  const consulta = parametros.toString();

  return solicitar(`/direcciones${consulta ? `?${consulta}` : ""}`);
}

export function obtenerDireccion(id) {
  return solicitar(`/direcciones/${id}`);
}

export function crearDireccion(datos) {
  return solicitar("/direcciones", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function actualizarDireccion(id, datos) {
  return solicitar(`/direcciones/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

export function eliminarDireccion(id) {
  return solicitar(`/direcciones/${id}`, {
    method: "DELETE",
  });
}

export function listarDireccionesSegmento(segmentoId, pagina = 1) {
  return solicitar(
    `/segmentos/${segmentoId}/direcciones?pagina=${pagina}&limite=256`,
  );
}

export function listarUsuarios() {
  return solicitar("/usuarios");
}

export function crearUsuario(datos) {
  return solicitar("/usuarios", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function actualizarUsuario(id, datos) {
  return solicitar(`/usuarios/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

export function cambiarPasswordUsuario(id, password) {
  return solicitar(`/usuarios/${id}/password`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
}

export function eliminarUsuario(id) {
  return solicitar(`/usuarios/${id}`, {
    method: "DELETE",
  });
}

export function listarAuditoria(filtros = {}) {
  const parametros = new URLSearchParams();

  if (filtros.pagina) {
    parametros.set("pagina", filtros.pagina);
  }

  if (filtros.limite) {
    parametros.set("limite", filtros.limite);
  }

  if (filtros.accion) {
    parametros.set("accion", filtros.accion);
  }

  if (filtros.entidad) {
    parametros.set("entidad", filtros.entidad);
  }

  const consulta = parametros.toString();

  return solicitar(`/auditoria${consulta ? `?${consulta}` : ""}`);
}

async function procesarDescarga(respuesta, nombrePredeterminado) {
  if (!respuesta.ok) {
    const contenido = await respuesta.json().catch(() => null);

    if (respuesta.status === 401) {
      cerrarSesion();
    }

    throw new Error(
      contenido?.mensaje ||
        `Error ${respuesta.status}: no fue posible descargar el respaldo.`,
    );
  }

  const archivo = await respuesta.blob();

  if (archivo.size === 0) {
    throw new Error("El servidor devolvió un archivo vacío.");
  }

  const disposicion = respuesta.headers.get("Content-Disposition") || "";

  const coincidencia = disposicion.match(/filename="?([^";]+)"?/i);

  return {
    archivo,
    nombre: coincidencia?.[1] || nombrePredeterminado,
  };
}

export function listarRespaldos() {
  return solicitar("/respaldos");
}
export async function importarRespaldo(archivo) {
  const token = obtenerToken();

  const formulario = new FormData();

  formulario.append("respaldo", archivo);

  const respuesta = await fetch(`${API_URL}/respaldos/importar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formulario,
  });

  const contenido = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      cerrarSesion();
    }

    throw new Error(
      contenido?.mensaje || "No fue posible importar el respaldo.",
    );
  }

  return contenido;
}
export async function crearRespaldoBaseDatos() {
  const token = obtenerToken();

  const respuesta = await fetch(`${API_URL}/respaldos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return procesarDescarga(respuesta, "inventario_ips-respaldo.sql.gz");
}

export async function descargarRespaldo(nombre) {
  const token = obtenerToken();

  const respuesta = await fetch(
    `${API_URL}/respaldos/${encodeURIComponent(nombre)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return procesarDescarga(respuesta, nombre);
}

export function eliminarRespaldo(nombre) {
  return solicitar(`/respaldos/${encodeURIComponent(nombre)}`, {
    method: "DELETE",
  });
}

export function restaurarRespaldo(nombre, confirmacion) {
  return solicitar(`/respaldos/${encodeURIComponent(nombre)}/restaurar`, {
    method: "POST",
    body: JSON.stringify({ confirmacion }),
  });
}

export async function exportarDireccionesCsv(filtros = {}) {
  const parametros = new URLSearchParams();

  if (filtros.buscar) {
    parametros.set("buscar", filtros.buscar);
  }

  if (filtros.estado && filtros.estado !== "Todos") {
    parametros.set("estado", filtros.estado);
  }

  if (filtros.segmentoId && filtros.segmentoId !== "Todos") {
    parametros.set("segmentoId", filtros.segmentoId);
  }

  const consulta = parametros.toString();
  const token = obtenerToken();

  const respuesta = await fetch(
    `${API_URL}/direcciones/exportar/csv${consulta ? `?${consulta}` : ""}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!respuesta.ok) {
    const contenido = await respuesta.json().catch(() => null);

    throw new Error(
      contenido?.mensaje || "No fue posible exportar el inventario.",
    );
  }

  const archivo = await respuesta.blob();
  const disposicion = respuesta.headers.get("Content-Disposition") || "";

  const coincidencia = disposicion.match(/filename="?([^"]+)"?/);

  return {
    archivo,
    nombre: coincidencia?.[1] || "inventario-direcciones.csv",
  };
}

export function importarDireccionesCsv(registros, confirmar = false) {
  return solicitar("/direcciones/importar", {
    method: "POST",
    body: JSON.stringify({
      registros,
      confirmar,
    }),
  });
}
