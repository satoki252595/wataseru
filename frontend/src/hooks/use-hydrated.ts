import { useEffect, useState } from "react";
import { useWorks } from "@/lib/wataseru/store";

export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useWorks.persist.onFinishHydration(() => {
      useWorks.getState().ensureDemo();
      setHydrated(true);
    });
    useWorks.persist.rehydrate();
    if (useWorks.persist.hasHydrated()) {
      useWorks.getState().ensureDemo();
      setHydrated(true);
    }
    return () => {
      unsub();
    };
  }, []);
  return hydrated;
}
