import { useEffect, useState } from "react";
import { listarSegmentos } from "./services/api";

function PruebaApi() {
  const [resultado, setResultado] = useState("Consultando API...");

  useEffect(() => {
    listarSegmentos()
      .then((datos) => {
        setResultado(JSON.stringify(datos, null, 2));
      })
      .catch((error) => {
        setResultado(`Error: ${error.message}`);
      });
  }, []);

  return <pre>{resultado}</pre>;
}

export default PruebaApi;
