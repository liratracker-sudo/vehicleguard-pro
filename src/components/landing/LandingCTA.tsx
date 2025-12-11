import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowRight, Bot } from "lucide-react";

export const LandingCTA = () => {
  const whatsappLink = "https://wa.me/5521992081803?text=Olá! Tenho interesse em implantar o sistema de gestão com IA.";

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-emerald-500/10" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <Bot className="w-8 h-8 text-primary" />
          </div>

          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Pronto para automatizar suas cobranças?
          </h2>
          
          <p className="text-lg text-muted-foreground mb-8">
            Fale conosco agora pelo WhatsApp e comece a reduzir sua inadimplência hoje mesmo.
            Implantação rápida e suporte completo.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="xl"
              variant="hero"
              className="group text-lg"
              onClick={() => window.open(whatsappLink, "_blank")}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Implante Agora
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            WhatsApp: (21) 99208-1803 • Atendimento de Seg a Sex, 9h às 18h
          </p>
        </motion.div>
      </div>
    </section>
  );
};
