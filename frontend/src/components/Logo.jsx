import { Zap } from "lucide-react";

export default function Logo({ light = false, small = false }) {
  return (
    <div className="flex items-center gap-2" data-testid="zupi-logo">
      <div className={`${small ? "w-8 h-8" : "w-10 h-10"} rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/30`}>
        <Zap className={`${small ? "w-4 h-4" : "w-5 h-5"} text-white`} fill="white" />
      </div>
      <div className="leading-none">
        <span className={`font-display font-extrabold ${small ? "text-lg" : "text-xl"} ${light ? "text-white" : "text-slate-900"}`}>
          Zupi
        </span>
        <span className={`block text-[10px] font-bold tracking-[0.2em] ${light ? "text-orange-300" : "text-orange-600"}`}>
          DELIVERY
        </span>
      </div>
    </div>
  );
}
