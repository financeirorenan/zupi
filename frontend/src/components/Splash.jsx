import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true || new URLSearchParams(window.location.search).get("source") === "pwa";

export default function Splash() {
  const [show, setShow] = useState(() => isStandalone() && !sessionStorage.getItem("zupi_splash"));
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (!show) return;
    sessionStorage.setItem("zupi_splash", "1");
    const a = setTimeout(() => setFade(true), 1300);
    const b = setTimeout(() => setShow(false), 1800);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [show]);

  if (!show) return null;
  return (
    <div data-testid="pwa-splash" className={`fixed inset-0 z-[200] bg-orange-600 flex flex-col items-center justify-center transition-opacity duration-500 ${fade ? "opacity-0" : "opacity-100"}`}>
      <div className="w-24 h-24 rounded-3xl bg-white flex items-center justify-center shadow-2xl splash-pop">
        <Zap className="w-12 h-12 text-orange-600" fill="#FF5722" />
      </div>
      <p className="mt-6 font-display font-extrabold text-4xl text-white splash-rise">Zupi</p>
      <p className="text-xs font-bold tracking-[0.3em] text-orange-100 splash-rise">DELIVERY</p>
    </div>
  );
}
