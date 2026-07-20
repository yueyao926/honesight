import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    // 记住用户原本想去的页面，登录后回跳，避免丢失操作意图
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
