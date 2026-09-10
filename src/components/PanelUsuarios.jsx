import { useEffect, useState } from "react";
import {
  CirclePlus,
  KeyRound,
  LoaderCircle,
  Pencil,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  actualizarUsuario,
  cambiarPasswordUsuario,
  crearUsuario,
  eliminarUsuario,
  listarUsuarios,
} from "../services/api";

const formularioInicial = {
  nombre: "",
  usuario: "",
  password: "",
  rol: "Consulta",
  activo: true,
};

function PanelUsuarios({ usuarioActual }) {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [error, setError] = useState("");

  async function cargarUsuarios() {
    setCargando(true);
    setError("");

    try {
      setUsuarios(await listarUsuarios());
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarUsuarios();
  }, []);

  function abrirNuevo() {
    setEditandoId(null);
    setFormulario(formularioInicial);
    setError("");
    setModal(true);
  }

  function abrirEditar(usuario) {
    setEditandoId(usuario.id);
    setFormulario({
      nombre: usuario.nombre,
      usuario: usuario.usuario,
      password: "",
      rol: usuario.rol,
      activo: usuario.activo,
    });
    setError("");
    setModal(true);
  }

  function cerrarModal() {
    setModal(false);
    setEditandoId(null);
    setFormulario(formularioInicial);
    setError("");
  }

  function cambiar(evento) {
    const { name, value, type, checked } = evento.target;

    setFormulario((actual) => ({
      ...actual,
      [name]: type === "checkbox" ? checked : value,
    }));

    setError("");
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError("");

    try {
      if (editandoId) {
        await actualizarUsuario(editandoId, {
          nombre: formulario.nombre,
          usuario: formulario.usuario,
          rol: formulario.rol,
          activo: formulario.activo,
        });
      } else {
        await crearUsuario(formulario);
      }

      cerrarModal();
      await cargarUsuarios();
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setGuardando(false);
    }
  }

  async function restablecerPassword(usuario) {
    const password = window.prompt(`Nueva contraseña para ${usuario.usuario}:`);

    if (password === null) return;

    if (password.length < 10) {
      window.alert("La contraseña debe tener al menos 10 caracteres.");
      return;
    }

    try {
      await cambiarPasswordUsuario(usuario.id, password);
      window.alert("Contraseña actualizada correctamente.");
    } catch (errorSolicitud) {
      window.alert(errorSolicitud.message);
    }
  }

  async function borrarUsuario(usuario) {
    if (usuario.id === usuarioActual.id) {
      window.alert("No puedes eliminar tu propia cuenta.");
      return;
    }

    const confirmar = window.confirm(
      `¿Eliminar permanentemente al usuario ${usuario.usuario}?`,
    );

    if (!confirmar) return;

    try {
      await eliminarUsuario(usuario.id);
      await cargarUsuarios();
    } catch (errorSolicitud) {
      window.alert(errorSolicitud.message);
    }
  }

  if (cargando) {
    return (
      <section className="panel">
        <div className="estado-vacio">
          <LoaderCircle className="girando" size={42} />
          <h2>Cargando usuarios</h2>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="encabezado-panel-admin">
          <div>
            <h2>Administración de usuarios</h2>
            <p>Controla el acceso y los permisos del inventario.</p>
          </div>

          <button className="boton-primario" onClick={abrirNuevo}>
            <CirclePlus size={18} />
            Crear usuario
          </button>
        </div>

        {error && (
          <div className="alerta-error alerta-en-panel">
            <span>{error}</span>
          </div>
        )}

        <div className="contenedor-tabla">
          <table>
            <thead>
              <tr>
                <th>Nombre / usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
                <th>Fecha de creación</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td>
                    <strong>{usuario.nombre}</strong>
                    <span className="dato-secundario">
                      @{usuario.usuario}
                      {usuario.id === usuarioActual.id ? " · Tu cuenta" : ""}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`etiqueta-rol ${
                        usuario.rol === "Administrador"
                          ? "rol-administrador"
                          : "rol-consulta"
                      }`}
                    >
                      {usuario.rol === "Administrador" ? (
                        <ShieldCheck size={15} />
                      ) : (
                        <UserRound size={15} />
                      )}
                      {usuario.rol}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`estado ${
                        usuario.activo ? "estado-en-uso" : "estado-inactiva"
                      }`}
                    >
                      {usuario.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>

                  <td>
                    {usuario.ultimoAcceso
                      ? new Date(usuario.ultimoAcceso).toLocaleString("es-MX")
                      : "Nunca"}
                  </td>

                  <td>
                    {new Date(usuario.creadoEn).toLocaleDateString("es-MX")}
                  </td>

                  <td>
                    <div className="acciones">
                      <button
                        className="boton-icono"
                        onClick={() => abrirEditar(usuario)}
                        title="Editar usuario"
                      >
                        <Pencil size={17} />
                      </button>

                      <button
                        className="boton-icono"
                        onClick={() => restablecerPassword(usuario)}
                        title="Cambiar contraseña"
                      >
                        <KeyRound size={17} />
                      </button>
                      {usuario.id !== usuarioActual.id && (
                        <button
                          className="boton-icono peligro"
                          onClick={() => borrarUsuario(usuario)}
                          title="Eliminar usuario"
                          aria-label={`Eliminar a ${usuario.usuario}`}
                        >
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <div className="fondo-modal" onMouseDown={cerrarModal}>
          <section
            className="modal modal-usuario"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="modal-encabezado">
              <div>
                <h2>{editandoId ? "Editar usuario" : "Nuevo usuario"}</h2>
                <p>Define las credenciales y permisos de acceso.</p>
              </div>

              <button
                className="boton-cerrar"
                onClick={cerrarModal}
                type="button"
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={guardar}>
              <div className="cuadricula-formulario">
                <label className="campo-completo">
                  Nombre completo *
                  <input
                    name="nombre"
                    value={formulario.nombre}
                    onChange={cambiar}
                    required
                    autoFocus
                  />
                </label>

                <label>
                  Nombre de usuario *
                  <input
                    name="usuario"
                    value={formulario.usuario}
                    onChange={cambiar}
                    required
                  />
                </label>

                <label>
                  Rol *
                  <select name="rol" value={formulario.rol} onChange={cambiar}>
                    <option>Consulta</option>
                    <option>Administrador</option>
                  </select>
                </label>

                {!editandoId && (
                  <label className="campo-completo">
                    Contraseña *
                    <input
                      name="password"
                      type="password"
                      value={formulario.password}
                      onChange={cambiar}
                      minLength="10"
                      required
                    />
                    <small>Mínimo 10 caracteres.</small>
                  </label>
                )}

                {editandoId && (
                  <label className="campo-completo opcion-activo">
                    <input
                      name="activo"
                      type="checkbox"
                      checked={formulario.activo}
                      onChange={cambiar}
                    />
                    Permitir que este usuario inicie sesión
                  </label>
                )}
              </div>

              {error && <p className="mensaje-error">{error}</p>}

              <div className="modal-acciones">
                <button
                  type="button"
                  className="boton-secundario"
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="boton-primario"
                  disabled={guardando}
                >
                  {guardando && <LoaderCircle className="girando" size={18} />}

                  {guardando
                    ? "Guardando..."
                    : editandoId
                      ? "Guardar cambios"
                      : "Crear usuario"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

export default PanelUsuarios;
