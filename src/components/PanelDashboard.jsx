import { useMemo, useState } from "react";

import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleCheck,
  Database,
  Filter,
  MapPin,
  Monitor,
  Network,
  Search,
  Server,
  ShieldAlert,
  Tags,
  Trophy,
  UserRoundX,
  UsersRound,
  X,
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

function texto(valor) {
  return String(valor ?? "").trim();
}

function tieneValor(valor) {
  return texto(valor).length > 0;
}

function PanelDashboard({ direcciones, segmentos }) {
  const [segmentoSeleccionado, setSegmentoSeleccionado] = useState("Todos");

  const [busquedaRapida, setBusquedaRapida] = useState("");

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

    /*
     * Dispositivos
     */
    const dispositivosMap = new Map();

    for (const direccion of direccionesSeleccionadas) {
      const dispositivo =
        texto(direccion.dispositivo).toUpperCase() || "SIN DISPOSITIVO";

      dispositivosMap.set(
        dispositivo,
        (dispositivosMap.get(dispositivo) || 0) + 1,
      );
    }

    const dispositivos = [...dispositivosMap.entries()]
      .map(([nombre, cantidad]) => ({
        nombre,
        cantidad,
        porcentaje: porcentajeExacto(cantidad, direccionesSeleccionadas.length),
      }))
      .sort(
        (a, b) =>
          b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, "es"),
      );

    /*
     * Responsables
     */
    const responsablesMap = new Map();

    for (const direccion of direccionesSeleccionadas) {
      const responsable =
        texto(direccion.responsable).toUpperCase() || "SIN RESPONSABLE";

      responsablesMap.set(
        responsable,
        (responsablesMap.get(responsable) || 0) + 1,
      );
    }

    const responsables = [...responsablesMap.entries()]
      .map(([nombre, cantidad]) => ({
        nombre,
        cantidad,
        porcentaje: porcentajeExacto(cantidad, direccionesSeleccionadas.length),
      }))
      .sort(
        (a, b) =>
          b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, "es"),
      );

    /*
     * Estados
     */
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

    const estadosCapacidad = {
      ...estadosRegistrados,
      "Sin registrar": sinRegistrar,
    };

    /*
     * Calidad de información
     */
    const sinHostname = direcciones.filter(
      (direccion) => !tieneValor(direccion.hostname),
    );

    const sinResponsable = direcciones.filter(
      (direccion) => !tieneValor(direccion.responsable),
    );

    const sinUbicacion = direcciones.filter(
      (direccion) => !tieneValor(direccion.ubicacion),
    );

    const sinDispositivo = direcciones.filter(
      (direccion) => !tieneValor(direccion.dispositivo),
    );

    const registrosCompletos = direcciones.filter(
      (direccion) =>
        tieneValor(direccion.hostname) &&
        tieneValor(direccion.responsable) &&
        tieneValor(direccion.ubicacion) &&
        tieneValor(direccion.dispositivo),
    ).length;

    const calidadPorcentaje = porcentajeExacto(
      registrosCompletos,
      direcciones.length,
    );

    /*
     * Alertas
     */
    const segmentosSinGateway = segmentos.filter(
      (segmento) => !tieneValor(segmento.gateway),
    );

    const segmentosSinVlan = segmentos.filter(
      (segmento) => !tieneValor(segmento.vlan),
    );

    const direccionesDisponiblesRegistradas = direcciones.filter(
      (direccion) => direccion.estado === "Disponible",
    );

    /*
     * Ubicaciones
     */
    const ubicacionesMap = new Map();

    for (const segmento of segmentos) {
      const ubicacion = texto(segmento.ubicacion) || "Sin ubicación";

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

    /*
     * Segmentos
     */
    const segmentosOrdenados = [...segmentos]
      .map((segmento) => ({
        ...segmento,
        porcentajeUso: porcentajeExacto(
          Number(segmento.asignadas || 0),
          Number(segmento.capacidad || 0),
        ),
      }))
      .sort((a, b) => b.porcentajeUso - a.porcentajeUso);

    const topSegmentos = segmentosOrdenados
      .filter((segmento) => Number(segmento.capacidad || 0) > 0)
      .slice(0, 5);

    const segmentosAlerta = segmentosOrdenados.filter(
      (segmento) => segmento.porcentajeUso >= 80,
    );

    return {
      segmentosSeleccionados,
      direccionesSeleccionadas,
      dispositivos,
      responsables,
      estadosRegistrados,
      estadosCapacidad,
      capacidadTotal,
      asignadasTotal,
      sinRegistrar,
      ubicaciones,
      segmentosOrdenados,
      topSegmentos,
      segmentosAlerta,
      sinHostname,
      sinResponsable,
      sinUbicacion,
      sinDispositivo,
      registrosCompletos,
      calidadPorcentaje,
      segmentosSinGateway,
      segmentosSinVlan,
      direccionesDisponiblesRegistradas,
    };
  }, [direcciones, segmentos, segmentoSeleccionado]);

  const resultadosBusqueda = useMemo(() => {
    const consulta = busquedaRapida.trim().toLowerCase();

    if (!consulta) {
      return [];
    }

    return direcciones
      .filter((direccion) =>
        [
          direccion.ip,
          direccion.hostname,
          direccion.dispositivo,
          direccion.responsable,
          direccion.ubicacion,
          direccion.segmento,
          direccion.cidr,
        ].some((valor) => texto(valor).toLowerCase().includes(consulta)),
      )
      .slice(0, 8);
  }, [busquedaRapida, direcciones]);

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

  const totalAlertas =
    estadisticas.segmentosAlerta.length +
    estadisticas.sinHostname.length +
    estadisticas.sinResponsable.length +
    estadisticas.segmentosSinGateway.length +
    estadisticas.segmentosSinVlan.length +
    estadisticas.direccionesDisponiblesRegistradas.length;

  const totalEnUso = direcciones.filter(
    (direccion) => direccion.estado === "En uso",
  ).length;

  const totalReservadas = direcciones.filter(
    (direccion) => direccion.estado === "Reservada",
  ).length;

  const totalInactivas = direcciones.filter(
    (direccion) => direccion.estado === "Inactiva",
  ).length;

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

      <div className="dashboard-indicadores dashboard-indicadores-ampliados">
        <Indicador
          titulo="Direcciones registradas"
          valor={direcciones.length}
          clase="azul"
          icono={<Server size={23} />}
        />

        <Indicador
          titulo="Direcciones en uso"
          valor={totalEnUso}
          clase="azul"
          icono={<CircleCheck size={23} />}
        />

        <Indicador
          titulo="Segmentos de red"
          valor={segmentos.length}
          clase="morado"
          icono={<Network size={23} />}
        />

        <Indicador
          titulo="Capacidad disponible"
          valor={segmentos.reduce(
            (total, segmento) => total + Number(segmento.disponibles || 0),
            0,
          )}
          clase="verde"
          icono={<CircleCheck size={23} />}
        />

        <Indicador
          titulo="Capacidad total"
          valor={segmentos.reduce(
            (total, segmento) => total + Number(segmento.capacidad || 0),
            0,
          )}
          clase="naranja"
          icono={<Database size={23} />}
        />

        <Indicador
          titulo="Direcciones reservadas"
          valor={totalReservadas}
          clase="naranja"
          icono={<Tags size={23} />}
        />

        <Indicador
          titulo="Direcciones inactivas"
          valor={totalInactivas}
          clase="gris"
          icono={<ShieldAlert size={23} />}
        />

        <Indicador
          titulo="Segmentos críticos"
          valor={estadisticas.segmentosAlerta.length}
          clase={estadisticas.segmentosAlerta.length > 0 ? "rojo" : "verde"}
          icono={<AlertTriangle size={23} />}
        />
      </div>

      <article className="panel buscador-dashboard">
        <div className="panel-dashboard-titulo">
          <div>
            <h3>Buscar en el inventario</h3>
            <p>Localiza rápidamente una dirección, equipo o responsable</p>
          </div>

          <Search size={21} />
        </div>

        <div className="campo-busqueda-dashboard">
          <Search size={19} />

          <input
            type="search"
            value={busquedaRapida}
            onChange={(evento) => setBusquedaRapida(evento.target.value)}
            placeholder="Buscar por IP, hostname, dispositivo, responsable o segmento"
          />

          {busquedaRapida && (
            <button
              type="button"
              onClick={() => setBusquedaRapida("")}
              aria-label="Limpiar búsqueda"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {busquedaRapida && (
          <div className="resultados-dashboard">
            {resultadosBusqueda.length === 0 ? (
              <div className="dashboard-sin-resultados">
                <Search size={27} />
                <span>No se encontraron coincidencias.</span>
              </div>
            ) : (
              resultadosBusqueda.map((direccion) => (
                <article
                  key={direccion.id}
                  className="resultado-direccion-dashboard"
                >
                  <div className="resultado-ip-dashboard">
                    <strong>{direccion.ip}</strong>

                    <span
                      className={`estado estado-${texto(direccion.estado)
                        .toLowerCase()
                        .replaceAll(" ", "-")}`}
                    >
                      {direccion.estado}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {direccion.dispositivo || "Sin dispositivo"}
                    </strong>
                    <span>{direccion.hostname || "Sin hostname"}</span>
                  </div>

                  <div>
                    <strong>{direccion.segmento || "Sin segmento"}</strong>

                    <span>
                      {direccion.cidr}
                      {direccion.vlan ? ` · VLAN ${direccion.vlan}` : ""}
                    </span>
                  </div>

                  <div>
                    <span className="dato-con-icono-dashboard">
                      <MapPin size={14} />
                      {direccion.ubicacion || "Sin ubicación"}
                    </span>

                    <small>{direccion.responsable || "Sin responsable"}</small>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </article>

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

      <article className="panel dispositivos-dashboard">
        <div className="panel-dashboard-titulo">
          <div>
            <h3>Dispositivos registrados</h3>
            <p>Recuento según el valor registrado en el campo dispositivo</p>
          </div>

          <Monitor size={21} />
        </div>

        <div className="dispositivos-dashboard-resumen">
          <span>
            <strong>{estadisticas.direccionesSeleccionadas.length}</strong>
            registros analizados
          </span>

          <span>
            <strong>{estadisticas.dispositivos.length}</strong>
            tipos diferentes
          </span>
        </div>

        {estadisticas.dispositivos.length === 0 ? (
          <div className="dashboard-sin-datos">
            No existen dispositivos para mostrar.
          </div>
        ) : (
          <div className="lista-dispositivos-dashboard">
            {estadisticas.dispositivos.map((dispositivo, indice) => (
              <div
                className="dispositivo-dashboard-item"
                key={dispositivo.nombre}
              >
                <div className="dispositivo-dashboard-datos">
                  <div>
                    <span className="dispositivo-dashboard-posicion">
                      {indice + 1}
                    </span>

                    <Monitor size={16} />

                    <strong>{dispositivo.nombre}</strong>
                  </div>

                  <div>
                    <strong>
                      {dispositivo.cantidad.toLocaleString("es-MX")}
                    </strong>

                    <span>
                      {mostrarPorcentaje(
                        dispositivo.cantidad,
                        estadisticas.direccionesSeleccionadas.length,
                      )}
                    </span>
                  </div>
                </div>

                <div className="barra-dispositivo-dashboard">
                  <span
                    style={{
                      width: `${limitarPorcentaje(dispositivo.porcentaje)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      <div className="dashboard-cuadricula dashboard-cuadricula-analisis">
        <article className="panel responsables-dashboard">
          <div className="panel-dashboard-titulo">
            <div>
              <h3>Distribución por responsable</h3>
              <p>Direcciones administradas por persona o área</p>
            </div>

            <UsersRound size={21} />
          </div>

          {estadisticas.responsables.length === 0 ? (
            <div className="dashboard-sin-datos">
              No existen responsables para mostrar.
            </div>
          ) : (
            <div className="lista-responsables-dashboard">
              {estadisticas.responsables.map((responsable, indice) => {
                const maximo = estadisticas.responsables[0]?.cantidad || 1;

                return (
                  <div
                    className="responsable-dashboard-item"
                    key={responsable.nombre}
                  >
                    <div className="responsable-dashboard-datos">
                      <div>
                        <span>{indice + 1}</span>
                        <strong>{responsable.nombre}</strong>
                      </div>

                      <div>
                        <strong>
                          {responsable.cantidad.toLocaleString("es-MX")}
                        </strong>

                        <small>
                          {mostrarPorcentaje(
                            responsable.cantidad,
                            estadisticas.direccionesSeleccionadas.length,
                          )}
                        </small>
                      </div>
                    </div>

                    <div className="barra-responsable-dashboard">
                      <span
                        style={{
                          width: `${limitarPorcentaje(
                            porcentajeExacto(responsable.cantidad, maximo),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="panel top-segmentos-dashboard">
          <div className="panel-dashboard-titulo">
            <div>
              <h3>Top 5 de segmentos</h3>
              <p>Segmentos con mayor utilización de direcciones</p>
            </div>

            <Trophy size={21} />
          </div>

          {estadisticas.topSegmentos.length === 0 ? (
            <div className="dashboard-sin-datos">
              No existen segmentos para mostrar.
            </div>
          ) : (
            <div className="lista-top-segmentos">
              {estadisticas.topSegmentos.map((segmento, indice) => (
                <div className="top-segmento-item" key={segmento.id}>
                  <div className="top-segmento-datos">
                    <div>
                      <span
                        className={`top-segmento-posicion posicion-${
                          indice + 1
                        }`}
                      >
                        {indice + 1}
                      </span>

                      <div>
                        <strong>{segmento.nombre}</strong>

                        <small>
                          {segmento.cidr} ·{" "}
                          {segmento.ubicacion || "Sin ubicación"}
                        </small>
                      </div>
                    </div>

                    <div>
                      <strong>
                        {mostrarPorcentaje(
                          Number(segmento.asignadas || 0),
                          Number(segmento.capacidad || 0),
                        )}
                      </strong>

                      <small>
                        {Number(segmento.asignadas || 0).toLocaleString(
                          "es-MX",
                        )}
                        {" / "}
                        {Number(segmento.capacidad || 0).toLocaleString(
                          "es-MX",
                        )}
                      </small>
                    </div>
                  </div>

                  <div
                    className={`barra-top-segmento ${
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
      </div>

      <div className="dashboard-cuadricula dashboard-cuadricula-control">
        <article className="panel calidad-dashboard">
          <div className="panel-dashboard-titulo">
            <div>
              <h3>Calidad del inventario</h3>
              <p>Nivel de información completa en los registros</p>
            </div>

            <CheckCircle2 size={21} />
          </div>

          {direcciones.length === 0 ? (
            <div className="dashboard-sin-datos">
              No existen direcciones registradas.
            </div>
          ) : (
            <>
              <div className="calidad-resumen-dashboard">
                <div
                  className={`calidad-porcentaje ${
                    estadisticas.calidadPorcentaje >= 90
                      ? "excelente"
                      : estadisticas.calidadPorcentaje >= 70
                        ? "aceptable"
                        : "incompleta"
                  }`}
                >
                  <strong>{Math.round(estadisticas.calidadPorcentaje)}%</strong>

                  <span>registros completos</span>
                </div>

                <div className="calidad-datos-dashboard">
                  <strong>
                    {estadisticas.registrosCompletos} de {direcciones.length}
                  </strong>

                  <span>
                    incluyen hostname, dispositivo, ubicación y responsable
                  </span>
                </div>
              </div>

              <div className="barra-calidad-dashboard">
                <span
                  style={{
                    width: `${limitarPorcentaje(
                      estadisticas.calidadPorcentaje,
                    )}%`,
                  }}
                />
              </div>

              <div className="lista-calidad-dashboard">
                <FilaCalidad
                  etiqueta="Sin hostname"
                  cantidad={estadisticas.sinHostname.length}
                />

                <FilaCalidad
                  etiqueta="Sin responsable"
                  cantidad={estadisticas.sinResponsable.length}
                />

                <FilaCalidad
                  etiqueta="Sin ubicación"
                  cantidad={estadisticas.sinUbicacion.length}
                />

                <FilaCalidad
                  etiqueta="Sin dispositivo"
                  cantidad={estadisticas.sinDispositivo.length}
                />
              </div>
            </>
          )}
        </article>

        <article className="panel centro-alertas-dashboard">
          <div className="panel-dashboard-titulo">
            <div>
              <h3>Centro de alertas</h3>
              <p>Situaciones que requieren revisión</p>
            </div>

            <div
              className={`contador-alertas ${
                totalAlertas === 0 ? "sin-alertas" : ""
              }`}
            >
              {totalAlertas}
            </div>
          </div>

          {totalAlertas === 0 ? (
            <div className="dashboard-sin-alertas">
              <CircleCheck size={34} />
              <strong>Inventario sin alertas</strong>

              <span>
                No se detectaron problemas de capacidad o información.
              </span>
            </div>
          ) : (
            <div className="lista-alertas-dashboard">
              <AlertaDashboard
                icono={<AlertTriangle size={18} />}
                titulo="Segmentos próximos a agotarse"
                descripcion="Utilización igual o superior al 80%."
                cantidad={estadisticas.segmentosAlerta.length}
                clase="critica"
              />

              <AlertaDashboard
                icono={<UserRoundX size={18} />}
                titulo="Registros sin responsable"
                descripcion="Direcciones que no tienen un responsable asignado."
                cantidad={estadisticas.sinResponsable.length}
                clase="advertencia"
              />

              <AlertaDashboard
                icono={<Server size={18} />}
                titulo="Registros sin hostname"
                descripcion="Equipos que no tienen nombre de host."
                cantidad={estadisticas.sinHostname.length}
                clase="informativa"
              />

              <AlertaDashboard
                icono={<Network size={18} />}
                titulo="Segmentos sin gateway"
                descripcion="Segmentos que no tienen puerta de enlace definida."
                cantidad={estadisticas.segmentosSinGateway.length}
                clase="advertencia"
              />

              <AlertaDashboard
                icono={<Tags size={18} />}
                titulo="Segmentos sin VLAN"
                descripcion="Segmentos que no tienen identificador VLAN."
                cantidad={estadisticas.segmentosSinVlan.length}
                clase="informativa"
              />

              <AlertaDashboard
                icono={<ShieldAlert size={18} />}
                titulo="IP registradas como disponibles"
                descripcion="Registros almacenados que conservan el estado Disponible."
                cantidad={estadisticas.direccionesDisponiblesRegistradas.length}
                clase="informativa"
              />
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
                      {segmento.ubicacion || "Sin ubicación"}
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
                    `${segmento.nombre} — ${
                      segmento.ubicacion || "Sin ubicación"
                    } (${mostrarPorcentaje(
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

function Indicador({ titulo, valor, clase, icono }) {
  return (
    <article className="indicador-dashboard">
      <div className={`indicador-icono ${clase}`}>{icono}</div>

      <div>
        <span>{titulo}</span>

        <strong>{Number(valor || 0).toLocaleString("es-MX")}</strong>
      </div>
    </article>
  );
}

function FilaCalidad({ etiqueta, cantidad }) {
  return (
    <div className="fila-calidad-dashboard">
      <span>{etiqueta}</span>

      <strong
        className={cantidad > 0 ? "calidad-pendiente" : "calidad-correcta"}
      >
        {cantidad}
      </strong>
    </div>
  );
}

function AlertaDashboard({ icono, titulo, descripcion, cantidad, clase }) {
  return (
    <div
      className={`alerta-dashboard-item ${clase} ${
        cantidad === 0 ? "resuelta" : ""
      }`}
    >
      <div className="alerta-dashboard-icono">
        {cantidad === 0 ? <CheckCircle2 size={18} /> : icono}
      </div>

      <div>
        <strong>{titulo}</strong>
        <span>{descripcion}</span>
      </div>

      <b>{cantidad}</b>
    </div>
  );
}

export default PanelDashboard;
