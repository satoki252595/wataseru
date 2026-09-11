import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useWorks } from "@/lib/wataseru/store";

export function useHydrated() {
  const { me, loading } = useAuth();
  const loaded = useWorks((s) => s.loaded);
  const load = useWorks((s) => s.load);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!me) {
      setReady(true);
      return;
    }
    if (loaded) {
      setReady(true);
      return;
    }
    void load()
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [loading, me, loaded, load]);

  return ready;
}
