import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Logo from "@/components/Logo";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isMerchant = params.get("tipo") === "restaurante";
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await register({ ...form, role: isMerchant ? "restaurant" : "customer" });
      navigate(user.role === "restaurant" ? "/lojista/configuracoes" : "/");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      <Link to="/" className="mb-8"><Logo /></Link>
      <div className="w-full max-w-sm bg-white rounded-2xl border p-6 shadow-sm" data-testid="register-card">
        <h1 className="font-display font-extrabold text-2xl text-slate-900">
          {isMerchant ? "Cadastre seu restaurante" : "Criar conta"}
        </h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          {isMerchant ? "Apenas R$ 2,00 por pedido. Sem mensalidade." : "Grátis, rápido e sem complicação."}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">{isMerchant ? "Seu nome" : "Nome completo"}</label>
            <Input data-testid="register-name-input" required value={form.name} onChange={set("name")} className="mt-1 h-12 rounded-xl" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">E-mail</label>
            <Input data-testid="register-email-input" type="email" required value={form.email} onChange={set("email")} className="mt-1 h-12 rounded-xl" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Telefone / WhatsApp</label>
            <Input data-testid="register-phone-input" value={form.phone} onChange={set("phone")} className="mt-1 h-12 rounded-xl" placeholder="(16) 99999-0000" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Senha</label>
            <Input data-testid="register-password-input" type="password" required minLength={6} value={form.password} onChange={set("password")} className="mt-1 h-12 rounded-xl" placeholder="Mínimo 6 caracteres" />
          </div>
          {error && <p data-testid="register-error" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <Button data-testid="register-submit-button" disabled={loading} className="w-full h-12 rounded-xl font-bold text-base">
            {loading ? "Criando..." : isMerchant ? "Criar conta de lojista" : "Criar conta"}
          </Button>
        </form>
        <p className="text-sm mt-4 text-center">
          <Link to="/entrar" className="text-orange-600 font-semibold" data-testid="register-login-link">Já tenho conta</Link>
        </p>
      </div>
    </div>
  );
}
