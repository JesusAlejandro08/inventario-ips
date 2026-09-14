import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CircleCheck,
  Database,
  MapPin,
  Network,
  Server,
} from "lucide-react";

const COLORES_ESTADO = {
  "En uso": "#2563eb",
  Disponible: "#16a34a",
  Reservada: "#f59e0b",
  Inactiva: "#64748b",
};

function porcentaje(valor, total) {
  if (!total) return 0;
  return Math.round((valor / total) * 100);
}

function PanelDashboard({ direcciones, segmentos }) {
  const estadisticas = useMemo(() => {
    const estados = {
      "En uso": 0,
      Disponible: 0,
      Reservada: 0,
      Inactiva: 0,
    };

    for (const direccion of direcciones) {
      if (Object.hasOwn(estados, direccion.estado)) {
        estados[direccion.estado] += 1;
      }
    }

    const ubicacionesMap = new Map();

    for (const direccion of direcciones) {
      const ubicacion =
        direccion.ubicacion?.trim() || "Sin ubicación";

      ubicacionesMap.set(
        ubicacion,
        (ubicacionesMap.get(ubicacion) || 0) + 1,
      );
    }

    const ubicaciones = [...ubicacionesMap.entries()]
      .map(([nombre, cantidad]) => ({
        nombre,
        cantidad,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8);

    const capacidadTotal = segmentos.reduce(
      (total, segmento) =>
        total + Number(segmento.capacidad || 0),
      0,
    );

    const asignadasTotal = segmentos.reduce(
      (total, segmento) =>
        total + Number(segmento.asignadas || 0),
      0,
    );

    const segmentosOrdenados = [...segmentos]
      .map((segmento) => ({
        ...segmento,
        porcentajeUso: porcentaje(
          Number(segmento.asignadas || 0),
          Number(segmento.capacidad || 0),
        ),
      }))
      .sort(
        (a, b) =>
          b.porcentajeUso - a.porcentajeUso,
      );

    return {
      estados,
      ubicaciones,
      capacidadTotal,
      asignadasTotal,
      segmentosOrdenados,
      segmentosAlerta: segmentosOrdenados.filter(
        (segmento) => segmento.porcentajeUso >= 80,
      ),
    };
  }, [direcciones, segmentos]);

  const totalDirecciones = direcciones.length;

  const gradosEnUso =
    porcentaje(
      estadisticas.estados["En uso"],
      totalDirecciones,
    ) * 3.6;

  const gradosDisponibles =
    porcentaje(
      estadisticas.estados.Disponible,
      totalDirecciones,
    ) * 3.6;

  const gradosReservadas =
    porcentaje(
      estadisticas.estados.Reservada,
      totalDirecciones,
    ) * 3.6;

  const finDisponibles =
    gradosEnUso + gradosDisponibles;

  const finReservadas =
    finDisponibles + gradosReservadas;

  const maximoUbicacion = Math.max(
    ...estadisticas.ubicaciones.map(
      (ubicacion) => ubicacion.cantidad,
    ),
    1,
  );

  return (
    <section className="dashboard">
      <div className="dashboard-encabezado">
        <div>
          <h2>Resumen del inventario</h2>
          <p>
            Estado general del direccionamiento de la red.
          </p>
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
            <strong>
              {totalDirecciones.toLocaleString("es-MX")}
            </strong>
          </div>
        </article>

        <article className="indicador-dashboard">
          <div className="indicador-icono morado">
            <Network size={23} />
          </div>

          <div>
            <span>Segmentos de red</span>
            <strong>
              {segmentos.length.toLocaleString("es-MX")}
            </strong>
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
                estadisticas.capacidadTotal -
                  estadisticas.asignadasTotal,
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
              {estadisticas.capacidadTotal.toLocaleString(
                "es-MX",
              )}
            </strong>
          </div>
        </article>
      </div>

      <div className="dashboard-cuadricula">
        <article className="panel grafica-estados">
          <div className="panel-dashboard-titulo">
            <div>
              <h3>Direcciones por estado</h3>
              <p>Distribución de registros almacenados</p>
            </div>
          </div>

          {totalDirecciones === 0 ? (
            <div className="dashboard-sin-datos">
              No existen direcciones registradas.
            </div>
          ) : (
            <div className="contenido-grafica-circular">
              <div
                className="grafica-circular"
                style={{
                  background: `conic-gradient(
                    ${COLORES_ESTADO["En uso"]}
                      0deg ${gradosEnUso}deg,
                    ${COLORES_ESTADO.Disponible}
                      ${gradosEnUso}deg ${finDisponibles}deg,
                    ${COLORES_ESTADO.Reservada}
                      ${finDisponibles}deg ${finReservadas}deg,
                    ${COLORES_ESTADO.Inactiva}
                      ${finReservadas}deg 360deg
                  )`,
                }}
              >
                <div>
                  <strong>{totalDirecciones}</strong>
                  <span>Total</span>
                </div>
              </div>

              <div className="leyenda-grafica">
                {Object.entries(
                  estadisticas.estados,
                ).map(([estado, cantidad]) => (
                  <div key={estado}>
                    <i
                      style={{
                        background:
                          COLORES_ESTADO[estado],
                      }}
                    />

                    <span>{estado}</span>

                    <strong>{cantidad}</strong>

                    <small>
                      {porcentaje(
                        cantidad,
                        totalDirecciones,
                      )}
                      %
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        <article className="panel grafica-ubicaciones">
          <div className="panel-dashboard-titulo">
            <div>
              <h3>Direcciones por ubicación</h3>
              <p>Principales ubicaciones registradas</p>
            </div>

            <MapPin size={21} />
          </div>

          {estadisticas.ubicaciones.length === 0 ? (
            <div className="dashboard-sin-datos">
              No existen ubicaciones para mostrar.
            </div>
          ) : (
            <div className="barras-ubicaciones">
              {estadisticas.ubicaciones.map(
                (ubicacion) => (
                  <div
                    className="fila-barra"
                    key={ubicacion.nombre}
                  >
                    <div className="fila-barra-etiqueta">
                      <span>{ubicacion.nombre}</span>
                      <strong>
                        {ubicacion.cantidad}
                      </strong>
                    </div>

                    <div className="barra-dashboard">
                      <span
                        style={{
                          width: `${
                            (ubicacion.cantidad /
                              maximoUbicacion) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </article>
      </div>

      <article className="panel utilizacion-segmentos">
        <div className="panel-dashboard-titulo">
          <div>
            <h3>Utilización por segmento</h3>
            <p>
              Direcciones asignadas respecto a su
              capacidad utilizable
            </p>
          </div>

          <Network size={21} />
        </div>

        {estadisticas.segmentosOrdenados.length === 0 ? (
          <div className="dashboard-sin-datos">
            No existen segmentos registrados.
          </div>
        ) : (
          <div className="lista-utilizacion">
            {estadisticas.segmentosOrdenados.map(
              (segmento) => (
                <div
                  className="segmento-dashboard"
                  key={segmento.id}
                >
                  <div className="segmento-dashboard-datos">
                    <div>
                      <strong>{segmento.nombre}</strong>
                      <span>{segmento.cidr}</span>
                    </div>

                    <div>
                      <strong>
                        {segmento.porcentajeUso}%
                      </strong>
                      <span>
                        {segmento.asignadas} de{" "}
                        {segmento.capacidad}
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
                        width: `${Math.min(
                          segmento.porcentajeUso,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </article>

      {estadisticas.segmentosAlerta.length > 0 && (
        <article className="alerta-capacidad">
          <AlertTriangle size={23} />

          <div>
            <strong>
              Segmentos próximos a agotarse
            </strong>

            <p>
              {estadisticas.segmentosAlerta
                .map(
                  (segmento) =>
                    `${segmento.nombre} (${segmento.porcentajeUso}%)`,
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
