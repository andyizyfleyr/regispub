import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-forest text-white hover:bg-forest-600",
        accent: "bg-marigold text-forest hover:bg-marigold-600",
        outline: "border border-line-strong bg-surface text-ink hover:border-ink/40 hover:bg-sand/60",
        ghost: "text-ink-soft hover:bg-sand",
        danger: "bg-clay text-white hover:bg-clay/90",
        "danger-outline": "border border-clay/40 bg-surface text-clay hover:bg-clay-soft",
        link: "h-auto! p-0! text-green underline-offset-4 hover:underline",
      },
      size: { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]", icon: "size-9" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
