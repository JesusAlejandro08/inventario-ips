import { useEffect, useMemo, useState } from "react";
import Login from "./components/Login";
import PanelUsuarios from "./components/PanelUsuarios";
import PanelAuditoria from "./components/PanelAuditoria";
import PanelRespaldos from "./components/PanelRespaldos";
import ModalImportarCsv from "./components/ModalImportarCsv";
import PanelDashboard from "./components/PanelDashboard";
// import PanelTopologia from "./components/PanelTopologia";
import {
  CirclePlus,
  LoaderCircle,
  LogOut,
  Network,
  Pencil,
  RefreshCw,
  ScrollText,
  Search,
  Server,
  Trash2,
  Users,
  X,
  DatabaseBackup,
  Download,
  Upload,
  CheckCircle2,
  LayoutDashboard,
  Share2,
} from "lucide-react";
import {
  actualizarDireccion,
  actualizarSegmento,
  cerrarSesion,
  crearDireccion,
  crearSegmento,
  eliminarDireccion,
  eliminarSegmento,
  listarDirecciones,
  listarSegmentos,
  obtenerSesion,
  exportarDireccionesCsv,
} from "./services/api";

import DetalleSegmento from "./components/DetalleSegmento";
import "./App.css";

const direccionInicial = {
  segmentoId: "",
  ip: "",
  hostname: "",
  dispositivo: "",
  ubicacion: "",
  responsable: "",
  estado: "Disponible",
  observaciones: "",
};

const segmentoInicial = {
  nombre: "",
  direccionRed: "",
  prefijo: "24",
  gateway: "",
  vlan: "",
  ubicacion: "",
  descripcion: "",
};

function App() {
  const [usuarioSesion, setUsuarioSesion] = useState(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);
  const [vista, setVista] = useState("dashboard");
  const [direcciones, setDirecciones] = useState([]);
  const [segmentos, setSegmentos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroSegmento, setFiltroSegmento] = useState("Todos");
  const [cargando, setCargando] = useState(true);
  const [errorGeneral, setErrorGeneral] = useState("");
  const [exportandoCsv, setExportandoCsv] = useState(false);
  const [modalImportarCsv, setModalImportarCsv] = useState(false);

  const [mensajeGeneral, setMensajeGeneral] = useState("");

  const [modalDireccion, setModalDireccion] = useState(false);
  const [formDireccion, setFormDireccion] = useState(direccionInicial);
  const [direccionEditando, setDireccionEditando] = useState(null);
  const [errorDireccion, setErrorDireccion] = useState("");
  const [guardandoDireccion, setGuardandoDireccion] = useState(false);

  const [modalSegmento, setModalSegmento] = useState(false);
  const [formSegmento, setFormSegmento] = useState(segmentoInicial);
  const [segmentoEditando, setSegmentoEditando] = useState(null);
  const [errorSegmento, setErrorSegmento] = useState("");
  const [guardandoSegmento, setGuardandoSegmento] = useState(false);
  const [segmentoDetalle, setSegmentoDetalle] = useState(null);

  async function cargarDatos() {
    setCargando(true);
    setErrorGeneral("");

    try {
      const [datosDirecciones, datosSegmentos] = await Promise.all([
        listarDirecciones(),
        listarSegmentos(),
      ]);

      setDirecciones(datosDirecciones);
      setSegmentos(datosSegmentos);
    } catch (error) {
      setErrorGeneral(error.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    async function verificarSesion() {
      try {
        const resultado = await obtenerSesion();
        setUsuarioSesion(resultado.usuario);
        await cargarDatos();
      } catch {
        cerrarSesion();
        setUsuarioSesion(null);
      } finally {
        setVerificandoSesion(false);
      }
    }

    verificarSesion();
  }, []);

  const direccionesFiltradas = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();

    return direcciones.filter((registro) => {
      const coincideTexto = [
        registro.ip,
        registro.hostname,
        registro.dispositivo,
        registro.ubicacion,
        registro.responsable,
        registro.segmento,
        registro.cidr,
        registro.vlan,
      ].some((valor) =>
        String(valor ?? "")
          .toLowerCase()
          .includes(texto),
      );

      const coincideEstado =
        filtroEstado === "Todos" || registro.estado === filtroEstado;

      const coincideSegmento =
        filtroSegmento === "Todos" ||
        String(registro.segmentoId) === filtroSegmento;

      return coincideTexto && coincideEstado && coincideSegmento;
    });
  }, [direcciones, busqueda, filtroEstado, filtroSegmento]);

  const segmentosFiltrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();

    return segmentos.filter((segmento) =>
      [
        segmento.nombre,
        segmento.cidr,
        segmento.gateway,
        segmento.vlan,
        segmento.ubicacion,
        segmento.descripcion,
      ].some((valor) =>
        String(valor ?? "")
          .toLowerCase()
          .includes(texto),
      ),
    );
  }, [segmentos, busqueda]);

  const ocupadas = direcciones.filter(
    (registro) => registro.estado === "En uso",
  ).length;

  const disponibles = segmentos.reduce(
    (total, segmento) => total + segmento.disponibles,
    0,
  );

  function cambiarVista(nuevaVista) {
    setVista(nuevaVista);
    setBusqueda("");
    setFiltroEstado("Todos");
    setFiltroSegmento("Todos");
  }

  function abrirNuevaDireccion() {
    setDireccionEditando(null);
    setFormDireccion({
      ...direccionInicial,
      segmentoId: segmentos.length === 1 ? String(segmentos[0].id) : "",
    });
    setErrorDireccion("");
    setModalDireccion(true);
  }

  function abrirEditarDireccion(registro) {
    setDireccionEditando(registro.id);
    setFormDireccion({
      segmentoId: String(registro.segmentoId),
      ip: registro.ip ?? "",
      hostname: registro.hostname ?? "",
      dispositivo: registro.dispositivo ?? "",
      ubicacion: registro.ubicacion ?? "",
      responsable: registro.responsable ?? "",
      estado: registro.estado ?? "Disponible",
      observaciones: registro.observaciones ?? "",
    });
    setErrorDireccion("");
    setModalDireccion(true);
  }

  function cerrarDireccion() {
    setModalDireccion(false);
    setDireccionEditando(null);
    setFormDireccion(direccionInicial);
    setErrorDireccion("");
  }

  async function guardarDireccion(evento) {
    evento.preventDefault();
    setGuardandoDireccion(true);
    setErrorDireccion("");

    try {
      const datos = {
        ...formDireccion,
        segmentoId: Number(formDireccion.segmentoId),
      };

      if (direccionEditando) {
        await actualizarDireccion(direccionEditando, datos);
      } else {
        await crearDireccion(datos);
      }

      cerrarDireccion();
      await cargarDatos();
    } catch (error) {
      setErrorDireccion(error.message);
    } finally {
      setGuardandoDireccion(false);
    }
  }

  async function borrarDireccion(registro) {
    const confirmar = window.confirm(`¿Eliminar la dirección ${registro.ip}?`);

    if (!confirmar) return;

    try {
      await eliminarDireccion(registro.id);
      await cargarDatos();
    } catch (error) {
      setErrorGeneral(error.message);
    }
  }

  function abrirNuevoSegmento() {
    setSegmentoEditando(null);
    setFormSegmento(segmentoInicial);
    setErrorSegmento("");
    setModalSegmento(true);
  }

  function abrirEditarSegmento(segmento) {
    setSegmentoEditando(segmento.id);
    setFormSegmento({
      nombre: segmento.nombre ?? "",
      direccionRed: segmento.direccionRed ?? "",
      prefijo: String(segmento.prefijo ?? 24),
      gateway: segmento.gateway ?? "",
      vlan: segmento.vlan ?? "",
      ubicacion: segmento.ubicacion ?? "",
      descripcion: segmento.descripcion ?? "",
    });
    setErrorSegmento("");
    setModalSegmento(true);
  }

  function cerrarSegmento() {
    setModalSegmento(false);
    setSegmentoEditando(null);
    setFormSegmento(segmentoInicial);
    setErrorSegmento("");
  }

  async function guardarSegmento(evento) {
    evento.preventDefault();
    setGuardandoSegmento(true);
    setErrorSegmento("");

    try {
      const datos = {
        ...formSegmento,
        prefijo: Number(formSegmento.prefijo),
        vlan: formSegmento.vlan === "" ? null : Number(formSegmento.vlan),
      };

      if (segmentoEditando) {
        await actualizarSegmento(segmentoEditando, datos);
      } else {
        await crearSegmento(datos);
      }

      cerrarSegmento();
      await cargarDatos();
    } catch (error) {
      setErrorSegmento(error.message);
    } finally {
      setGuardandoSegmento(false);
    }
  }

  async function borrarSegmento(segmento) {
    const confirmar = window.confirm(`¿Eliminar el segmento ${segmento.cidr}?`);

    if (!confirmar) return;

    try {
      await eliminarSegmento(segmento.id);
      await cargarDatos();
    } catch (error) {
      setErrorGeneral(error.message);
    }
  }

  function asignarDesdeDetalle(ip) {
    setFormDireccion({
      ...direccionInicial,
      segmentoId: String(segmentoDetalle),
      ip,
      estado: "En uso",
    });

    setSegmentoDetalle(null);
    setDireccionEditando(null);
    setErrorDireccion("");
    setModalDireccion(true);
  }
  async function eliminarDesdeDetalle(ip, registro) {
    const confirmar = window.confirm(`¿Eliminar la dirección ${ip}?`);

    if (!confirmar) return;

    try {
      await eliminarDireccion(registro.id);
      setSegmentoDetalle(null);
      await cargarDatos();
    } catch (error) {
      setErrorGeneral(error.message);
    }
  }
  function editarDesdeDetalle(ip, registro) {
    abrirEditarDireccion({
      ...registro,
      ip,
      segmentoId: segmentoDetalle,
    });

    setSegmentoDetalle(null);
  }
  async function exportarCsv() {
    setExportandoCsv(true);
    setErrorGeneral("");

    try {
      const resultado = await exportarDireccionesCsv({
        buscar: busqueda.trim(),
        estado: filtroEstado,
        segmentoId: filtroSegmento,
      });

      if (!resultado.archivo || resultado.archivo.size === 0) {
        throw new Error("El archivo CSV generado está vacío.");
      }

      const url = URL.createObjectURL(resultado.archivo);
      const enlace = document.createElement("a");

      enlace.href = url;
      enlace.download = resultado.nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 2000);
    } catch (error) {
      setErrorGeneral(error.message);
    } finally {
      setExportandoCsv(false);
    }
  }

  async function completarImportacion(mensaje) {
    setModalImportarCsv(false);
    setMensajeGeneral(mensaje);
    await cargarDatos();

    setTimeout(() => {
      setMensajeGeneral("");
    }, 5000);
  }
  async function manejarInicioSesion(usuario) {
    setUsuarioSesion(usuario);
    await cargarDatos();
  }

  function salir() {
    cerrarSesion();
    setUsuarioSesion(null);
    setDirecciones([]);
    setSegmentos([]);
  }

  if (verificandoSesion) {
    return (
      <main className="pagina-cargando">
        <LoaderCircle className="girando" size={42} />
        <p>Verificando sesión...</p>
      </main>
    );
  }

  if (!usuarioSesion) {
    return <Login alIniciarSesion={manejarInicioSesion} />;
  }

  const esAdministrador = usuarioSesion.rol === "Administrador";

  return (
    <main className="aplicacion">
      <header className="encabezado">
        <div className="marca">
          <div className="marca-icono">
            <Server size={25} />
          </div>

          <div>
            <h1>Inventario de direcciones IP</h1>
            <p>Control de direccionamiento de la red corporativa</p>
          </div>
        </div>

        <div className="acciones-encabezado">
          <div className="usuario-sesion">
            <div>
              <strong>{usuarioSesion.nombre}</strong>
              <span>{usuarioSesion.rol}</span>
            </div>

            <button
              type="button"
              onClick={salir}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
          <button
            className="boton-recargar"
            onClick={cargarDatos}
            disabled={cargando}
          >
            <RefreshCw size={18} className={cargando ? "girando" : ""} />
            Actualizar
          </button>

          {esAdministrador &&
            (vista === "direcciones" || vista === "segmentos") && (
              <button
                className="boton-primario"
                onClick={
                  vista === "direcciones"
                    ? abrirNuevaDireccion
                    : abrirNuevoSegmento
                }
              >
                <CirclePlus size={19} />
                {vista === "direcciones"
                  ? "Agregar dirección IP"
                  : "Agregar segmento"}
              </button>
            )}
        </div>
      </header>

      <section className="contenido">
        <nav className="navegacion-inventario">
          <button
            className={vista === "dashboard" ? "activo" : ""}
            onClick={() => cambiarVista("dashboard")}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button
            className={vista === "direcciones" ? "activo" : ""}
            onClick={() => cambiarVista("direcciones")}
          >
            <Server size={18} />
            Direcciones IP
            <span>{direcciones.length}</span>
          </button>

          <button
            className={vista === "segmentos" ? "activo" : ""}
            onClick={() => cambiarVista("segmentos")}
          >
            <Network size={18} />
            Segmentos de red
            <span>{segmentos.length}</span>
          </button>

          {/*
          <button
            className={vista === "topologia" ? "activo" : ""}
            onClick={() => cambiarVista("topologia")}
          >
            <Share2 size={18} />
            Topología
          </button>*/}
          {esAdministrador && (
            <button
              className={vista === "usuarios" ? "activo" : ""}
              onClick={() => cambiarVista("usuarios")}
            >
              <Users size={18} />
              Usuarios
            </button>
          )}

          {esAdministrador && (
            <button
              className={vista === "auditoria" ? "activo" : ""}
              onClick={() => cambiarVista("auditoria")}
            >
              <ScrollText size={18} />
              Auditoría
            </button>
          )}
          {esAdministrador && (
            <button
              className={vista === "respaldos" ? "activo" : ""}
              onClick={() => cambiarVista("respaldos")}
            >
              <DatabaseBackup size={18} />
              Respaldos
            </button>
          )}
        </nav>

        {vista === "dashboard" ? (
          <PanelDashboard direcciones={direcciones} segmentos={segmentos} />
        ) : vista === "usuarios" && esAdministrador ? (
          <PanelUsuarios usuarioActual={usuarioSesion} />
        ) : vista === "auditoria" && esAdministrador ? (
          <PanelAuditoria />
        ) : vista === "respaldos" && esAdministrador ? (
          <PanelRespaldos />
        ) : (
          <>
            {errorGeneral && (
              <div className="alerta-error">
                <span>{errorGeneral}</span>
                <button onClick={() => setErrorGeneral("")}>
                  <X size={18} />
                </button>
              </div>
            )}
            {mensajeGeneral && (
              <div className="mensaje-exito">
                <CheckCircle2 size={19} />
                <span>{mensajeGeneral}</span>
              </div>
            )}
            <div className="estadisticas">
              <article className="tarjeta-estadistica">
                <span>Direcciones registradas</span>
                <strong>{direcciones.length}</strong>
                <small>Registros guardados en MariaDB</small>
              </article>

              <article className="tarjeta-estadistica">
                <span>Direcciones en uso</span>
                <strong>{ocupadas}</strong>
                <small>Equipos actualmente asignados</small>
              </article>

              <article className="tarjeta-estadistica">
                <span>Capacidad disponible</span>
                <strong>{disponibles.toLocaleString("es-MX")}</strong>
                <small>Direcciones utilizables sin registrar</small>
              </article>
            </div>

            <section className="panel">
              <div className="barra-herramientas">
                <div className="campo-busqueda">
                  <Search size={19} />
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(evento) => setBusqueda(evento.target.value)}
                    placeholder={
                      vista === "direcciones"
                        ? "Buscar por IP, equipo, segmento o responsable"
                        : "Buscar por nombre, red, VLAN o ubicación"
                    }
                  />
                </div>

                {vista === "direcciones" && (
                  <div className="grupo-filtros">
                    <select
                      value={filtroSegmento}
                      onChange={(evento) =>
                        setFiltroSegmento(evento.target.value)
                      }
                    >
                      <option value="Todos">Todos los segmentos</option>

                      {segmentos.map((segmento) => (
                        <option key={segmento.id} value={segmento.id}>
                          {segmento.nombre} — {segmento.cidr}
                        </option>
                      ))}
                    </select>

                    <select
                      value={filtroEstado}
                      onChange={(evento) =>
                        setFiltroEstado(evento.target.value)
                      }
                    >
                      <option>Todos</option>
                      <option>En uso</option>
                      <option>Disponible</option>
                      <option>Reservada</option>
                      <option>Inactiva</option>
                    </select>

                    {esAdministrador && (
                      <button
                        type="button"
                        className="boton-importar-csv"
                        onClick={() => {
                          setErrorGeneral("");
                          setMensajeGeneral("");
                          setModalImportarCsv(true);
                        }}
                        disabled={cargando}
                      >
                        <Upload size={18} />
                        Importar CSV
                      </button>
                    )}

                    <button
                      type="button"
                      className="boton-exportar-csv"
                      onClick={exportarCsv}
                      disabled={exportandoCsv || cargando}
                    >
                      {exportandoCsv ? (
                        <LoaderCircle className="girando" size={18} />
                      ) : (
                        <Download size={18} />
                      )}

                      {exportandoCsv ? "Exportando..." : "Exportar CSV"}
                    </button>
                  </div>
                )}
              </div>

              {cargando ? (
                <div className="estado-vacio">
                  <LoaderCircle className="girando" size={42} />
                  <h2>Cargando inventario</h2>
                  <p>Consultando los registros almacenados.</p>
                </div>
              ) : vista === "direcciones" ? (
                <TablaDirecciones
                  registros={direccionesFiltradas}
                  segmentos={segmentos}
                  agregar={abrirNuevaDireccion}
                  editar={abrirEditarDireccion}
                  eliminar={borrarDireccion}
                  puedeEditar={esAdministrador}
                />
              ) : (
                <TablaSegmentos
                  registros={segmentosFiltrados}
                  agregar={abrirNuevoSegmento}
                  editar={abrirEditarSegmento}
                  eliminar={borrarSegmento}
                  ver={(segmento) => setSegmentoDetalle(segmento.id)}
                  puedeEditar={esAdministrador}
                />
              )}
            </section>
          </>
        )}
      </section>

      {modalDireccion && (
        <ModalDireccion
          formulario={formDireccion}
          setFormulario={setFormDireccion}
          segmentos={segmentos}
          editando={direccionEditando}
          error={errorDireccion}
          guardando={guardandoDireccion}
          cerrar={cerrarDireccion}
          guardar={guardarDireccion}
        />
      )}

      {modalSegmento && (
        <ModalSegmento
          formulario={formSegmento}
          setFormulario={setFormSegmento}
          editando={segmentoEditando}
          error={errorSegmento}
          guardando={guardandoSegmento}
          cerrar={cerrarSegmento}
          guardar={guardarSegmento}
        />
      )}
      {segmentoDetalle && (
        <DetalleSegmento
          segmentoId={segmentoDetalle}
          cerrar={() => setSegmentoDetalle(null)}
          asignarDireccion={asignarDesdeDetalle}
          editarDireccion={editarDesdeDetalle}
          eliminarDireccion={eliminarDesdeDetalle}
          puedeAsignar={esAdministrador}
        />
      )}

      {modalImportarCsv && esAdministrador && (
        <ModalImportarCsv
          segmentos={segmentos}
          cerrar={() => setModalImportarCsv(false)}
          alImportar={completarImportacion}
        />
      )}
    </main>
  );
}

function TablaDirecciones({
  registros,
  segmentos,
  agregar,
  editar,
  eliminar,
  puedeEditar,
}) {
  if (registros.length === 0) {
    return (
      <EstadoVacio
        icono={<Server size={42} />}
        titulo="No hay direcciones para mostrar"
        texto={
          segmentos.length === 0
            ? "Primero registra un segmento de red."
            : "Agrega una dirección IP o modifica los filtros."
        }
        boton={puedeEditar && segmentos.length > 0 ? agregar : null}
        etiqueta="Agregar dirección IP"
      />
    );
  }

  return (
    <div className="contenedor-tabla">
      <table>
        <thead>
          <tr>
            <th>Dirección IP</th>
            <th>Hostname / dispositivo</th>
            <th>Segmento</th>
            <th>Ubicación</th>
            <th>Responsable</th>
            <th>Estado</th>
            {puedeEditar && <th>Acciones</th>}
          </tr>
        </thead>

        <tbody>
          {registros.map((registro) => (
            <tr key={registro.id}>
              <td>
                <strong className="direccion-ip">{registro.ip}</strong>
              </td>

              <td>
                <strong>{registro.dispositivo}</strong>
                <span className="dato-secundario">
                  {registro.hostname || "Sin hostname"}
                </span>
              </td>

              <td>
                <strong>{registro.segmento}</strong>
                <span className="dato-secundario">
                  {registro.cidr}
                  {registro.vlan ? ` · VLAN ${registro.vlan}` : ""}
                </span>
              </td>

              <td>{registro.ubicacion}</td>
              <td>{registro.responsable || "Sin asignar"}</td>

              <td>
                <span
                  className={`estado estado-${registro.estado
                    .toLowerCase()
                    .replace(" ", "-")}`}
                >
                  {registro.estado}
                </span>
              </td>

              {puedeEditar && (
                <td>
                  <Acciones
                    editar={() => editar(registro)}
                    eliminar={() => eliminar(registro)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaSegmentos({
  registros,
  agregar,
  editar,
  eliminar,
  ver,
  puedeEditar,
}) {
  if (registros.length === 0) {
    return (
      <EstadoVacio
        icono={<Network size={42} />}
        titulo="No hay segmentos de red"
        texto="Registra el primer segmento para comenzar a asignar direcciones IP."
        boton={puedeEditar ? agregar : null}
        etiqueta="Agregar segmento"
      />
    );
  }

  return (
    <div className="contenedor-tabla">
      <table>
        <thead>
          <tr>
            <th>Nombre / segmento</th>
            <th>Gateway</th>
            <th>VLAN</th>
            <th>Ubicación</th>
            <th>Capacidad</th>
            <th>Disponibles</th>
            <th>Uso</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {registros.map((segmento) => {
            const porcentaje =
              segmento.capacidad > 0
                ? Math.round((segmento.asignadas / segmento.capacidad) * 100)
                : 0;

            return (
              <tr key={segmento.id}>
                <td>
                  <strong>{segmento.nombre}</strong>
                  <span className="dato-secundario direccion-ip">
                    {segmento.cidr}
                  </span>
                </td>

                <td>{segmento.gateway || "—"}</td>
                <td>{segmento.vlan || "—"}</td>
                <td>{segmento.ubicacion}</td>
                <td>{segmento.capacidad.toLocaleString("es-MX")}</td>
                <td>
                  <strong className="texto-disponible">
                    {segmento.disponibles.toLocaleString("es-MX")}
                  </strong>
                </td>

                <td>
                  <div className="uso-segmento">
                    <div>
                      <span style={{ width: `${porcentaje}%` }} />
                    </div>
                    <small>
                      {segmento.asignadas} asignadas · {porcentaje}%
                    </small>
                  </div>
                </td>

                <td>
                  <div className="acciones-segmento">
                    <button
                      type="button"
                      className="boton-ver-direcciones"
                      onClick={() => ver(segmento)}
                    >
                      Ver direcciones
                    </button>

                    {puedeEditar && (
                      <Acciones
                        editar={() => editar(segmento)}
                        eliminar={() => eliminar(segmento)}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Acciones({ editar, eliminar }) {
  return (
    <div className="acciones">
      <button className="boton-icono" onClick={editar} title="Editar">
        <Pencil size={17} />
      </button>

      <button
        className="boton-icono peligro"
        onClick={eliminar}
        title="Eliminar"
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}

function EstadoVacio({ icono, titulo, texto, boton, etiqueta }) {
  return (
    <div className="estado-vacio">
      {icono}
      <h2>{titulo}</h2>
      <p>{texto}</p>

      {boton && (
        <button className="boton-primario" onClick={boton}>
          <CirclePlus size={18} />
          {etiqueta}
        </button>
      )}
    </div>
  );
}

function ModalDireccion({
  formulario,
  setFormulario,
  segmentos,
  editando,
  error,
  guardando,
  cerrar,
  guardar,
}) {
  function cambiar(evento) {
    const { name, value } = evento.target;
    setFormulario((actual) => ({
      ...actual,
      [name]: value,
    }));
  }

  return (
    <FondoModal cerrar={cerrar}>
      <div className="modal-encabezado">
        <div>
          <h2>{editando ? "Editar dirección IP" : "Nueva dirección IP"}</h2>
          <p>La IP debe pertenecer al segmento seleccionado.</p>
        </div>

        <BotonCerrar cerrar={cerrar} />
      </div>

      <form onSubmit={guardar}>
        <div className="cuadricula-formulario">
          <label className="campo-completo">
            Segmento de red *
            <select
              name="segmentoId"
              value={formulario.segmentoId}
              onChange={cambiar}
              required
              autoFocus
            >
              <option value="">Selecciona un segmento</option>

              {segmentos.map((segmento) => (
                <option key={segmento.id} value={segmento.id}>
                  {segmento.nombre} — {segmento.cidr}
                </option>
              ))}
            </select>
          </label>

          <label>
            Dirección IPv4 *
            <input
              name="ip"
              value={formulario.ip}
              onChange={cambiar}
              placeholder="192.168.110.10"
              required
            />
          </label>

          <label>
            Hostname
            <input
              name="hostname"
              value={formulario.hostname}
              onChange={cambiar}
              placeholder="SRV-ARCHIVOS-01"
            />
          </label>

          <label>
            Dispositivo *
            <input
              name="dispositivo"
              value={formulario.dispositivo}
              onChange={cambiar}
              placeholder="Servidor, equipo, impresora..."
              required
            />
          </label>

          <label>
            Ubicación *
            <input
              name="ubicacion"
              value={formulario.ubicacion}
              onChange={cambiar}
              placeholder="Site principal"
              required
            />
          </label>

          <label>
            Responsable
            <input
              name="responsable"
              value={formulario.responsable}
              onChange={cambiar}
              placeholder="Sistemas"
            />
          </label>

          <label>
            Estado
            <select name="estado" value={formulario.estado} onChange={cambiar}>
              <option>Disponible</option>
              <option>En uso</option>
              <option>Reservada</option>
              <option>Inactiva</option>
            </select>
          </label>

          <label className="campo-completo">
            Observaciones
            <textarea
              name="observaciones"
              value={formulario.observaciones}
              onChange={cambiar}
              rows="3"
            />
          </label>
        </div>

        <PieFormulario
          error={error}
          guardando={guardando}
          editando={editando}
          cerrar={cerrar}
          etiqueta="Registrar dirección"
        />
      </form>
    </FondoModal>
  );
}

function ModalSegmento({
  formulario,
  setFormulario,
  editando,
  error,
  guardando,
  cerrar,
  guardar,
}) {
  function cambiar(evento) {
    const { name, value } = evento.target;
    setFormulario((actual) => ({
      ...actual,
      [name]: value,
    }));
  }

  return (
    <FondoModal cerrar={cerrar}>
      <div className="modal-encabezado">
        <div>
          <h2>{editando ? "Editar segmento" : "Nuevo segmento de red"}</h2>
          <p>Define el rango disponible para asignar direcciones.</p>
        </div>

        <BotonCerrar cerrar={cerrar} />
      </div>

      <form onSubmit={guardar}>
        <div className="cuadricula-formulario">
          <label className="campo-completo">
            Nombre del segmento *
            <input
              name="nombre"
              value={formulario.nombre}
              onChange={cambiar}
              placeholder="Servidores"
              required
              autoFocus
            />
          </label>

          <label>
            Dirección de red *
            <input
              name="direccionRed"
              value={formulario.direccionRed}
              onChange={cambiar}
              placeholder="192.168.110.0"
              required
            />
          </label>

          <label>
            Prefijo CIDR *
            <input
              name="prefijo"
              type="number"
              min="0"
              max="32"
              value={formulario.prefijo}
              onChange={cambiar}
              placeholder="24"
              required
            />
          </label>

          <label>
            Gateway
            <input
              name="gateway"
              value={formulario.gateway}
              onChange={cambiar}
              placeholder="192.168.110.1"
            />
          </label>

          <label>
            VLAN
            <input
              name="vlan"
              type="number"
              min="1"
              max="4094"
              value={formulario.vlan}
              onChange={cambiar}
              placeholder="110"
            />
          </label>

          <label className="campo-completo">
            Ubicación *
            <input
              name="ubicacion"
              value={formulario.ubicacion}
              onChange={cambiar}
              placeholder="Site principal"
              required
            />
          </label>

          <label className="campo-completo">
            Descripción
            <textarea
              name="descripcion"
              value={formulario.descripcion}
              onChange={cambiar}
              rows="3"
            />
          </label>
        </div>

        <PieFormulario
          error={error}
          guardando={guardando}
          editando={editando}
          cerrar={cerrar}
          etiqueta="Registrar segmento"
        />
      </form>
    </FondoModal>
  );
}

function FondoModal({ cerrar, children }) {
  return (
    <div className="fondo-modal" onMouseDown={cerrar}>
      <section
        className="modal"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
}

function BotonCerrar({ cerrar }) {
  return (
    <button
      type="button"
      className="boton-cerrar"
      onClick={cerrar}
      aria-label="Cerrar"
    >
      <X size={21} />
    </button>
  );
}

function PieFormulario({ error, guardando, editando, cerrar, etiqueta }) {
  return (
    <>
      {error && <p className="mensaje-error">{error}</p>}

      <div className="modal-acciones">
        <button
          type="button"
          className="boton-secundario"
          onClick={cerrar}
          disabled={guardando}
        >
          Cancelar
        </button>

        <button type="submit" className="boton-primario" disabled={guardando}>
          {guardando && <LoaderCircle className="girando" size={18} />}

          {guardando ? "Guardando..." : editando ? "Guardar cambios" : etiqueta}
        </button>
      </div>
    </>
  );
}

export default App;
