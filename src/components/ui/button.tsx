import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-forest text-white shadow-[0_8px_18px_-10px_rgb(11_42_31/0.7)] hover:bg-forest-600",
        accent: "bg-marigold text-forest shadow-glow hover:bg-marigold-600",
        outline: "border border-line-strong bg-surface text-ink hover:border-ink/30 hover:bg-paper",
        soft: "bg-green-soft text-green hover:bg-green-soft/70",
        ghost: "text-ink-soft hover:bg-sand hover:text-ink",
        danger: "bg-clay text-white hover:bg-clay/90",
        "danger-outline": "border border-clay/40 bg-surface text-clay hover:bg-clay-soft",
        link: "h-auto! p-0! text-green underline-offset-4 hover:underline",
      },
      size: { sm: "h-8 px-3.5 text-[0.8125rem] sm:h-9 sm:px-4", md: "h-10 px-4 text-sm sm:h-11 sm:px-5", lg: "h-11 px-5 text-[0.9375rem] sm:h-[3.25rem] sm:px-7", icon: "size-9 sm:size-10" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
