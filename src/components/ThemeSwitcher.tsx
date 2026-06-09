"use client";

import { Button } from "@heroui/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme, theme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={compact ? "h-9 w-24" : "h-10 w-56"} />;
  }

  const activeTheme = theme === "system" ? resolvedTheme : theme;

  if (compact) {
    return (
      <Button
        size="sm"
        variant="secondary"
        onPress={() => setTheme(activeTheme === "dark" ? "light" : "dark")}
      >
        {activeTheme === "dark" ? "Light" : "Dark"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-default bg-surface p-1">
      <Button
        size="sm"
        variant={activeTheme === "light" ? "primary" : "ghost"}
        onPress={() => setTheme("light")}
      >
        Light
      </Button>
      <Button
        size="sm"
        variant={activeTheme === "dark" ? "primary" : "ghost"}
        onPress={() => setTheme("dark")}
      >
        Dark
      </Button>
      <Button
        size="sm"
        variant={theme === "system" ? "primary" : "ghost"}
        onPress={() => setTheme("system")}
      >
        System
      </Button>
    </div>
  );
}
