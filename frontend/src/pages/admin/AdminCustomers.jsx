import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ADMIN_MENU } from "@/pages/menus";
import { Loading } from "@/components/States";
import { Button } from "@/components/ui/button";
import { api, apiError, fmtDateTime } from "@/lib/api";
import { toast } from "sonner";
import { Ban, CheckCircle } from "lucide-react";

const ROLE_LABEL = { customer: "Cliente", restaurant: "Lojista", admin: "Admin" };

export default function AdminCustomers() {
  const [users, setUsers] = useState(null);
  const [role, setRole] = useState("customer");

  const load = () => api.get("/admin/users", { params: role ? { role } : {} }).then((r) => setUsers(r.data)).catch(() => setUsers([]));
  useEffect(() => { setUsers(null); load(); }, [role]);

  const toggleBlock = async (u) => {
    try {
      const { data } = await api.post(`/admin/users/${u.id}/block`);
      toast.success(data.blocked ? "Usuário bloqueado" : "Usuário desbloqueado");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <DashboardLayout menu={ADMIN_MENU} title="Clientes e usuários" subtitle="Gestão de contas (LGPD: dados mínimos necessários)">
      <div className="flex gap-2 mb-4">
        {["customer", "restaurant", "admin"].map((r) => (
          <button key={r} data-testid={`user-filter-${r}`} onClick={() => setRole(r)} className={`h-9 px-4 rounded-full text-xs font-bold border ${role === r ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-600"}`}>
            {ROLE_LABEL[r]}s
          </button>
        ))}
      </div>
      {!users ? <Loading /> : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]" data-testid="users-table">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b">
                <th className="p-4">Nome</th><th className="p-4">E-mail</th><th className="p-4">Telefone</th><th className="p-4">Cadastro</th><th className="p-4">Status</th><th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0" data-testid={`user-row-${u.email}`}>
                  <td className="p-4 font-bold text-slate-800">{u.name}</td>
                  <td className="p-4 text-slate-600">{u.email}</td>
                  <td className="p-4 text-slate-600">{u.phone || "—"}</td>
                  <td className="p-4 text-slate-500">{fmtDateTime(u.created_at)}</td>
                  <td className="p-4">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${u.blocked ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{u.blocked ? "Bloqueado" : "Ativo"}</span>
                  </td>
                  <td className="p-4 text-right">
                    {u.role !== "admin" && (
                      <Button size="sm" variant="outline" data-testid={`toggle-block-${u.id.slice(0, 8)}`} onClick={() => toggleBlock(u)} className={`rounded-lg h-9 text-xs font-bold ${u.blocked ? "" : "text-red-600 border-red-200"}`}>
                        {u.blocked ? <><CheckCircle className="w-3.5 h-3.5 mr-1" /> Desbloquear</> : <><Ban className="w-3.5 h-3.5 mr-1" /> Bloquear</>}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum usuário.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
