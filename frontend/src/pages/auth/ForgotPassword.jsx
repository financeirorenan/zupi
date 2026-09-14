import { useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Logo from "@/components/Logo";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      <Link to="/" className="mb-8"><Logo /></Link>
      <div className="w-full max-w-sm bg-white rounded-2xl border p-6 shadow-sm" data-testid="forgot-password-card">
        <h1 className="font-display font-extrabold text-2xl text-slate-900">Recuperar senha</h1>
        {sent ? (
          <p data-testid="forgot-password-success" className="text-sm text-slate-600 mt-4">
            Se o e-mail estiver cadastrado, enviamos um link para redefinir sua senha. Verifique sua caixa de entrada.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4 mt-6">
            <div>
              <label className="text-sm font-semibold text-slate-700">E-mail cadastrado</label>
              <Input data-testid="forgot-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-12 rounded-xl" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <Button data-testid="forgot-submit-button" disabled={loading} className="w-full h-12 rounded-xl font-bold">
              {loading ? "Enviando..." : "Enviar link"}
            </Button>
          </form>
        )}
        <p className="text-sm mt-4 text-center">
          <Link to="/entrar" className="text-orange-600 font-semibold" data-testid="back-to-login">← Voltar ao login</Link>
        </p>
      </div>
    </div>
  );
}
