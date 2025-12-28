import { LandingHero } from "@/components/landing/LandingHero";
import { LandingAIShowcase } from "@/components/landing/LandingAIShowcase";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingTestimonials } from "@/components/landing/LandingTestimonials";
import { LandingFAQ } from "@/components/landing/LandingFAQ";
import { LandingCTA } from "@/components/landing/LandingCTA";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { LogIn } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Logo size="md" />
          
          <div className="flex items-center gap-4">
            <Button
              variant="premium"
              size="sm"
              onClick={() => window.location.href = "/auth?tab=signup"}
            >
              Testar Grátis
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => window.location.href = "/auth"}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Entrar
            </Button>
          </div>
        </div>
      </nav>

      {/* Sections */}
      <LandingHero />
      <LandingAIShowcase />
      <LandingFeatures />
      <LandingPricing />
      <LandingTestimonials />
      <LandingFAQ />
      <LandingCTA />

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} GestãoRastreio. Todos os direitos reservados.</p>
          <p className="mt-2">
            Desenvolvido com ❤️ para empresas de rastreamento
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
