import { useEffect } from 'react';
import { getGetMeQueryKey, useGetMe } from '@workspace/api-client-react';
import { useAuth } from '@workspace/replit-auth-web';
import { Loader2, ShieldOff } from 'lucide-react';

const REVOKED_STATUSES = new Set([401, 403]);

function errorStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Blocks the entire CRM for teammates whose access has been revoked
 * (deactivated or removed from the organization). The profile is
 * re-checked periodically and on window focus so a mid-session
 * deactivation kicks the user out instead of showing stale screens.
 */
export function AccessGate({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const { data: me, error, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: (failureCount, err) => {
        const status = errorStatus(err);
        if (status !== undefined && REVOKED_STATUSES.has(status)) return false;
        return failureCount < 2;
      },
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      refetchIntervalInBackground: true,
    },
  });

  const status = errorStatus(error);
  const revoked =
    (status !== undefined && REVOKED_STATUSES.has(status)) ||
    me?.isActive === false;

  useEffect(() => {
    if (!revoked) return;
    const timer = setTimeout(() => logout(), 2500);
    return () => clearTimeout(timer);
  }, [revoked, logout]);

  if (revoked) {
    return (
      <div
        data-testid="access-revoked"
        className="min-h-screen w-full flex items-center justify-center bg-background text-foreground"
      >
        <div className="max-w-md w-full px-8 py-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-6">
            <ShieldOff className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Access revoked</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Your account is no longer active in this organization. You are being
            signed out. Contact an administrator if you believe this is a mistake.
          </p>
          <button
            onClick={logout}
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 h-10 rounded-md font-semibold text-sm transition-colors"
          >
            Sign out now
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
