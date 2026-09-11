import { useEffect, useState } from "react";

export function InstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone));
    if (standalone) return;
    if (sessionStorage.getItem("wataseru-hide-install") === "1") return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <p className="mt-20 text-sm text-subtle">
      <a href="/?install=1" className="hover:text-fg">
        ホーム画面に置く
      </a>
      <span className="mx-2">·</span>
      <button
        type="button"
        className="text-subtle hover:text-fg"
        onClick={() => {
          sessionStorage.setItem("wataseru-hide-install", "1");
          setVisible(false);
        }}
      >
        閉じる
      </button>
    </p>
  );
}
