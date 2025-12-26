import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight, MessageCircle, Sparkles } from "lucide-react";

export const LandingHero = () => {
  const whatsappLink = "https://wa.me/5521992081803?text=Olá! Tenho interesse em implantar o sistema de gestão com IA.";
  
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Aurora background effect */}
      <div className="aurora-bg" />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 grid-pattern" />
      
      {/* Gradient orbs */}
      <motion.div 
        className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-primary/20 blur-[120px]"
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full bg-emerald-500/15 blur-[100px]"
        animate={{ 
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass-card badge-glow text-sm font-medium text-primary">
              <Sparkles className="w-4 h-4" />
              Tecnologia de Ponta em IA
              <Bot className="w-4 h-4" />
            </span>
          </motion.div>

          {/* Main heading */}
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold text-foreground mb-8 leading-[1.1] tracking-tight"
          >
            Automatize suas{" "}
            <span className="gradient-text">
              Cobranças
            </span>{" "}
            com IA
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl lg:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed"
          >
            Sistema completo de gestão financeira com Gerente de Contas Virtual. 
            <span className="text-foreground font-medium"> Reduza a inadimplência em até 40%</span> e automatize cobranças via WhatsApp.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button 
              size="xl" 
              className="glow-button group bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg rounded-xl" 
              asChild
            >
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-5 h-5 mr-2" />
                Implante Agora
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </a>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="glass-card border-border/50 hover:border-primary/50 px-8 py-6 text-lg rounded-xl"
              onClick={() => window.location.href = "/demo"}
            >
              Ver Demonstração
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {[
              { value: "40%", label: "Redução na Inadimplência" },
              { value: "24/7", label: "Atendimento Automatizado" },
              { value: "500+", label: "Empresas Atendidas" },
              { value: "98%", label: "Satisfação dos Clientes" }
            ].map((stat, index) => (
              <motion.div 
                key={index} 
                className="stat-card text-center group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground font-medium">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
