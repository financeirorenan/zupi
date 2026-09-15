import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { api, fmtDateTime } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function NotificationsBell({ light = false, poll = 30000 }) {
  const [data, setData] = useState(null);
  const lastSeen = useRef(null);
  const load = () => api.get("/notifications").then((r) => {
    const newest = r.data.items?.[0];
    if (newest && lastSeen.current && newest.id !== lastSeen.current && !newest.read) {
      toast(newest.title, { description: newest.body, icon: <Bell className="w-4 h-4 text-orange-600" /> });
    }
    if (newest) lastSeen.current = newest.id;
    setData(r.data);
  }).catch(() => {});
  useEffect(() => {
    load();
    if (!poll) return;
    const t = setInterval(load, poll);
    return () => clearInterval(t);
  }, [poll]);
  return (
    <Popover onOpenChange={(o) => o && load()}>
      <PopoverTrigger asChild>
        <button data-testid="notifications-button" className={`relative w-11 h-11 rounded-xl flex items-center justify-center ${light ? "hover:bg-white/10" : "hover:bg-orange-50"}`}>
          <Bell className={`w-5 h-5 ${light ? "text-white" : "text-slate-700"}`} />
          {data?.unread > 0 && (
            <span data-testid="notifications-unread" className="absolute top-1.5 right-1.5 bg-orange-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{data.unread}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-bold text-sm">Notificações</p>
          {data?.unread > 0 && (
            <button data-testid="notifications-read-all" className="text-xs text-orange-600 font-semibold" onClick={() => api.post("/notifications/read-all").then(load)}>
              Marcar lidas
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto" data-testid="notifications-list">
          {!data?.items?.length && <p className="text-sm text-slate-400 text-center py-8">Nenhuma notificação</p>}
          {data?.items?.map((n) => (
            <div key={n.id} className={`px-4 py-3 border-b last:border-0 ${!n.read ? "bg-orange-50/60" : ""}`}>
              <p className="text-sm font-semibold text-slate-800">{n.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
              <p className="text-[10px] text-slate-400 mt-1">{fmtDateTime(n.created_at)}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
