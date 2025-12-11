import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
}

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-14 h-14",
};

export const Logo = ({ className, size = "md", showText = true }: LogoProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(sizeClasses[size], "flex-shrink-0")}
      >
        {/* Pin de localização - corpo principal */}
        <path
          d="M24 4C16.268 4 10 10.268 10 18C10 28 24 44 24 44C24 44 38 28 38 18C38 10.268 31.732 4 24 4Z"
          className="fill-primary"
        />
        
        {/* Círculo interno do pin */}
        <circle
          cx="24"
          cy="18"
          r="10"
          className="fill-background"
        />
        
        {/* Gráfico de barras (gestão financeira) dentro do pin */}
        <rect
          x="17"
          y="18"
          width="3"
          height="6"
          rx="0.5"
          className="fill-primary"
        />
        <rect
          x="22"
          y="14"
          width="3"
          height="10"
          rx="0.5"
          className="fill-primary"
        />
        <rect
          x="27"
          y="16"
          width="3"
          height="8"
          rx="0.5"
          className="fill-primary"
        />
        
        {/* Linha de tendência ascendente */}
        <path
          d="M17 20L22 15L28 17"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-primary"
        />
        
        {/* Ponto do gráfico */}
        <circle
          cx="28"
          cy="17"
          r="1.5"
          className="fill-primary"
        />
      </svg>
      
      {showText && (
        <span className="font-bold text-foreground">
          Gestão<span className="text-primary">Rastreio</span>
        </span>
      )}
    </div>
  );
};

export const LogoIcon = ({ className, size = "md" }: Omit<LogoProps, "showText">) => {
  return <Logo className={className} size={size} showText={false} />;
};
