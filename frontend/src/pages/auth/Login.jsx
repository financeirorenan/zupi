import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Logo from "@/components/Logo";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      const next = params.get("next");
      if (user.role === "restaurant") navigate(next?.startsWith("/lojista") ? next : "/lojista");
      else if (next) navigate(next);
      else if (user.role === "admin") navigate("/admin");
      else navigate("/");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      <Link to="/" className="mb-8"><Logo /></Link>
      <div className="w-full max-w-sm bg-white rounded-2xl border p-6 shadow-sm" data-testid="login-card">
        <h1 className="font-display font-extrabold text-2xl text-slate-900">Entrar</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">Peça dos restaurantes que você conhece.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">E-mail</label>
            <Input data-testid="login-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-12 rounded-xl" placeholder="voce@email.com" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Senha</label>
            <Input data-testid="login-password-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-12 rounded-xl" placeholder="••••••" />
          </div>
          {error && <p data-testid="login-error" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <Button data-testid="login-submit-button" disabled={loading} className="w-full h-12 rounded-xl font-bold text-base">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <div className="flex justify-between mt-4 text-sm">
          <Link to="/esqueci-senha" data-testid="forgot-password-link" className="text-orange-600 font-semibold">Esqueci a senha</Link>
          <Link to="/cadastrar" data-testid="register-link" className="text-slate-600 font-semibold">Criar conta</Link>
        </div>
      </div>
      <Link to="/" className="mt-6 text-sm text-slate-400">← Voltar ao início</Link>
    </div>
  );
}
