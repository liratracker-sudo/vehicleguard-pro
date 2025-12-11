import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import DemoHero from "@/components/demo/DemoHero";
import WhatsAppChatSimulator from "@/components/demo/WhatsAppChatSimulator";
import CommandsShowcase from "@/components/demo/CommandsShowcase";
import ToneExamples from "@/components/demo/ToneExamples";

const AIDemo = () => {
  const whatsappLink = "https://wa.me/5521992081803?text=Olá! Tenho interesse em implantar o sistema de gestão com IA.";

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Voltar</span>
          </Link>
          
          <Button
            size="sm"
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
            onClick={() => window.open(whatsappLink, '_blank')}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Implante Agora
          </Button>
        </div>
      </nav>

      {/* Main content */}
      <main className="pt-16">
        <DemoHero />
        <WhatsAppChatSimulator />
        <CommandsShowcase />
        <ToneExamples />

        {/* Final CTA */}
        <section className="py-20 px-4 bg-gradient-to-br from-primary/10 via-background to-green-500/10">
          <div className="container mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Pronto para automatizar suas cobranças?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                Tenha um Gerente de Contas Virtual trabalhando 24/7 para sua empresa. 
                Reduza inadimplência e aumente sua produtividade.
              </p>
              <Button
                size="lg"
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25 px-10 py-6 text-lg"
                onClick={() => window.open(whatsappLink, '_blank')}
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                Implante Agora
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 border-t border-border">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Sistema de Gestão com IA. Todos os direitos reservados.</p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default AIDemo;
