import { motion } from "framer-motion";
import { 
  Bot, 
  Bell, 
  FileText, 
  CreditCard, 
  BarChart3, 
  Building2,
  MessageSquare,
  Shield
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "Gerente de Contas Virtual",
    description: "Assistente de IA via WhatsApp que cobra, consulta e gerencia automaticamente.",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Bell,
    title: "Notificações Automáticas",
    description: "Lembretes de vencimento pré e pós-vencimento enviados automaticamente.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: FileText,
    title: "Contratos Digitais",
    description: "Gere e envie contratos para assinatura digital integrado com Assinafy.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: CreditCard,
    title: "Multi-Gateway",
    description: "Integração com Asaas, MercadoPago, Inter e Gerencianet para cobranças.",
    gradient: "from-orange-500 to-amber-500",
  },
  {
    icon: BarChart3,
    title: "Dashboard Completo",
    description: "Relatórios financeiros, métricas e análises em tempo real.",
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    icon: Building2,
    title: "White-Label",
    description: "Personalize com sua marca, cores e domínio próprio.",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Evolution",
    description: "Integração oficial com Evolution API para mensagens em massa.",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    icon: Shield,
    title: "Segurança Total",
    description: "Dados criptografados, autenticação segura e backup automático.",
    gradient: "from-red-500 to-orange-500",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const,
    },
  },
};

export const LandingFeatures = () => {
  return (
    <section className="py-32 bg-background relative overflow-hidden">
      {/* Subtle background effects */}
      <div className="absolute inset-0 grid-pattern opacity-50" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <motion.span 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 rounded-full glass-card text-sm font-medium text-primary mb-6"
          >
            Funcionalidades
          </motion.span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight">
            Tudo que você precisa
            <br />
            <span className="gradient-text">em um só lugar</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Sistema completo de gestão financeira com automações inteligentes
          </p>
        </motion.div>

        <motion.div 
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="feature-card group cursor-pointer"
              whileHover={{ y: -8 }}
              transition={{ duration: 0.3 }}
            >
              {/* Icon with gradient background */}
              <div className="icon-wrapper mb-5">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} p-0.5`}>
                  <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center">
                    <feature.icon className={`w-6 h-6 bg-gradient-to-br ${feature.gradient} bg-clip-text`} style={{ color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }} />
                  </div>
                </div>
                {/* Glow effect on hover */}
                <div className={`absolute inset-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-500`} />
              </div>
              
              <h3 className="text-lg font-semibold text-foreground mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
              
              {/* Bottom gradient line on hover */}
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
