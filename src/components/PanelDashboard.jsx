import { useMemo, useState } from "react";

import {
  Activity,
  AlertTriangle,
  Building2,
  CircleCheck,
  Database,
  Filter,
  MapPin,
  Network,
  Server,
} from "lucide-react";

const COLORES_ESTADO = {
  "En uso": "#2563eb",
  Disponible: "#16a34a",
  Reservada: "#f59e0b",
  Inactiva: "#64748b",
  "Sin registrar": "#d9e4f2",
};

function porcentajeExacto(valor, total) {
  if (!total) return 0;

  return (valor / total) * 100;
}

function mostrarPorcentaje(valor, total) {
  const resultado = porcentajeExacto(valor, total);

  if (resultado > 0 && resultado < 0.1) {
    return "<0.1%";
  }

  if (resultado > 0 && resultado < 10) {
    return `${resultado.toFixed(1)}%`;
  }

  return `${Math.round(resultado)}%`;
}

function limitarPorcentaje(valor) {
  return Math.min(Math.max(valor, 0), 100);
}

function PanelDashboard({ direcciones, segmentos }) {
  const [segmentoSeleccionado, setSegmentoSeleccionado] = useState("Todos");

  const estadisticas = useMemo(() => {
    const segmentosSeleccionados =
      segmentoSeleccionado === "Todos"
        ? segmentos
        : segmentos.filter(
            (segmento) => String(segmento.id) === segmentoSeleccionado,
          );

    const idsSegmentos = new Set(
      segmentosSeleccionados.map((segmento) => String(segmento.id)),
    );

    const direccionesSeleccionadas =
      segmentoSeleccionado === "Todos"
        ? direcciones
        : direcciones.filter((direccion) =>
            idsSegmentos.has(String(direccion.segmentoId)),
          );

    const estadosRegistrados = {
      "En uso": 0,
      Disponible: 0,
      Reservada: 0,
      Inactiva: 0,
    };

    for (const direccion of direccionesSeleccionadas) {
      if (Object.hasOwn(estadosRegistrados, direccion.estado)) {
        estadosRegistrados[direccion.estado] += 1;
      }
    }

    const capacidadTotal = segmentosSeleccionados.reduce(
      (total, segmento) => total + Number(segmento.capacidad || 0),
      0,
    );

    const asignadasTotal = segmentosSeleccionados.reduce(
      (total, segmento) => total + Number(segmento.asignadas || 0),
      0,
    );

    const sinRegistrar = Math.max(capacidadTotal - asignadasTotal, 0);

    /*
     * La gráfica usa la capacidad real del segmento:
     * direcciones registradas + direcciones sin registrar.
     */
    const estadosCapacidad = {
      ...estadosRegistrados,
      "Sin registrar": sinRegistrar,
    };

    const ubicacionesMap = new Map();

    for (const segmento of segmentos) {
      const ubicacion = segmento.ubicacion?.trim() || "Sin ubicación";

      const datos = ubicacionesMap.get(ubicacion) || {
        segmentos: 0,
        capacidad: 0,
        asignadas: 0,
      };

      datos.segmentos += 1;
      datos.capacidad += Number(segmento.capacidad || 0);
      datos.asignadas += Number(segmento.asignadas || 0);

      ubicacionesMap.set(ubicacion, datos);
    }

    const ubicaciones = [...ubicacionesMap.entries()]
      .map(([nombre, datos]) => ({
        nombre,
        segmentos: datos.segmentos,
        capacidad: datos.capacidad,
        asignadas: datos.asignadas,
        disponibles: Math.max(datos.capacidad - datos.asignadas, 0),
        porcentajeUso: porcentajeExacto(datos.asignadas, datos.capacidad),
      }))
      .sort((a, b) => b.capacidad - a.capacidad)
      .slice(0, 8);

    const segmentosOrdenados = [...segmentos]
      .map((segmento) => ({
        ...segmento,
        porcentajeUso: porcentajeExacto(
          Number(segmento.asignadas || 0),
          Number(segmento.capacidad || 0),
        ),
      }))
      .sort((a, b) => b.porcentajeUso - a.porcentajeUso);

    return {
      segmentosSeleccionados,
      direccionesSeleccionadas,
      estadosRegistrados,
      estadosCapacidad,
      capacidadTotal,
      asignadasTotal,
      sinRegistrar,
      ubicaciones,
      segmentosOrdenados,
      segmentosAlerta: segmentosOrdenados.filter(
        (segmento) => segmento.porcentajeUso >= 80,
      ),
    };
  }, [direcciones, segmentos, segmentoSeleccionado]);

  const segmentoActivo =
    segmentoSeleccionado === "Todos"
      ? null
      : segmentos.find(
          (segmento) => String(segmento.id) === segmentoSeleccionado,
        );

  const totalGrafica = estadisticas.capacidadTotal;

  let gradosAcumulados = 0;

  const segmentosGrafica = Object.entries(estadisticas.estadosCapacidad).map(
    ([estado, cantidad]) => {
      const inicio = gradosAcumulados;

      const grados = porcentajeExacto(cantidad, totalGrafica) * 3.6;

      gradosAcumulados += grados;

      return {
        estado,
        cantidad,
        inicio,
        fin: gradosAcumulados,
        color: COLORES_ESTADO[estado],
      };
    },
  );

  const fondoGrafica =
    totalGrafica > 0
      ? `conic-gradient(${segmentosGrafica
          .map(
            (estado) => `${estado.color} ${estado.inicio}deg ${estado.fin}deg`,
          )
          .join(", ")})`
      : "#e7edf5";

  const maximoCapacidadUbicacion = Math.max(
    ...estadisticas.ubicaciones.map((ubicacion) => ubicacion.capacidad),
    1,
  );

  return (
    <section className="dashboard">
      <div className="dashboard-encabezado">
        <div>
          <h2>Resumen del inventario</h2>

          <p>Estado general del direccionamiento de la red.</p>
        </div>

        <div className="dashboard-actualizacion">
          <Activity size={18} />
          Datos actuales del inventario
        </div>
      </div>

      <div className="dashboard-indicadores">
        <article className="indicador-dashboard">
          <div className="indicador-icono azul">
            <Server size={23} />
          </div>

          <div>
            <span>Direcciones registradas</span>

            <strong>{direcciones.length.toLocaleString("es-MX")}</strong>
          </div>
        </article>

        <article className="indicador-dashboard">
          <div className="indicador-icono morado">
            <Network size={23} />
          </div>

          <div>
            <span>Segmentos de red</span>

            <strong>{segmentos.length.toLocaleString("es-MX")}</strong>
          </div>
        </article>

        <article className="indicador-dashboard">
          <div className="indicador-icono verde">
            <CircleCheck size={23} />
          </div>

          <div>
            <span>Capacidad disponible</span>

            <strong>
              {Math.max(
                segmentos.reduce(
                  (total, segmento) =>
                    total + Number(segmento.disponibles || 0),
                  0,
                ),
                0,
              ).toLocaleString("es-MX")}
            </strong>
          </div>
        </article>

        <article className="indicador-dashboard">
          <div className="indicador-icono naranja">
            <Database size={23} />
          </div>

          <div>
            <span>Capacidad total</span>

            <strong>
              {segmentos
                .reduce(
                  (total, segmento) => total + Number(segmento.capacidad || 0),
                  0,
                )
                .toLocaleString("es-MX")}
            </strong>
          </div>
        </article>
      </div>

      <div className="dashboard-cuadricula">
        <article className="panel grafica-estados">
          <div className="panel-dashboard-titulo panel-dashboard-con-filtro">
            <div>
              <h3>Capacidad por estado</h3>

              <p>Distribución sobre las direcciones asignables</p>
            </div>

            <div className="filtro-dashboard">
              <Filter size={17} />

              <select
                value={segmentoSeleccionado}
                onChange={(evento) =>
                  setSegmentoSeleccionado(evento.target.value)
                }
              >
                <option value="Todos">Todos los segmentos</option>

                {segmentos.map((segmento) => (
                  <option key={segmento.id} value={segmento.id}>
                    {segmento.nombre} — {segmento.cidr} — {segmento.ubicacion}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {segmentoActivo && (
            <div className="segmento-seleccionado-dashboard">
              <Network size={18} />

              <div>
                <strong>{segmentoActivo.nombre}</strong>

                <span>
                  {segmentoActivo.cidr}
                  {segmentoActivo.vlan ? ` · VLAN ${segmentoActivo.vlan}` : ""}
                </span>
              </div>

              <div>
                <MapPin size={16} />
                {segmentoActivo.ubicacion}
              </div>
            </div>
          )}

          {totalGrafica === 0 ? (
            <div className="dashboard-sin-datos">
              No existe capacidad de red para mostrar.
            </div>
          ) : (
            <div className="contenido-grafica-circular">
              <div
                className="grafica-circular"
                style={{
                  background: fondoGrafica,
                }}
              >
                <div>
                  <strong>{totalGrafica.toLocaleString("es-MX")}</strong>

                  <span>Capacidad</span>
                </div>
              </div>

              <div className="leyenda-grafica">
                {segmentosGrafica.map(({ estado, cantidad, color }) => (
                  <div key={estado}>
                    <i
                      style={{
                        background: color,
                      }}
                    />

                    <span>{estado}</span>

                    <strong>{cantidad.toLocaleString("es-MX")}</strong>

                    <small>{mostrarPorcentaje(cantidad, totalGrafica)}</small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        <article className="panel grafica-ubicaciones">
          <div className="panel-dashboard-titulo">
            <div>
              <h3>Capacidad por ubicación</h3>

              <p>Uso de direcciones por cada sede</p>
            </div>

            <Building2 size={21} />
          </div>

          {estadisticas.ubicaciones.length === 0 ? (
            <div className="dashboard-sin-datos">
              No existen ubicaciones para mostrar.
            </div>
          ) : (
            <div className="barras-ubicaciones">
              {estadisticas.ubicaciones.map((ubicacion) => (
                <div
                  className="fila-barra ubicacion-dashboard"
                  key={ubicacion.nombre}
                >
                  <div className="fila-barra-etiqueta">
                    <div>
                      <MapPin size={15} />

                      <span>{ubicacion.nombre}</span>
                    </div>

                    <strong>
                      {ubicacion.asignadas.toLocaleString("es-MX")}
                      {" / "}
                      {ubicacion.capacidad.toLocaleString("es-MX")}
                    </strong>
                  </div>

                  <div className="barra-dashboard">
                    <span
                      style={{
                        width: `${limitarPorcentaje(ubicacion.porcentajeUso)}%`,
                      }}
                    />
                  </div>

                  <div className="detalle-ubicacion-dashboard">
                    <span>
                      {ubicacion.segmentos}{" "}
                      {ubicacion.segmentos === 1 ? "segmento" : "segmentos"}
                    </span>

                    <span>{ubicacion.disponibles} disponibles</span>

                    <strong>
                      {mostrarPorcentaje(
                        ubicacion.asignadas,
                        ubicacion.capacidad,
                      )}{" "}
                      de uso
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <article className="panel utilizacion-segmentos">
        <div className="panel-dashboard-titulo">
          <div>
            <h3>Utilización por segmento</h3>

            <p>Direcciones asignadas respecto a su capacidad utilizable</p>
          </div>

          <Network size={21} />
        </div>

        {estadisticas.segmentosOrdenados.length === 0 ? (
          <div className="dashboard-sin-datos">
            No existen segmentos registrados.
          </div>
        ) : (
          <div className="lista-utilizacion">
            {estadisticas.segmentosOrdenados.map((segmento) => (
              <div className="segmento-dashboard" key={segmento.id}>
                <div className="segmento-dashboard-datos">
                  <div>
                    <strong>{segmento.nombre}</strong>

                    <span>
                      {segmento.cidr}
                      {segmento.vlan ? ` · VLAN ${segmento.vlan}` : ""}
                    </span>

                    <small className="ubicacion-segmento-dashboard">
                      <MapPin size={13} />
                      {segmento.ubicacion}
                    </small>
                  </div>

                  <div>
                    <strong>
                      {mostrarPorcentaje(
                        Number(segmento.asignadas || 0),
                        Number(segmento.capacidad || 0),
                      )}
                    </strong>

                    <span>
                      {Number(segmento.asignadas || 0).toLocaleString("es-MX")}{" "}
                      de{" "}
                      {Number(segmento.capacidad || 0).toLocaleString("es-MX")}
                    </span>
                  </div>
                </div>

                <div
                  className={`barra-segmento-dashboard ${
                    segmento.porcentajeUso >= 90
                      ? "critica"
                      : segmento.porcentajeUso >= 80
                        ? "advertencia"
                        : ""
                  }`}
                >
                  <span
                    style={{
                      width: `${limitarPorcentaje(segmento.porcentajeUso)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      {estadisticas.segmentosAlerta.length > 0 && (
        <article className="alerta-capacidad">
          <AlertTriangle size={23} />

          <div>
            <strong>Segmentos próximos a agotarse</strong>

            <p>
              {estadisticas.segmentosAlerta
                .map(
                  (segmento) =>
                    `${segmento.nombre} — ${segmento.ubicacion} (${mostrarPorcentaje(
                      Number(segmento.asignadas || 0),
                      Number(segmento.capacidad || 0),
                    )})`,
                )
                .join(", ")}
            </p>
          </div>
        </article>
      )}
    </section>
  );
}

export default PanelDashboard;
