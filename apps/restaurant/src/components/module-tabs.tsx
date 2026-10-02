"use client";

import { cn } from "cn";

type TabItem<T extends string> = {
  id: T;
  label: string;
};

/**
 * Pestañas accesibles (role=tablist) para módulos ops.
 */
export function ModuleTabs<T extends string>({
  tabs,
  value,
  onChange,
  label = "Secciones",
}: {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-4 border-b border-border text-sm"
    >
      {tabs.map((t) => {
        const selected = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              const idx = tabs.findIndex((x) => x.id === t.id);
              if (e.key === "ArrowRight") {
                e.preventDefault();
                const next = tabs[(idx + 1) % tabs.length];
                onChange(next.id);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
                onChange(prev.id);
              }
            }}
            className={cn(
              "border-b-2 pb-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2",
              selected
                ? "border-miel font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function ModuleTabPanel({
  id,
  active,
  labelledBy,
  children,
  className,
}: {
  id: string;
  active: boolean;
  labelledBy: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!active) return null;
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${labelledBy}`}
      className={className}
    >
      {children}
    </div>
  );
}
