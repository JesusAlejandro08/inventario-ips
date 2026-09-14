import { useMemo, useState } from "react";

import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import {
  Columns3,
  Filter,
  GitBranch,
  LayoutGrid,
  MapPin,
  Network,
  Orbit,
  Router,
  Search,
  Server,
  TableProperties,
  Waypoints,
  X,
} from "lucide-react";

const COLORES_ESTADO = {
  "En uso": "#2563eb",
  Disponible: "#16a34a",
  Reservada: "#f59e0b",
  Inactiva: "#64748b",
};

const TIPOS_VISTA = [
  { valor: "jerarquica", etiqueta: "Jerárquica", icono: GitBranch },
  { valor: "segmentos", etiqueta: "Por segmentos", icono: LayoutGrid },
  { valor: "mapa", etiqueta: "Mapa de red", icono: Waypoints },
  { valor: "ubicaciones", etiqueta: "Por ubicación", icono: Columns3 },
  { valor: "radial", etiqueta: "Radial", icono: Orbit },
  { valor: "compacta", etiqueta: "Compacta", icono: Network },
  { valor: "tabla", etiqueta: "Tabla de conexiones", icono: TableProperties },
];

function texto(valor) {
  return String(valor ?? "").trim();
}

function idSegmentoDe(direccion) {
  return String(direccion.segmentoId ?? direccion.segmento_id ?? "");
}

function porcentajeSegmento(segmento) {
  const capacidad = Number(segmento.capacidad || 0);
  return capacidad > 0
    ? Math.round((Number(segmento.asignadas || 0) / capacidad) * 100)
    : 0;
}

function colorSegmento(segmento) {
  const porcentaje = porcentajeSegmento(segmento);
  if (porcentaje >= 90) return "#dc2626";
  if (porcentaje >= 80) return "#f59e0b";
  return "#2563eb";
}

function crearIndice(segmentos, direcciones) {
  const porSegmento = new Map();

  segmentos.forEach((segmento) => {
    porSegmento.set(String(segmento.id), []);
  });

  direcciones.forEach((direccion) => {
    const id = idSegmentoDe(direccion);
    if (porSegmento.has(id)) porSegmento.get(id).push(direccion);
  });

  porSegmento.forEach((registros) => {
    registros.sort((a, b) =>
      texto(a.ip).localeCompare(texto(b.ip), undefined, { numeric: true }),
    );
  });

  return porSegmento;
}

function datosNodoUbicacion(ubicacion, cantidadSegmentos) {
  return {
    tipo: "ubicacion",
    ubicacion,
    label: (
      <div className="nodo-topologia ubicacion">
        <MapPin size={18} />
        <div>
          <strong>{ubicacion}</strong>
          <span>
            {cantidadSegmentos}{" "}
            {cantidadSegmentos === 1 ? "segmento" : "segmentos"}
          </span>
        </div>
      </div>
    ),
  };
}

function datosNodoSegmento(segmento, cantidadDirecciones, expandido = null) {
  const porcentaje = porcentajeSegmento(segmento);

  return {
    tipo: "segmento",
    registro: segmento,
    expandido,
    label: (
      <div className="nodo-topologia segmento">
        <div className="nodo-topologia-icono">
          <Network size={19} />
        </div>
        <div>
          <strong>{segmento.nombre}</strong>
          <span>{segmento.cidr}</span>
          <small>
            {segmento.vlan ? `VLAN ${segmento.vlan}` : "Sin VLAN"}
            {" · "}
            {cantidadDirecciones} IP
            {" · "}
            {porcentaje}%
          </small>
          {expandido !== null && (
            <em>{expandido ? "Clic para contraer" : "Clic para ver las IP"}</em>
          )}
        </div>
      </div>
    ),
  };
}

function datosNodoGateway(segmento) {
  return {
    tipo: "gateway",
    segmento,
    label: (
      <div className="nodo-topologia gateway">
        <Router size={18} />
        <div>
          <strong>Gateway</strong>
          <span>{segmento.gateway}</span>
          <small>{segmento.nombre}</small>
        </div>
      </div>
    ),
  };
}

function datosNodoDireccion(direccion) {
  const color = COLORES_ESTADO[direccion.estado] || "#64748b";

  return {
    tipo: "direccion",
    registro: direccion,
    label: (
      <div className="nodo-topologia direccion">
        <div className="nodo-estado-topologia" style={{ background: color }} />
        <Server size={17} />
        <div>
          <strong>{direccion.ip}</strong>
          <span>{direccion.dispositivo || "Sin dispositivo"}</span>
          <small>{direccion.hostname || "Sin hostname"}</small>
        </div>
      </div>
    ),
  };
}

function agregarConexion(conexiones, source, target, color = "#94a3b8") {
  conexiones.push({
    id: `${source}-${target}`,
    source,
    target,
    type: "smoothstep",
    style: { stroke: color, strokeWidth: 1.5 },
  });
}

function agregarNodoDireccion(nodos, conexiones, direccion, posicion, origen) {
  const id = `direccion-${direccion.id}`;
  const color = COLORES_ESTADO[direccion.estado] || "#64748b";

  nodos.push({
    id,
    position: posicion,
    data: datosNodoDireccion(direccion),
    style: { width: 270, borderColor: color },
  });

  agregarConexion(conexiones, origen, id, color);
}

function crearJerarquica(segmentos, direcciones) {
  const nodos = [];
  const conexiones = [];
  const indice = crearIndice(segmentos, direcciones);
  const ubicaciones = [
    ...new Set(segmentos.map((s) => texto(s.ubicacion) || "Sin ubicación")),
  ].sort((a, b) => a.localeCompare(b, "es"));

  let y = 0;

  ubicaciones.forEach((ubicacion, indiceUbicacion) => {
    const segmentosUbicacion = segmentos.filter(
      (segmento) =>
        (texto(segmento.ubicacion) || "Sin ubicación") === ubicacion,
    );
    const idUbicacion = `ubicacion-${indiceUbicacion}`;

    nodos.push({
      id: idUbicacion,
      type: "input",
      position: { x: 0, y },
      data: datosNodoUbicacion(ubicacion, segmentosUbicacion.length),
      style: { width: 250, borderColor: "#7c3aed" },
    });

    let ySegmento = y;
    segmentosUbicacion.forEach((segmento) => {
      const registros = indice.get(String(segmento.id)) || [];
      const idSegmento = `segmento-${segmento.id}`;

      nodos.push({
        id: idSegmento,
        position: { x: 330, y: ySegmento },
        data: datosNodoSegmento(segmento, registros.length),
        style: { width: 285, borderColor: colorSegmento(segmento) },
      });
      agregarConexion(conexiones, idUbicacion, idSegmento);

      let origen = idSegmento;
      let xDirecciones = 680;

      if (texto(segmento.gateway)) {
        const idGateway = `gateway-${segmento.id}`;
        nodos.push({
          id: idGateway,
          position: { x: 680, y: ySegmento },
          data: datosNodoGateway(segmento),
          style: { width: 245, borderColor: "#8b5cf6" },
        });
        agregarConexion(conexiones, idSegmento, idGateway, "#8b5cf6");
        origen = idGateway;
        xDirecciones = 990;
      }

      registros.forEach((direccion, indiceDireccion) => {
        agregarNodoDireccion(
          nodos,
          conexiones,
          direccion,
          { x: xDirecciones, y: ySegmento + indiceDireccion * 92 },
          origen,
        );
      });

      ySegmento += Math.max(registros.length * 92, 135);
    });

    y = ySegmento + 90;
  });

  return { nodos, conexiones };
}

function crearPorSegmentos(segmentos, direcciones) {
  const nodos = [];
  const conexiones = [];
  const indice = crearIndice(segmentos, direcciones);
  const columnas = Math.min(Math.max(segmentos.length, 1), 4);

  segmentos.forEach((segmento, indiceSegmento) => {
    const columna = indiceSegmento % columnas;
    const fila = Math.floor(indiceSegmento / columnas);
    const x = columna * 760;
    const yBase = fila * 900;
    const registros = indice.get(String(segmento.id)) || [];
    const idSegmento = `segmento-${segmento.id}`;

    nodos.push({
      id: idSegmento,
      position: { x, y: yBase },
      data: datosNodoSegmento(segmento, registros.length),
      style: { width: 300, borderColor: colorSegmento(segmento) },
    });

    let inicioY = yBase + 130;
    if (texto(segmento.gateway)) {
      const idGateway = `gateway-${segmento.id}`;
      nodos.push({
        id: idGateway,
        position: { x, y: inicioY },
        data: datosNodoGateway(segmento),
        style: { width: 260, borderColor: "#8b5cf6" },
      });
      agregarConexion(conexiones, idSegmento, idGateway, "#8b5cf6");
      inicioY += 110;
    }

    registros.forEach((direccion, indiceDireccion) => {
      agregarNodoDireccion(
        nodos,
        conexiones,
        direccion,
        {
          x: x + (indiceDireccion % 2) * 330,
          y: inicioY + Math.floor(indiceDireccion / 2) * 105,
        },
        idSegmento,
      );
    });
  });

  return { nodos, conexiones };
}

function crearMapa(segmentos, direcciones) {
  const nodos = [];
  const conexiones = [];
  const indice = crearIndice(segmentos, direcciones);
  const centroX = 900;
  const centroY = 650;

  nodos.push({
    id: "red-principal",
    type: "input",
    position: { x: centroX, y: centroY },
    data: {
      tipo: "red",
      label: (
        <div className="nodo-topologia red-principal">
          <Waypoints size={22} />
          <div>
            <strong>Red corporativa</strong>
            <span>{segmentos.length} segmentos conectados</span>
          </div>
        </div>
      ),
    },
    style: { width: 280, borderColor: "#0f766e" },
  });

  segmentos.forEach((segmento, indiceSegmento) => {
    const angulo =
      (Math.PI * 2 * indiceSegmento) / Math.max(segmentos.length, 1);
    const x = centroX + Math.cos(angulo) * 650;
    const y = centroY + Math.sin(angulo) * 520;
    const registros = indice.get(String(segmento.id)) || [];
    const idGateway = `gateway-${segmento.id}`;
    const idSegmento = `segmento-${segmento.id}`;
    const tieneGateway = texto(segmento.gateway);

    if (tieneGateway) {
      nodos.push({
        id: idGateway,
        position: { x, y },
        data: datosNodoGateway(segmento),
        style: { width: 245, borderColor: "#8b5cf6" },
      });
      agregarConexion(conexiones, "red-principal", idGateway, "#8b5cf6");
    }

    const xSegmento = x + Math.cos(angulo) * 300;
    const ySegmento = y + Math.sin(angulo) * 230;
    nodos.push({
      id: idSegmento,
      position: { x: xSegmento, y: ySegmento },
      data: datosNodoSegmento(segmento, registros.length),
      style: { width: 285, borderColor: colorSegmento(segmento) },
    });
    agregarConexion(
      conexiones,
      tieneGateway ? idGateway : "red-principal",
      idSegmento,
      tieneGateway ? "#8b5cf6" : "#2563eb",
    );

    registros.forEach((direccion, indiceDireccion) => {
      const anguloIp = angulo - 0.5 + indiceDireccion * 0.18;
      agregarNodoDireccion(
        nodos,
        conexiones,
        direccion,
        {
          x: xSegmento + Math.cos(anguloIp) * 430,
          y: ySegmento + Math.sin(anguloIp) * 330,
        },
        idSegmento,
      );
    });
  });

  return { nodos, conexiones };
}

function crearPorUbicaciones(segmentos, direcciones) {
  const nodos = [];
  const conexiones = [];
  const indice = crearIndice(segmentos, direcciones);
  const ubicaciones = [
    ...new Set(segmentos.map((s) => texto(s.ubicacion) || "Sin ubicación")),
  ].sort((a, b) => a.localeCompare(b, "es"));

  ubicaciones.forEach((ubicacion, indiceUbicacion) => {
    const xBase = indiceUbicacion * 760;
    const segmentosUbicacion = segmentos.filter(
      (segmento) =>
        (texto(segmento.ubicacion) || "Sin ubicación") === ubicacion,
    );
    const idUbicacion = `ubicacion-${indiceUbicacion}`;

    nodos.push({
      id: idUbicacion,
      type: "input",
      position: { x: xBase, y: 0 },
      data: datosNodoUbicacion(ubicacion, segmentosUbicacion.length),
      style: { width: 280, borderColor: "#7c3aed" },
    });

    let y = 140;
    segmentosUbicacion.forEach((segmento) => {
      const registros = indice.get(String(segmento.id)) || [];
      const idSegmento = `segmento-${segmento.id}`;
      nodos.push({
        id: idSegmento,
        position: { x: xBase, y },
        data: datosNodoSegmento(segmento, registros.length),
        style: { width: 285, borderColor: colorSegmento(segmento) },
      });
      agregarConexion(conexiones, idUbicacion, idSegmento);

      registros.forEach((direccion, indiceDireccion) => {
        agregarNodoDireccion(
          nodos,
          conexiones,
          direccion,
          { x: xBase + 350, y: y + indiceDireccion * 95 },
          idSegmento,
        );
      });

      y += Math.max(registros.length * 95, 145);
    });
  });

  return { nodos, conexiones };
}

function crearRadial(segmentos, direcciones) {
  const nodos = [];
  const conexiones = [];
  const indice = crearIndice(segmentos, direcciones);
  const ubicaciones = [
    ...new Set(segmentos.map((s) => texto(s.ubicacion) || "Sin ubicación")),
  ];
  const centroGeneral = { x: 900, y: 700 };

  ubicaciones.forEach((ubicacion, indiceUbicacion) => {
    const anguloUbicacion =
      (Math.PI * 2 * indiceUbicacion) / Math.max(ubicaciones.length, 1);
    const centro =
      ubicaciones.length === 1
        ? centroGeneral
        : {
            x: centroGeneral.x + Math.cos(anguloUbicacion) * 900,
            y: centroGeneral.y + Math.sin(anguloUbicacion) * 700,
          };
    const segmentosUbicacion = segmentos.filter(
      (segmento) =>
        (texto(segmento.ubicacion) || "Sin ubicación") === ubicacion,
    );
    const idUbicacion = `ubicacion-${indiceUbicacion}`;

    nodos.push({
      id: idUbicacion,
      type: "input",
      position: centro,
      data: datosNodoUbicacion(ubicacion, segmentosUbicacion.length),
      style: { width: 270, borderColor: "#7c3aed" },
    });

    segmentosUbicacion.forEach((segmento, indiceSegmento) => {
      const angulo =
        (Math.PI * 2 * indiceSegmento) / Math.max(segmentosUbicacion.length, 1);
      const posicionSegmento = {
        x: centro.x + Math.cos(angulo) * 460,
        y: centro.y + Math.sin(angulo) * 360,
      };
      const registros = indice.get(String(segmento.id)) || [];
      const idSegmento = `segmento-${segmento.id}`;

      nodos.push({
        id: idSegmento,
        position: posicionSegmento,
        data: datosNodoSegmento(segmento, registros.length),
        style: { width: 285, borderColor: colorSegmento(segmento) },
      });
      agregarConexion(conexiones, idUbicacion, idSegmento);

      registros.forEach((direccion, indiceDireccion) => {
        const anguloIp = angulo - 0.55 + indiceDireccion * 0.2;
        agregarNodoDireccion(
          nodos,
          conexiones,
          direccion,
          {
            x: posicionSegmento.x + Math.cos(anguloIp) * 430,
            y: posicionSegmento.y + Math.sin(anguloIp) * 340,
          },
          idSegmento,
        );
      });
    });
  });

  return { nodos, conexiones };
}

function crearCompacta(segmentos, direcciones, segmentosExpandidos) {
  const nodos = [];
  const conexiones = [];
  const indice = crearIndice(segmentos, direcciones);
  const ubicaciones = [
    ...new Set(segmentos.map((s) => texto(s.ubicacion) || "Sin ubicación")),
  ].sort((a, b) => a.localeCompare(b, "es"));

  ubicaciones.forEach((ubicacion, indiceUbicacion) => {
    const xBase = indiceUbicacion * 690;
    const segmentosUbicacion = segmentos.filter(
      (segmento) =>
        (texto(segmento.ubicacion) || "Sin ubicación") === ubicacion,
    );
    const idUbicacion = `ubicacion-${indiceUbicacion}`;

    nodos.push({
      id: idUbicacion,
      type: "input",
      position: { x: xBase, y: 0 },
      data: datosNodoUbicacion(ubicacion, segmentosUbicacion.length),
      style: { width: 270, borderColor: "#7c3aed" },
    });

    let y = 135;
    segmentosUbicacion.forEach((segmento) => {
      const registros = indice.get(String(segmento.id)) || [];
      const idSegmento = `segmento-${segmento.id}`;
      const expandido = segmentosExpandidos.has(String(segmento.id));

      nodos.push({
        id: idSegmento,
        position: { x: xBase, y },
        data: datosNodoSegmento(segmento, registros.length, expandido),
        style: { width: 300, borderColor: colorSegmento(segmento) },
      });
      agregarConexion(conexiones, idUbicacion, idSegmento);

      if (expandido) {
        registros.forEach((direccion, indiceDireccion) => {
          agregarNodoDireccion(
            nodos,
            conexiones,
            direccion,
            { x: xBase + 355, y: y + indiceDireccion * 92 },
            idSegmento,
          );
        });
      }

      y += expandido ? Math.max(registros.length * 92, 135) : 135;
    });
  });

  return { nodos, conexiones };
}

function construirTopologia(
  tipoVista,
  segmentos,
  direcciones,
  segmentosExpandidos,
) {
  switch (tipoVista) {
    case "segmentos":
      return crearPorSegmentos(segmentos, direcciones);
    case "mapa":
      return crearMapa(segmentos, direcciones);
    case "ubicaciones":
      return crearPorUbicaciones(segmentos, direcciones);
    case "radial":
      return crearRadial(segmentos, direcciones);
    case "compacta":
      return crearCompacta(segmentos, direcciones, segmentosExpandidos);
    default:
      return crearJerarquica(segmentos, direcciones);
  }
}

function PanelTopologia({ direcciones, segmentos }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroUbicacion, setFiltroUbicacion] = useState("Todas");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [tipoVista, setTipoVista] = useState("compacta");
  const [nodoSeleccionado, setNodoSeleccionado] = useState(null);
  const [segmentosExpandidos, setSegmentosExpandidos] = useState(new Set());

  const ubicaciones = useMemo(
    () =>
      [
        ...new Set(
          segmentos.map(
            (segmento) => texto(segmento.ubicacion) || "Sin ubicación",
          ),
        ),
      ].sort((a, b) => a.localeCompare(b, "es")),
    [segmentos],
  );

  const datosFiltrados = useMemo(() => {
    const consulta = busqueda.trim().toLowerCase();

    const direccionesFiltradas = direcciones.filter((direccion) => {
      const segmento = segmentos.find(
        (elemento) => String(elemento.id) === idSegmentoDe(direccion),
      );
      const ubicacion = texto(segmento?.ubicacion) || "Sin ubicación";
      const coincideEstado =
        filtroEstado === "Todos" || direccion.estado === filtroEstado;
      const coincideUbicacion =
        filtroUbicacion === "Todas" || ubicacion === filtroUbicacion;
      const coincideBusqueda =
        !consulta ||
        [
          direccion.ip,
          direccion.hostname,
          direccion.dispositivo,
          direccion.responsable,
          direccion.estado,
          segmento?.nombre,
          segmento?.cidr,
          segmento?.vlan,
          segmento?.ubicacion,
        ].some((valor) => texto(valor).toLowerCase().includes(consulta));

      return coincideEstado && coincideUbicacion && coincideBusqueda;
    });

    const idsSegmentosConIp = new Set(
      direccionesFiltradas.map((direccion) => idSegmentoDe(direccion)),
    );

    const segmentosFiltrados = segmentos.filter((segmento) => {
      const ubicacion = texto(segmento.ubicacion) || "Sin ubicación";
      const coincideUbicacion =
        filtroUbicacion === "Todas" || ubicacion === filtroUbicacion;
      const coincideBusquedaSegmento =
        !consulta ||
        [
          segmento.nombre,
          segmento.cidr,
          segmento.gateway,
          segmento.vlan,
          segmento.ubicacion,
        ].some((valor) => texto(valor).toLowerCase().includes(consulta));

      if (filtroEstado !== "Todos") {
        return coincideUbicacion && idsSegmentosConIp.has(String(segmento.id));
      }

      if (consulta) {
        return (
          coincideUbicacion &&
          (coincideBusquedaSegmento ||
            idsSegmentosConIp.has(String(segmento.id)))
        );
      }

      return coincideUbicacion;
    });

    const idsVisibles = new Set(
      segmentosFiltrados.map((segmento) => String(segmento.id)),
    );

    return {
      segmentos: segmentosFiltrados,
      direcciones: direccionesFiltradas.filter((direccion) =>
        idsVisibles.has(idSegmentoDe(direccion)),
      ),
    };
  }, [busqueda, filtroEstado, filtroUbicacion, direcciones, segmentos]);

  const topologia = useMemo(
    () =>
      construirTopologia(
        tipoVista,
        datosFiltrados.segmentos,
        datosFiltrados.direcciones,
        segmentosExpandidos,
      ),
    [tipoVista, datosFiltrados, segmentosExpandidos],
  );

  function limpiarFiltros() {
    setBusqueda("");
    setFiltroUbicacion("Todas");
    setFiltroEstado("Todos");
    setNodoSeleccionado(null);
    setSegmentosExpandidos(new Set());
  }

  function seleccionarNodo(_evento, nodo) {
    if (tipoVista === "compacta" && nodo.data.tipo === "segmento") {
      const id = String(nodo.data.registro.id);
      setSegmentosExpandidos((actuales) => {
        const nuevos = new Set(actuales);
        if (nuevos.has(id)) nuevos.delete(id);
        else nuevos.add(id);
        return nuevos;
      });
      setNodoSeleccionado(nodo.data);
      return;
    }

    setNodoSeleccionado(nodo.data);
  }

  const VistaIcono =
    TIPOS_VISTA.find((vista) => vista.valor === tipoVista)?.icono || GitBranch;

  return (
    <section className="topologia">
      <div className="topologia-encabezado">
        <div>
          <h2>Topología de red</h2>
          <p>
            Relación entre ubicaciones, segmentos, gateways y direcciones IP.
          </p>
        </div>

        <div className="topologia-resumen">
          <span>
            <Network size={16} />
            {datosFiltrados.segmentos.length} segmentos
          </span>
          <span>
            <Server size={16} />
            {datosFiltrados.direcciones.length} direcciones
          </span>
        </div>
      </div>

      <section className="panel filtros-topologia filtros-topologia-ampliados">
        <div className="busqueda-topologia">
          <Search size={18} />
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar IP, hostname, equipo, responsable o segmento"
          />
        </div>

        <div className="select-topologia">
          <MapPin size={17} />
          <select
            value={filtroUbicacion}
            onChange={(evento) => setFiltroUbicacion(evento.target.value)}
          >
            <option value="Todas">Todas las ubicaciones</option>
            {ubicaciones.map((ubicacion) => (
              <option key={ubicacion} value={ubicacion}>
                {ubicacion}
              </option>
            ))}
          </select>
        </div>

        <div className="select-topologia">
          <Filter size={17} />
          <select
            value={filtroEstado}
            onChange={(evento) => setFiltroEstado(evento.target.value)}
          >
            <option value="Todos">Todos los estados</option>
            <option value="En uso">En uso</option>
            <option value="Reservada">Reservada</option>
            <option value="Inactiva">Inactiva</option>
            <option value="Disponible">Disponible</option>
          </select>
        </div>

        <div className="select-topologia selector-vista-topologia">
          <VistaIcono size={17} />
          <select
            value={tipoVista}
            onChange={(evento) => {
              setTipoVista(evento.target.value);
              setNodoSeleccionado(null);
            }}
          >
            {TIPOS_VISTA.map((vista) => (
              <option key={vista.valor} value={vista.valor}>
                {vista.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="limpiar-topologia"
          onClick={limpiarFiltros}
        >
          <X size={17} />
          Limpiar
        </button>
      </section>

      {tipoVista === "tabla" ? (
        <TablaConexiones
          segmentos={datosFiltrados.segmentos}
          direcciones={datosFiltrados.direcciones}
          seleccionar={(datos) => setNodoSeleccionado(datos)}
        />
      ) : (
        <div className="contenedor-topologia">
          {topologia.nodos.length === 0 ? (
            <div className="topologia-vacia">
              <Network size={46} />
              <h3>No hay elementos para mostrar</h3>
              <p>Modifica los filtros o registra segmentos de red.</p>
            </div>
          ) : (
            <ReactFlow
              key={`${tipoVista}-${filtroUbicacion}-${filtroEstado}-${busqueda}`}
              nodes={topologia.nodos}
              edges={topologia.conexiones}
              fitView
              fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
              minZoom={0.08}
              maxZoom={1.8}
              nodesConnectable={false}
              nodesDraggable
              elementsSelectable
              onNodeClick={seleccionarNodo}
              onPaneClick={() => setNodoSeleccionado(null)}
            >
              <Controls />
              <MiniMap
                pannable
                zoomable
                nodeColor={(nodo) => {
                  if (nodo.data.tipo === "ubicacion") return "#7c3aed";
                  if (nodo.data.tipo === "segmento")
                    return colorSegmento(nodo.data.registro);
                  if (nodo.data.tipo === "gateway") return "#8b5cf6";
                  if (nodo.data.tipo === "red") return "#0f766e";
                  return (
                    COLORES_ESTADO[nodo.data.registro?.estado] || "#64748b"
                  );
                }}
              />
              <Background color="#d4dfed" gap={22} size={1} />
            </ReactFlow>
          )}

          {nodoSeleccionado && (
            <DetalleNodo
              datos={nodoSeleccionado}
              cerrar={() => setNodoSeleccionado(null)}
            />
          )}
        </div>
      )}

      {tipoVista === "compacta" && (
        <p className="ayuda-topologia">
          Haz clic en un segmento para mostrar u ocultar sus direcciones IP.
        </p>
      )}

      <div className="leyenda-topologia">
        {Object.entries(COLORES_ESTADO).map(([estado, color]) => (
          <span key={estado}>
            <i style={{ background: color }} />
            {estado}
          </span>
        ))}
        <span>
          <Router size={14} />
          Gateway
        </span>
        <span>
          <Network size={14} />
          Segmento
        </span>
      </div>

      {tipoVista === "tabla" && nodoSeleccionado && (
        <DetalleNodo
          datos={nodoSeleccionado}
          cerrar={() => setNodoSeleccionado(null)}
        />
      )}
    </section>
  );
}

function TablaConexiones({ segmentos, direcciones, seleccionar }) {
  const segmentosMap = new Map(
    segmentos.map((segmento) => [String(segmento.id), segmento]),
  );

  if (segmentos.length === 0) {
    return (
      <section className="panel topologia-tabla-vacia">
        <Network size={42} />
        <h3>No hay conexiones para mostrar</h3>
      </section>
    );
  }

  return (
    <section className="panel tabla-conexiones-topologia">
      <div className="contenedor-tabla">
        <table>
          <thead>
            <tr>
              <th>Ubicación</th>
              <th>Segmento</th>
              <th>Gateway</th>
              <th>VLAN</th>
              <th>Dirección IP</th>
              <th>Dispositivo</th>
              <th>Hostname</th>
              <th>Responsable</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {direcciones.length === 0
              ? segmentos.map((segmento) => (
                  <tr
                    key={`segmento-${segmento.id}`}
                    onClick={() =>
                      seleccionar({ tipo: "segmento", registro: segmento })
                    }
                  >
                    <td>{segmento.ubicacion || "Sin ubicación"}</td>
                    <td>
                      <strong>{segmento.nombre}</strong>
                      <small>{segmento.cidr}</small>
                    </td>
                    <td>{segmento.gateway || "Sin gateway"}</td>
                    <td>{segmento.vlan || "Sin VLAN"}</td>
                    <td colSpan="5">Sin direcciones coincidentes</td>
                  </tr>
                ))
              : direcciones.map((direccion) => {
                  const segmento = segmentosMap.get(idSegmentoDe(direccion));
                  return (
                    <tr
                      key={direccion.id}
                      onClick={() =>
                        seleccionar({ tipo: "direccion", registro: direccion })
                      }
                    >
                      <td>
                        {segmento?.ubicacion ||
                          direccion.ubicacion ||
                          "Sin ubicación"}
                      </td>
                      <td>
                        <strong>
                          {segmento?.nombre ||
                            direccion.segmento ||
                            "Sin segmento"}
                        </strong>
                        <small>{segmento?.cidr || direccion.cidr}</small>
                      </td>
                      <td>{segmento?.gateway || "Sin gateway"}</td>
                      <td>{segmento?.vlan || "Sin VLAN"}</td>
                      <td>
                        <strong>{direccion.ip}</strong>
                      </td>
                      <td>{direccion.dispositivo || "Sin dispositivo"}</td>
                      <td>{direccion.hostname || "Sin hostname"}</td>
                      <td>{direccion.responsable || "Sin responsable"}</td>
                      <td>
                        <span
                          className={`estado estado-${texto(direccion.estado).toLowerCase().replaceAll(" ", "-")}`}
                        >
                          {direccion.estado}
                        </span>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DetalleNodo({ datos, cerrar }) {
  const registro = datos.registro;

  return (
    <aside className="detalle-nodo-topologia">
      <div className="detalle-nodo-encabezado">
        <div>
          <span>Detalle</span>
          <strong>
            {datos.tipo === "direccion"
              ? registro.ip
              : datos.tipo === "segmento"
                ? registro.nombre
                : datos.tipo === "gateway"
                  ? "Gateway"
                  : datos.tipo === "red"
                    ? "Red corporativa"
                    : datos.ubicacion}
          </strong>
        </div>
        <button type="button" onClick={cerrar} aria-label="Cerrar detalle">
          <X size={18} />
        </button>
      </div>

      {datos.tipo === "direccion" && (
        <div className="detalle-nodo-lista">
          <Dato etiqueta="IP" valor={registro.ip} />
          <Dato etiqueta="Estado" valor={registro.estado} />
          <Dato etiqueta="Dispositivo" valor={registro.dispositivo} />
          <Dato etiqueta="Hostname" valor={registro.hostname} />
          <Dato etiqueta="Responsable" valor={registro.responsable} />
          <Dato etiqueta="Ubicación" valor={registro.ubicacion} />
          <Dato etiqueta="Segmento" valor={registro.segmento} />
          <Dato etiqueta="Observaciones" valor={registro.observaciones} />
        </div>
      )}

      {datos.tipo === "segmento" && (
        <div className="detalle-nodo-lista">
          <Dato etiqueta="Nombre" valor={registro.nombre} />
          <Dato etiqueta="CIDR" valor={registro.cidr} />
          <Dato etiqueta="VLAN" valor={registro.vlan} />
          <Dato etiqueta="Gateway" valor={registro.gateway} />
          <Dato etiqueta="Ubicación" valor={registro.ubicacion} />
          <Dato etiqueta="Capacidad" valor={registro.capacidad} />
          <Dato etiqueta="Registradas" valor={registro.asignadas} />
          <Dato etiqueta="Disponibles" valor={registro.disponibles} />
          {datos.expandido !== null && datos.expandido !== undefined && (
            <Dato
              etiqueta="Vista compacta"
              valor={datos.expandido ? "Expandido" : "Contraído"}
            />
          )}
        </div>
      )}

      {datos.tipo === "gateway" && (
        <div className="detalle-nodo-lista">
          <Dato etiqueta="Dirección" valor={datos.segmento.gateway} />
          <Dato etiqueta="Segmento" valor={datos.segmento.nombre} />
          <Dato etiqueta="CIDR" valor={datos.segmento.cidr} />
          <Dato etiqueta="Ubicación" valor={datos.segmento.ubicacion} />
        </div>
      )}

      {datos.tipo === "ubicacion" && (
        <div className="detalle-nodo-lista">
          <Dato etiqueta="Ubicación" valor={datos.ubicacion} />
        </div>
      )}

      {datos.tipo === "red" && (
        <div className="detalle-nodo-lista">
          <Dato etiqueta="Elemento" valor="Red corporativa" />
        </div>
      )}
    </aside>
  );
}

function Dato({ etiqueta, valor }) {
  return (
    <div>
      <span>{etiqueta}</span>
      <strong>{texto(valor) || "Sin definir"}</strong>
    </div>
  );
}

export default PanelTopologia;
