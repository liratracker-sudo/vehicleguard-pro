import { motion } from "framer-motion";
import { Satellite, Radio, MapPin, Signal } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

interface SatelliteTrackingBackgroundProps {
  showSatellite?: boolean;
  showSignals?: boolean;
  showGrid?: boolean;
  children?: React.ReactNode;
}

export const SatelliteTrackingBackground: React.FC<SatelliteTrackingBackgroundProps> = ({
  showSatellite = true,
  showSignals = true,
  showGrid = true,
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePosition({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height
        });
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      return () => container.removeEventListener('mousemove', handleMouseMove);
    }
  }, []);

  const satelliteAnimation = {
    x: [0, 300, 600, 900, 1200],
    y: [100, 80, 120, 90, 110],
    rotate: [0, 45, 90, 135, 180],
    transition: {
      duration: 20,
      repeat: Infinity,
      ease: "linear" as const
    }
  };

  const signalAnimation = {
    scale: [1, 2, 3],
    opacity: [0.8, 0.4, 0],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeOut" as const
    }
  };

  const gridLineAnimation = {
    opacity: [0.2, 0.6, 0.2],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut" as const
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden bg-background"
    >
      {/* Animated Grid Background */}
      {showGrid && (
        <div className="absolute inset-0">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <motion.path
                  d="M 50 0 L 0 0 0 50"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.5"
                  animate={gridLineAnimation}
                  opacity={0.3}
                />
              </pattern>
              <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                <stop offset="50%" stopColor="hsl(var(--accent))" stopOpacity="0.05" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <motion.circle
              cx={mousePosition.x * 100 + "%"}
              cy={mousePosition.y * 100 + "%"}
              r="200"
              fill="url(#radarGradient)"
              animate={{
                r: [150, 250, 150],
                opacity: [0.3, 0.1, 0.3]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </svg>
        </div>
      )}

      {/* Floating Particles */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary"
            animate={{
              x: [Math.random() * 1200, Math.random() * 1200],
              y: [Math.random() * 800, Math.random() * 800],
              opacity: [0, 1, 0]
            }}
            transition={{
              duration: Math.random() * 10 + 5,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "linear"
            }}
          />
        ))}
      </div>

      {/* Satellite Animation */}
      {showSatellite && (
      <motion.div
        className="absolute top-20 left-0 z-10"
        animate={satelliteAnimation}
      >
          <div className="relative">
            <Satellite 
              size={32} 
              className="text-primary drop-shadow-lg"
            />
            {/* Satellite Trail */}
            <motion.div
              className="absolute -top-1 -left-1 w-8 h-8 rounded-full border-2 border-primary"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.8, 0.3, 0.8]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </div>
        </motion.div>
      )}

      {/* Signal Pulses */}
      {showSignals && (
        <>
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-1/2 left-1/4 w-4 h-4 rounded-full border-2 border-accent"
              animate={signalAnimation}
              transition={{
                delay: i * 0.7,
                duration: 2,
                repeat: Infinity,
                ease: "easeOut" as const
              }}
            />
          ))}
        </>
      )}

      {/* Ground Stations */}
      <div className="absolute bottom-20 left-10">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.8, 1, 0.8]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Radio size={24} className="text-primary" />
        </motion.div>
      </div>

      <div className="absolute bottom-32 right-20">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.8, 1, 0.8]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.5
          }}
        >
          <Radio size={24} className="text-accent" />
        </motion.div>
      </div>

      {/* Location Markers */}
      <div className="absolute top-1/3 right-1/3">
        <motion.div
          animate={{
            y: [-5, 5, -5],
            opacity: [0.6, 1, 0.6]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <MapPin size={20} className="text-primary" />
        </motion.div>
      </div>

      <div className="absolute bottom-1/3 left-1/2">
        <motion.div
          animate={{
            y: [-5, 5, -5],
            opacity: [0.6, 1, 0.6]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        >
          <MapPin size={20} className="text-accent" />
        </motion.div>
      </div>

      {/* Signal Strength Indicator */}
      <div className="absolute top-10 right-10">
        <motion.div
          animate={{
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Signal size={28} className="text-primary" />
        </motion.div>
      </div>

      {/* Scanning Line Effect */}
      <motion.div
        className="absolute top-0 left-0 w-full h-1 bg-primary"
        animate={{
          y: [0, typeof window !== 'undefined' ? window.innerHeight : 800],
          opacity: [0, 1, 0]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "linear"
        }}
      />

      {/* Content Overlay */}
      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen">
        {children}
      </div>
    </div>
  );
};