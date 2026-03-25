"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";

import { Switch } from "@/components/ui/switch";

export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = useMemo(() => {
    if (!mounted) return false;
    return resolvedTheme === "dark";
  }, [mounted, resolvedTheme]);

  return (
    <Switch
      checked={isDark}
      onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
      aria-label="Activer le mode sombre"
    />
  );
}
