import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loading } from "@/components/States";

export default function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === null) return <Loading text="Verificando sessão..." />;
  if (!user) return <Navigate to={`/entrar?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
  return children;
}
