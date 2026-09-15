import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Logo from "@/components/Logo";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      navigate("/entrar");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      <Link to="/app" className="mb-8"><Logo /></Link>
      <div className="w-full max-w-sm bg-white rounded-2xl border p-6 shadow-sm" data-testid="reset-password-card">
        <h1 className="font-display font-extrabold text-2xl text-slate-900">Nova senha</h1>
        <form onSubmit={submit} className="space-y-4 mt-6">
          <div>
            <label className="text-sm font-semibold text-slate-700">Nova senha</label>
            <Input data-testid="reset-password-input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-12 rounded-xl" />
          </div>
          {error && <p data-testid="reset-error" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <Button data-testid="reset-submit-button" disabled={loading || !token} className="w-full h-12 rounded-xl font-bold">
            {loading ? "Salvando..." : "Redefinir senha"}
          </Button>
        </form>
        <p className="text-sm mt-4 text-center">
          <Link to="/entrar" className="text-orange-600 font-semibold">← Voltar ao login</Link>
        </p>
      </div>
    </div>
  );
}
