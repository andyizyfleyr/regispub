import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-md border border-[var(--field-line)] bg-[var(--field-bg)] px-3.5 text-[0.9375rem] text-ink sm:px-4 placeholder:text-muted/60 transition-[border-color,box-shadow,background-color] hover:border-line-strong focus:border-green focus:bg-surface focus:outline-none focus:ring-4 focus:ring-green/12 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-clay";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-11 sm:h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-2.5 leading-relaxed sm:min-h-28 sm:py-3", className)} {...props} />;
}

export { Select } from "@/components/ui/select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[0.84375rem] font-medium text-ink", className)} {...props} />;
}

export function Field({ label, hint, error, htmlFor, optional, className, children }: {
  label: string; hint?: React.ReactNode; error?: string; htmlFor?: string; optional?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1.5 rounded-full bg-sand px-1.5 py-px text-[11px] font-normal text-muted">facultatif</span>}
      </Label>
      {children}
      {error ? <p className="text-[0.8125rem] text-clay">{error}</p> : hint ? <p className="text-[0.8125rem] text-muted">{hint}</p> : null}
    </div>
  );
}
