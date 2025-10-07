import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 w-full sm:w-auto",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white hover:bg-blue-700 shadow transition-all",
        destructive: "bg-red-600 text-white hover:bg-red-700 shadow-sm transition-all",
        outline: "border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:text-slate-100 transition-all backdrop-blur-sm",
        secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700 transition-all",
        ghost: "hover:bg-slate-800 hover:text-slate-100 transition-all",
        link: "text-blue-400 underline-offset-4 hover:underline",
        success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
        warning: "bg-amber-600 text-white shadow-sm hover:bg-amber-700",
        premium: "bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:opacity-90 shadow-lg shadow-blue-500/25 transition-all font-semibold",
        hero: "bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:shadow-xl transform hover:scale-105 transition-all duration-300 text-base font-semibold",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6 sm:px-8",
        xl: "h-12 rounded-lg px-8 sm:px-10 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
