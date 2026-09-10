import { useState } from "react";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Server,
  User,
} from "lucide-react";
import { iniciarSesion } from "../services/api";

function Login({ alIniciarSesion }) {
  const [formulario, setFormulario] = useState({
    usuario: "",
    password: "",
  });
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  function cambiar(evento) {
    const { name, value } = evento.target;

    setFormulario((actual) => ({
      ...actual,
      [name]: value,
    }));

    setError("");
  }

  async function enviar(evento) {
    evento.preventDefault();
    setCargando(true);
    setError("");

    try {
      const resultado = await iniciarSesion(formulario);
      alIniciarSesion(resultado.usuario);
    } catch (errorSolicitud) {
      setError(errorSolicitud.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="pagina-login">
      <section className="tarjeta-login">
        <div className="login-marca">
          <div className="login-icono">
            <Server size={28} />
          </div>

          <div>
            <h1>Inventario de direcciones IP</h1>
            <p>Administración de red corporativa</p>
          </div>
        </div>

        <div className="login-encabezado">
          <h2>Iniciar sesión</h2>
          <p>Ingresa tus credenciales para continuar.</p>
        </div>

        <form onSubmit={enviar}>
          <label>
            Usuario
            <div className="campo-login">
              <User size={18} />

              <input
                name="usuario"
                value={formulario.usuario}
                onChange={cambiar}
                autoComplete="username"
                placeholder="Nombre de usuario"
                required
                autoFocus
              />
            </div>
          </label>

          <label>
            Contraseña
            <div className="campo-login">
              <LockKeyhole size={18} />

              <input
                name="password"
                type={mostrarPassword ? "text" : "password"}
                value={formulario.password}
                onChange={cambiar}
                autoComplete="current-password"
                placeholder="Contraseña"
                required
              />

              <button
                type="button"
                onClick={() => setMostrarPassword((actual) => !actual)}
                aria-label={
                  mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
              >
                {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && <p className="mensaje-error">{error}</p>}

          <button
            type="submit"
            className="boton-primario boton-login"
            disabled={cargando}
          >
            {cargando && <LoaderCircle className="girando" size={18} />}

            {cargando ? "Verificando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default Login;
