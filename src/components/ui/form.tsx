import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-md border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted/60 transition-[border-color,box-shadow] hover:border-ink/30 focus:border-green focus:outline-none focus:ring-4 focus:ring-green/12 disabled:cursor-not-allowed disabled:bg-sand disabled:opacity-70 aria-[invalid=true]:border-clay";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-3 leading-relaxed", className)} {...props} />;
}

export { Select } from "@/components/ui/select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-medium text-ink", className)} {...props} />;
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
      {error ? <p className="text-[13px] text-clay">{error}</p> : hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}
