import {
  useMemo,
  useState,
} from "react";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import {
  CircleCheck,
  Filter,
  MapPin,
  Network,
  Router,
  Search,
  Server,
  X,
} from "lucide-react";

const COLORES_ESTADO = {
  "En uso": "#2563eb",
  Disponible: "#16a34a",
  Reservada: "#f59e0b",
  Inactiva: "#64748b",
};

function texto(valor) {
  return String(valor ?? "").trim();
}

function crearTopologia(
  segmentos,
  direcciones,
) {
  const nodos = [];
  const conexiones = [];

  const ubicaciones = [
    ...new Set(
      segmentos.map(
        (segmento) =>
          texto(segmento.ubicacion) ||
          "Sin ubicación",
      ),
    ),
  ].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  const anchoUbicacion = 710;

  ubicaciones.forEach(
    (ubicacion, indiceUbicacion) => {
      const xBase =
        indiceUbicacion *
        anchoUbicacion;

      const idUbicacion =
        `ubicacion-${indiceUbicacion}`;

      nodos.push({
        id: idUbicacion,
        type: "input",
        position: {
          x: xBase,
          y: 0,
        },
        data: {
          tipo: "ubicacion",
          ubicacion,
          label: (
            <div className="nodo-topologia ubicacion">
              <MapPin size={18} />

              <div>
                <strong>
                  {ubicacion}
                </strong>

                <span>
                  Ubicación
                </span>
              </div>
            </div>
          ),
        },
        style: {
          width: 250,
        },
      });

      const segmentosUbicacion =
        segmentos.filter(
          (segmento) =>
            (texto(
              segmento.ubicacion,
            ) || "Sin ubicación") ===
            ubicacion,
        );

      let posicionY = 130;

      segmentosUbicacion.forEach(
        (segmento) => {
          const direccionesSegmento =
            direcciones
              .filter(
                (direccion) =>
                  String(
                    direccion.segmentoId,
                  ) ===
                  String(segmento.id),
              )
              .sort((a, b) =>
                texto(a.ip).localeCompare(
                  texto(b.ip),
                  undefined,
                  {
                    numeric: true,
                  },
                ),
              );

          const idSegmento =
            `segmento-${segmento.id}`;

          const porcentaje =
            Number(
              segmento.capacidad || 0,
            ) > 0
              ? Math.round(
                  (Number(
                    segmento.asignadas ||
                      0,
                  ) /
                    Number(
                      segmento.capacidad ||
                        0,
                    )) *
                    100,
                )
              : 0;

          nodos.push({
            id: idSegmento,
            position: {
              x: xBase,
              y: posicionY,
            },
            data: {
              tipo: "segmento",
              registro: segmento,
              label: (
                <div className="nodo-topologia segmento">
                  <div className="nodo-topologia-icono">
                    <Network size={19} />
                  </div>

                  <div>
                    <strong>
                      {segmento.nombre}
                    </strong>

                    <span>
                      {segmento.cidr}
                    </span>

                    <small>
                      {segmento.vlan
                        ? `VLAN ${segmento.vlan}`
                        : "Sin VLAN"}
                      {" · "}
                      {porcentaje}% de uso
                    </small>
                  </div>
                </div>
              ),
            },
            style: {
              width: 275,
              borderColor:
                porcentaje >= 90
                  ? "#dc2626"
                  : porcentaje >= 80
                    ? "#f59e0b"
                    : "#8eb5ea",
            },
          });

          conexiones.push({
            id: `${idUbicacion}-${idSegmento}`,
            source: idUbicacion,
            target: idSegmento,
            type: "smoothstep",
            animated: false,
            style: {
              stroke: "#94a3b8",
              strokeWidth: 1.5,
            },
          });

          if (
            texto(segmento.gateway)
          ) {
            const idGateway =
              `gateway-${segmento.id}`;

            nodos.push({
              id: idGateway,
              position: {
                x: xBase + 350,
                y: posicionY,
              },
              data: {
                tipo: "gateway",
                segmento,
                label: (
                  <div className="nodo-topologia gateway">
                    <Router size={18} />

                    <div>
                      <strong>
                        Gateway
                      </strong>

                      <span>
                        {segmento.gateway}
                      </span>
                    </div>
                  </div>
                ),
              },
              style: {
                width: 245,
                borderColor:
                  "#8b5cf6",
              },
            });

            conexiones.push({
              id: `${idSegmento}-${idGateway}`,
              source: idSegmento,
              target: idGateway,
              type: "smoothstep",
              style: {
                stroke: "#8b5cf6",
                strokeWidth: 1.5,
              },
            });
          }

          direccionesSegmento.forEach(
            (direccion, indice) => {
              const idDireccion =
                `direccion-${direccion.id}`;

              const color =
                COLORES_ESTADO[
                  direccion.estado
                ] || "#64748b";

              const posicionIpY =
                posicionY +
                (texto(
                  segmento.gateway,
                )
                  ? 90
                  : 0) +
                indice * 100;

              nodos.push({
                id: idDireccion,
                position: {
                  x: xBase + 350,
                  y: posicionIpY,
                },
                data: {
                  tipo: "direccion",
                  registro: direccion,
                  label: (
                    <div className="nodo-topologia direccion">
                      <div
                        className="nodo-estado-topologia"
                        style={{
                          background: color,
                        }}
                      />

                      <Server size={17} />

                      <div>
                        <strong>
                          {direccion.ip}
                        </strong>

                        <span>
                          {direccion.dispositivo ||
                            "Sin dispositivo"}
                        </span>

                        <small>
                          {direccion.hostname ||
                            "Sin hostname"}
                        </small>
                      </div>
                    </div>
                  ),
                },
                style: {
                  width: 270,
                  borderColor: color,
                },
              });

              conexiones.push({
                id: `${idSegmento}-${idDireccion}`,
                source: idSegmento,
                target: idDireccion,
                type: "smoothstep",
                style: {
                  stroke: color,
                  strokeWidth: 1.5,
                },
              });
            },
          );

          const elementosDerecha =
            direccionesSegmento.length +
            (texto(
              segmento.gateway,
            )
              ? 1
              : 0);

          posicionY += Math.max(
            elementosDerecha * 100,
            150,
          );
        },
      );
    },
  );

  return {
    nodos,
    conexiones,
  };
}

function PanelTopologia({
  direcciones,
  segmentos,
}) {
  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    filtroUbicacion,
    setFiltroUbicacion,
  ] = useState("Todas");

  const [
    filtroEstado,
    setFiltroEstado,
  ] = useState("Todos");

  const [
    nodoSeleccionado,
    setNodoSeleccionado,
  ] = useState(null);

  const ubicaciones = useMemo(
    () =>
      [
        ...new Set(
          segmentos.map(
            (segmento) =>
              texto(
                segmento.ubicacion,
              ) || "Sin ubicación",
          ),
        ),
      ].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [segmentos],
  );

  const datosFiltrados =
    useMemo(() => {
      const consulta =
        busqueda
          .trim()
          .toLowerCase();

      const direccionesFiltradas =
        direcciones.filter(
          (direccion) => {
            const coincideEstado =
              filtroEstado ===
                "Todos" ||
              direccion.estado ===
                filtroEstado;

            const segmento =
              segmentos.find(
                (elemento) =>
                  String(elemento.id) ===
                  String(
                    direccion.segmentoId,
                  ),
              );

            const ubicacion =
              texto(
                segmento?.ubicacion,
              ) || "Sin ubicación";

            const coincideUbicacion =
              filtroUbicacion ===
                "Todas" ||
              ubicacion ===
                filtroUbicacion;

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
              ].some((valor) =>
                texto(valor)
                  .toLowerCase()
                  .includes(
                    consulta,
                  ),
              );

            return (
              coincideEstado &&
              coincideUbicacion &&
              coincideBusqueda
            );
          },
        );

      const idsSegmentosConIp =
        new Set(
          direccionesFiltradas.map(
            (direccion) =>
              String(
                direccion.segmentoId,
              ),
          ),
        );

      const segmentosFiltrados =
        segmentos.filter(
          (segmento) => {
            const ubicacion =
              texto(
                segmento.ubicacion,
              ) || "Sin ubicación";

            const coincideUbicacion =
              filtroUbicacion ===
                "Todas" ||
              ubicacion ===
                filtroUbicacion;

            const coincideBusquedaSegmento =
              !consulta ||
              [
                segmento.nombre,
                segmento.cidr,
                segmento.gateway,
                segmento.vlan,
                segmento.ubicacion,
              ].some((valor) =>
                texto(valor)
                  .toLowerCase()
                  .includes(
                    consulta,
                  ),
              );

            /*
             * Cuando se filtra por estado,
             * solamente conserva segmentos
             * con IP coincidentes.
             */
            if (
              filtroEstado !==
              "Todos"
            ) {
              return (
                coincideUbicacion &&
                idsSegmentosConIp.has(
                  String(
                    segmento.id,
                  ),
                )
              );
            }

            /*
             * Al buscar, conserva el segmento
             * si coincide directamente o si
             * alguna IP coincide.
             */
            if (consulta) {
              return (
                coincideUbicacion &&
                (coincideBusquedaSegmento ||
                  idsSegmentosConIp.has(
                    String(
                      segmento.id,
                    ),
                  ))
              );
            }

            return coincideUbicacion;
          },
        );

      const idsSegmentosVisibles =
        new Set(
          segmentosFiltrados.map(
            (segmento) =>
              String(segmento.id),
          ),
        );

      return {
        segmentos:
          segmentosFiltrados,
        direcciones:
          direccionesFiltradas.filter(
            (direccion) =>
              idsSegmentosVisibles.has(
                String(
                  direccion.segmentoId,
                ),
              ),
          ),
      };
    }, [
      busqueda,
      filtroEstado,
      filtroUbicacion,
      direcciones,
      segmentos,
    ]);

  const topologia = useMemo(
    () =>
      crearTopologia(
        datosFiltrados.segmentos,
        datosFiltrados.direcciones,
      ),
    [datosFiltrados],
  );

  function limpiarFiltros() {
    setBusqueda("");
    setFiltroUbicacion("Todas");
    setFiltroEstado("Todos");
    setNodoSeleccionado(null);
  }

  return (
    <section className="topologia">
      <div className="topologia-encabezado">
        <div>
          <h2>
            Topología de red
          </h2>

          <p>
            Relación entre ubicaciones,
            segmentos y direcciones IP
            registradas.
          </p>
        </div>

        <div className="topologia-resumen">
          <span>
            <Network size={16} />
            {
              datosFiltrados
                .segmentos.length
            }{" "}
            segmentos
          </span>

          <span>
            <Server size={16} />
            {
              datosFiltrados
                .direcciones.length
            }{" "}
            direcciones
          </span>
        </div>
      </div>

      <section className="panel filtros-topologia">
        <div className="busqueda-topologia">
          <Search size={18} />

          <input
            type="search"
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(
                evento.target.value,
              )
            }
            placeholder="Buscar IP, hostname, equipo, responsable o segmento"
          />
        </div>

        <div className="select-topologia">
          <MapPin size={17} />

          <select
            value={filtroUbicacion}
            onChange={(evento) =>
              setFiltroUbicacion(
                evento.target.value,
              )
            }
          >
            <option value="Todas">
              Todas las ubicaciones
            </option>

            {ubicaciones.map(
              (ubicacion) => (
                <option
                  key={ubicacion}
                  value={ubicacion}
                >
                  {ubicacion}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="select-topologia">
          <Filter size={17} />

          <select
            value={filtroEstado}
            onChange={(evento) =>
              setFiltroEstado(
                evento.target.value,
              )
            }
          >
            <option value="Todos">
              Todos los estados
            </option>
            <option value="En uso">
              En uso
            </option>
            <option value="Disponible">
              Disponible
            </option>
            <option value="Reservada">
              Reservada
            </option>
            <option value="Inactiva">
              Inactiva
            </option>
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

      <div className="contenedor-topologia">
        {topologia.nodos.length ===
        0 ? (
          <div className="topologia-vacia">
            <Network size={46} />

            <h3>
              No hay elementos para mostrar
            </h3>

            <p>
              Modifica los filtros o registra
              segmentos de red.
            </p>
          </div>
        ) : (
          <ReactFlow
            nodes={topologia.nodos}
            edges={topologia.conexiones}
            fitView
            fitViewOptions={{
              padding: 0.18,
              maxZoom: 1,
            }}
            minZoom={0.15}
            maxZoom={1.8}
            nodesConnectable={false}
            elementsSelectable
            onNodeClick={(
              _evento,
              nodo,
            ) =>
              setNodoSeleccionado(
                nodo.data,
              )
            }
            onPaneClick={() =>
              setNodoSeleccionado(
                null,
              )
            }
          >
            <Controls />

            <MiniMap
              pannable
              zoomable
              nodeColor={(nodo) => {
                if (
                  nodo.data.tipo ===
                  "ubicacion"
                ) {
                  return "#7c3aed";
                }

                if (
                  nodo.data.tipo ===
                  "segmento"
                ) {
                  return "#2563eb";
                }

                if (
                  nodo.data.tipo ===
                  "gateway"
                ) {
                  return "#8b5cf6";
                }

                return (
                  COLORES_ESTADO[
                    nodo.data.registro
                      ?.estado
                  ] || "#64748b"
                );
              }}
            />

            <Background
              color="#d4dfed"
              gap={22}
              size={1}
            />
          </ReactFlow>
        )}

        {nodoSeleccionado && (
          <DetalleNodo
            datos={nodoSeleccionado}
            cerrar={() =>
              setNodoSeleccionado(
                null,
              )
            }
          />
        )}
      </div>

      <div className="leyenda-topologia">
        {Object.entries(
          COLORES_ESTADO,
        ).map(([estado, color]) => (
          <span key={estado}>
            <i
              style={{
                background: color,
              }}
            />
            {estado}
          </span>
        ))}

        <span>
          <Router size={14} />
          Gateway
        </span>
      </div>
    </section>
  );
}

function DetalleNodo({
  datos,
  cerrar,
}) {
  const registro =
    datos.registro;

  return (
    <aside className="detalle-nodo-topologia">
      <div className="detalle-nodo-encabezado">
        <div>
          <span>
            Detalle
          </span>

          <strong>
            {datos.tipo ===
            "direccion"
              ? registro.ip
              : datos.tipo ===
                  "segmento"
                ? registro.nombre
                : datos.tipo ===
                    "gateway"
                  ? "Gateway"
                  : datos.ubicacion}
          </strong>
        </div>

        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar detalle"
        >
          <X size={18} />
        </button>
      </div>

      {datos.tipo ===
        "direccion" && (
        <div className="detalle-nodo-lista">
          <Dato
            etiqueta="IP"
            valor={registro.ip}
          />

          <Dato
            etiqueta="Estado"
            valor={registro.estado}
          />

          <Dato
            etiqueta="Dispositivo"
            valor={
              registro.dispositivo
            }
          />

          <Dato
            etiqueta="Hostname"
            valor={
              registro.hostname
            }
          />

          <Dato
            etiqueta="Responsable"
            valor={
              registro.responsable
            }
          />

          <Dato
            etiqueta="Ubicación"
            valor={
              registro.ubicacion
            }
          />

          <Dato
            etiqueta="Segmento"
            valor={
              registro.segmento
            }
          />

          <Dato
            etiqueta="Observaciones"
            valor={
              registro.observaciones
            }
          />
        </div>
      )}

      {datos.tipo ===
        "segmento" && (
        <div className="detalle-nodo-lista">
          <Dato
            etiqueta="Nombre"
            valor={registro.nombre}
          />

          <Dato
            etiqueta="CIDR"
            valor={registro.cidr}
          />

          <Dato
            etiqueta="VLAN"
            valor={registro.vlan}
          />

          <Dato
            etiqueta="Gateway"
            valor={registro.gateway}
          />

          <Dato
            etiqueta="Ubicación"
            valor={
              registro.ubicacion
            }
          />

          <Dato
            etiqueta="Capacidad"
            valor={
              registro.capacidad
            }
          />

          <Dato
            etiqueta="Registradas"
            valor={
              registro.asignadas
            }
          />

          <Dato
            etiqueta="Disponibles"
            valor={
              registro.disponibles
            }
          />
        </div>
      )}

      {datos.tipo === "gateway" && (
        <div className="detalle-nodo-lista">
          <Dato
            etiqueta="Dirección"
            valor={
              datos.segmento
                .gateway
            }
          />

          <Dato
            etiqueta="Segmento"
            valor={
              datos.segmento.nombre
            }
          />

          <Dato
            etiqueta="CIDR"
            valor={
              datos.segmento.cidr
            }
          />

          <Dato
            etiqueta="Ubicación"
            valor={
              datos.segmento
                .ubicacion
            }
          />
        </div>
      )}
    </aside>
  );
}

function Dato({
  etiqueta,
  valor,
}) {
  return (
    <div>
      <span>{etiqueta}</span>

      <strong>
        {texto(valor) || "Sin definir"}
      </strong>
    </div>
  );
}

export default PanelTopologia;
