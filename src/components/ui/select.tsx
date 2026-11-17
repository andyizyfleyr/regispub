"use client";

import * as React from "react";
import { Select as S } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string; disabled?: boolean };
type OptProps = { value?: string | number; disabled?: boolean; children?: React.ReactNode; label?: string };

function text(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return text(node.props.children);
  return "";
}

/** Lit les <option> (et <optgroup>) passés en enfants, comme pour un <select> natif. */
function collect(children: React.ReactNode, out: Opt[]) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<OptProps>(child)) return;
    if (child.type === "option") {
      const label = text(child.props.children);
      out.push({ value: child.props.value === undefined ? label : String(child.props.value), label, disabled: child.props.disabled });
    } else collect(child.props.children, out);
  });
}

type Props = {
  id?: string; name?: string; value?: string | number; defaultValue?: string | number; required?: boolean; disabled?: boolean; className?: string; placeholder?: string;
  "aria-label"?: string; onChange?: (e: { target: { value: string } }) => void; children: React.ReactNode;
};

/** Menu déroulant : même écriture qu'un <select> natif, rendu en liste stylée. */
export function Select({ id, name, value, defaultValue, required, disabled, className, placeholder, onChange, children, ...rest }: Props) {
  const all: Opt[] = [];
  collect(children, all);
  const empty = all.find((o) => o.value === "");
  const options = all.filter((o) => o.value !== "");
  return (
    <S.Root name={name} value={value === undefined ? undefined : String(value)} defaultValue={defaultValue === undefined || defaultValue === "" ? undefined : String(defaultValue)} required={required} disabled={disabled} onValueChange={(v) => onChange?.({ target: { value: v } })}>
      <S.Trigger id={id} aria-label={rest["aria-label"]}
        className={cn("flex h-11 w-full items-center justify-between gap-2 rounded-md border border-line-strong bg-surface px-3.5 text-left text-[15px] text-ink transition-[border-color,box-shadow] hover:border-ink/30 focus:border-green focus:outline-none focus:ring-4 focus:ring-green/12 disabled:cursor-not-allowed disabled:bg-sand disabled:opacity-70 data-[state=open]:border-green data-[state=open]:ring-4 data-[state=open]:ring-green/12 data-[placeholder]:text-muted/70 [&>span]:min-w-0 [&>span]:truncate", className)}>
        <S.Value placeholder={placeholder ?? empty?.label ?? "Choisir…"} />
        <S.Icon><ChevronDown className="size-4 shrink-0 text-muted" /></S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={6} collisionPadding={12}
          className="z-[70] max-h-[min(20rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-[11rem] animate-pop overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
          <S.Viewport className="p-1.5">
            {options.map((o) => (
              <S.Item key={o.value} value={o.value} disabled={o.disabled}
                className="relative flex min-h-10 cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-[14.5px] text-ink outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-green-soft data-[state=checked]:font-semibold data-[disabled]:opacity-45">
                <S.ItemText>{o.label}</S.ItemText>
                <S.ItemIndicator className="absolute right-3 text-green"><Check className="size-4" strokeWidth={2.6} /></S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
