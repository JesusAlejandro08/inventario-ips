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
