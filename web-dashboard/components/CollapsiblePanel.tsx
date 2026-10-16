"use client";

import React from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

interface CollapsiblePanelProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  tone?: "default" | "primary" | "danger";
}

const toneClasses = {
  default: {
    shell: "border-slate-200 bg-white",
    icon: "bg-slate-100 text-slate-600",
    title: "text-slate-900",
    description: "text-slate-500",
  },
  primary: {
    shell: "border-primary-200 bg-white",
    icon: "bg-primary-50 text-primary-600",
    title: "text-primary-950",
    description: "text-primary-700",
  },
  danger: {
    shell: "border-rose-200 bg-rose-50/40",
    icon: "bg-rose-100 text-rose-700",
    title: "text-rose-900",
    description: "text-rose-700",
  },
} as const;

export default function CollapsiblePanel({
  title,
  description,
  icon: Icon,
  badge,
  children,
  defaultOpen = false,
  className,
  contentClassName,
  tone = "default",
}: CollapsiblePanelProps) {
  const colors = toneClasses[tone];

  return (
    <details
      open={defaultOpen || undefined}
      className={clsx(
        "group min-w-0 overflow-hidden rounded-2xl border shadow-sm sm:rounded-[2rem]",
        colors.shell,
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 outline-none transition-colors hover:bg-slate-50/80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 sm:p-5 md:p-6 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          {Icon ? (
            <span
              className={clsx(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11",
                colors.icon,
              )}
            >
              <Icon size={21} aria-hidden="true" />
            </span>
          ) : null}

          <span className="min-w-0">
            <span className={clsx("block break-words font-black", colors.title)}>
              {title}
            </span>
            {description ? (
              <span
                className={clsx(
                  "mt-1 block break-words text-xs font-medium sm:text-sm",
                  colors.description,
                )}
              >
                {description}
              </span>
            ) : null}
          </span>
        </div>

        <span className="flex shrink-0 items-center gap-2 sm:gap-3">
          {badge}
          <ChevronDown
            size={20}
            aria-hidden="true"
            className="text-slate-400 transition-transform duration-200 group-open:rotate-180"
          />
        </span>
      </summary>

      <div
        className={clsx(
          "min-w-0 border-t border-slate-100 p-4 sm:p-5 md:p-6",
          contentClassName,
        )}
      >
        {children}
      </div>
    </details>
  );
}
