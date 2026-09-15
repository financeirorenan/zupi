import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { getPushState, enablePush, disablePush } from "@/lib/push";

export default function PushToggle({ compact = false }) {
  const [state, setState] = useState("loading");
  useEffect(() => { getPushState().then(setState); }, []);

  const toggle = async (on) => {
    try {
      if (on) {
        await enablePush();
        setState("on");
        await api.post("/push/test");
        toast.success("Notificações ativadas neste aparelho");
      } else {
        await disablePush();
        setState("off");
        toast.success("Notificações desativadas");
      }
    } catch (e) {
      setState(await getPushState());
      toast.error(e?.message || apiError(e));
    }
  };

  if (state === "loading") return null;
  if (state === "unsupported") return compact ? null : <p className="text-xs text-slate-400" data-testid="push-unsupported">Este navegador não suporta notificações. No iPhone, adicione o app à tela inicial.</p>;

  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "bg-white rounded-2xl border p-4"}`} data-testid="push-toggle">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${state === "on" ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-400"}`}>
        {state === "on" ? <BellRing className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900">Avisos do pedido no celular</p>
        <p className="text-xs text-slate-500">{state === "denied" ? "Bloqueado nas configurações do navegador" : state === "on" ? "Você recebe uma notificação a cada mudança de status" : "Receba aviso quando o pedido for aceito, sair para entrega etc."}</p>
      </div>
      <Switch data-testid="push-switch" checked={state === "on"} disabled={state === "denied"} onCheckedChange={toggle} />
    </div>
  );
}
