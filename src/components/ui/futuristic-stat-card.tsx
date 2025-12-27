import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FuturisticStatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
  isLoading?: boolean;
}

const variantStyles = {
  default: {
    gradient: "from-cyan-500 via-blue-500 to-purple-500",
    glow: "shadow-[0_0_30px_rgba(6,182,212,0.3)]",
    iconBg: "from-cyan-500/20 to-blue-500/20",
    textGlow: "drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]",
    borderColor: "border-cyan-500/30",
    accentColor: "bg-cyan-500",
  },
  success: {
    gradient: "from-emerald-500 via-green-500 to-teal-500",
    glow: "shadow-[0_0_30px_rgba(16,185,129,0.3)]",
    iconBg: "from-emerald-500/20 to-green-500/20",
    textGlow: "drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]",
    borderColor: "border-emerald-500/30",
    accentColor: "bg-emerald-500",
  },
  warning: {
    gradient: "from-amber-500 via-orange-500 to-yellow-500",
    glow: "shadow-[0_0_30px_rgba(245,158,11,0.3)]",
    iconBg: "from-amber-500/20 to-orange-500/20",
    textGlow: "drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]",
    borderColor: "border-amber-500/30",
    accentColor: "bg-amber-500",
  },
  danger: {
    gradient: "from-red-500 via-rose-500 to-pink-500",
    glow: "shadow-[0_0_30px_rgba(239,68,68,0.3)]",
    iconBg: "from-red-500/20 to-rose-500/20",
    textGlow: "drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]",
    borderColor: "border-red-500/30",
    accentColor: "bg-red-500",
  },
};

export function FuturisticStatCard({
  title,
  value,
  icon,
  description,
  trend,
  variant = 'default',
  className,
  isLoading = false,
}: FuturisticStatCardProps) {
  const styles = variantStyles[variant];

  if (isLoading) {
    return (
      <div className={cn(
        "relative overflow-hidden rounded-xl p-5",
        "bg-card/50 backdrop-blur-xl border border-border/50",
        "animate-pulse",
        className
      )}>
        <div className="h-4 w-24 bg-muted rounded mb-3" />
        <div className="h-8 w-32 bg-muted rounded mb-2" />
        <div className="h-3 w-20 bg-muted rounded" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-xl",
        styles.glow,
        "hover:shadow-[0_0_50px_rgba(6,182,212,0.4)]",
        "transition-all duration-500",
        className
      )}
    >
      {/* Animated gradient border */}
      <div className="absolute inset-0 rounded-xl p-[1px] overflow-hidden">
        <div className={cn(
          "absolute inset-0 bg-gradient-to-r",
          styles.gradient,
          "animate-[spin_4s_linear_infinite]",
          "blur-sm opacity-75"
        )} />
      </div>

      {/* Main content container */}
      <div className={cn(
        "relative rounded-xl p-5",
        "bg-gradient-to-br from-card/95 via-card/90 to-card/80",
        "backdrop-blur-xl",
        "border",
        styles.borderColor
      )}>
        {/* Scan line effect */}
        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <div className={cn(
            "absolute w-full h-[2px]",
            "bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent",
            "animate-[scan-line_3s_ease-in-out_infinite]"
          )} />
        </div>

        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none rounded-xl"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px'
          }}
        />

        {/* Top highlight line */}
        <div className={cn(
          "absolute top-0 left-4 right-4 h-[1px]",
          "bg-gradient-to-r from-transparent",
          styles.gradient.replace('from-', 'via-').replace('via-', 'via-').replace('to-', 'to-transparent'),
          "opacity-50"
        )} />

        {/* Corner accents */}
        <div className={cn("absolute top-2 left-2 w-3 h-3 border-l-2 border-t-2 rounded-tl-sm", styles.borderColor, "opacity-60")} />
        <div className={cn("absolute top-2 right-2 w-3 h-3 border-r-2 border-t-2 rounded-tr-sm", styles.borderColor, "opacity-60")} />
        <div className={cn("absolute bottom-2 left-2 w-3 h-3 border-l-2 border-b-2 rounded-bl-sm", styles.borderColor, "opacity-60")} />
        <div className={cn("absolute bottom-2 right-2 w-3 h-3 border-r-2 border-b-2 rounded-br-sm", styles.borderColor, "opacity-60")} />

        {/* Content */}
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Title */}
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              {title}
            </p>

            {/* Value with neon glow */}
            <motion.p 
              className={cn(
                "text-2xl sm:text-3xl font-bold text-foreground",
                styles.textGlow,
                "animate-[neon-pulse_2s_ease-in-out_infinite]"
              )}
            >
              {value}
            </motion.p>

            {/* Trend indicator */}
            {trend && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-2 flex items-center gap-1"
              >
                <span className={cn(
                  "text-xs font-medium",
                  trend.isPositive ? "text-emerald-400" : "text-rose-400"
                )}>
                  {trend.isPositive ? "▲" : "▼"} {trend.value}
                </span>
              </motion.div>
            )}

            {description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          {/* Holographic Icon */}
          <motion.div
            whileHover={{ rotate: 360, scale: 1.1 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className={cn(
              "relative flex-shrink-0 p-3 rounded-xl",
              "bg-gradient-to-br",
              styles.iconBg,
              "border",
              styles.borderColor,
              "group-hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]",
              "transition-all duration-300"
            )}
          >
            {/* Hologram ring effect */}
            <div className={cn(
              "absolute inset-0 rounded-xl",
              "bg-gradient-to-r",
              styles.gradient,
              "opacity-0 group-hover:opacity-20",
              "animate-[spin_3s_linear_infinite]",
              "transition-opacity duration-300"
            )} />
            
            {/* Icon */}
            <div className={cn(
              "relative z-10 text-foreground",
              styles.textGlow,
              "[&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6"
            )}>
              {icon}
            </div>
          </motion.div>
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className={cn(
                "absolute w-1 h-1 rounded-full",
                styles.accentColor,
                "opacity-40"
              )}
              style={{
                left: `${20 + i * 30}%`,
                top: `${30 + i * 20}%`,
              }}
              animate={{
                y: [-5, 5, -5],
                opacity: [0.2, 0.6, 0.2],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 2 + i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.3,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
