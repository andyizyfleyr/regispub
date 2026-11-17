import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-hidden rounded-lg border border-line bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({ title, description, action, icon, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 border-b border-line px-5 py-4", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-green-soft text-green [&_svg]:size-[18px]">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-normal text-ink [font-family:var(--font-sans)]">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
