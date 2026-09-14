import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const CityCtx = createContext(null);
export const useCity = () => useContext(CityCtx);

export function CityProvider({ children }) {
  const [cities, setCities] = useState([]);
  const [city, setCityState] = useState(() => localStorage.getItem("zupi_city") || "");

  useEffect(() => {
    api.get("/cities").then((r) => {
      setCities(r.data);
      if (!localStorage.getItem("zupi_city") && r.data.length) {
        const preferred = r.data.find((c) => c.name === "Sertãozinho") || r.data[0];
        localStorage.setItem("zupi_city", preferred.name);
        setCityState(preferred.name);
      }
    }).catch(() => {});
  }, []);

  const setCity = (c) => {
    localStorage.setItem("zupi_city", c);
    setCityState(c);
  };

  return <CityCtx.Provider value={{ city, setCity, cities }}>{children}</CityCtx.Provider>;
}
