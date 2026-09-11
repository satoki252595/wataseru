import { createRootRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";

function Gate() {
  const { me, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/s/");

  useEffect(() => {
    if (loading) return;
    if (!me && !isPublic) {
      void navigate({ to: "/login" });
    }
    if (me && pathname.startsWith("/login")) {
      void navigate({ to: "/" });
    }
  }, [loading, me, isPublic, pathname, navigate]);

  if (loading) {
    return <p className="px-5 py-16 text-sm text-muted">読み込み中…</p>;
  }
  return <Outlet />;
}

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  ),
});
