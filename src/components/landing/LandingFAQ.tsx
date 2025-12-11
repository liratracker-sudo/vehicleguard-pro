import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Como funciona o Gerente de Contas Virtual por IA?",
    answer: "O Gerente de Contas Virtual é um assistente de inteligência artificial que você acessa via WhatsApp. Basta enviar mensagens em linguagem natural como 'Quem está inadimplente?' ou 'Cobra o João com tom firme' e a IA executa automaticamente. Ela pode consultar dados, enviar cobranças, gerar relatórios e agendar lembretes.",
  },
  {
    question: "Preciso de conhecimento técnico para usar?",
    answer: "Não! O sistema foi desenvolvido para ser extremamente intuitivo. A interface é simples e o assistente de IA entende comandos em português natural. Você não precisa saber programação ou ter experiência técnica.",
  },
  {
    question: "Posso personalizar com minha marca (White-Label)?",
    answer: "Sim! No plano Enterprise você tem acesso ao White-Label completo. Pode usar seu próprio logo, cores, domínio personalizado e até configurar emails com sua marca. Seus clientes verão apenas sua identidade visual.",
  },
  {
    question: "Quais formas de pagamento são aceitas?",
    answer: "Integramos com os principais gateways do Brasil: Asaas, MercadoPago, Banco Inter e Gerencianet. Você pode oferecer PIX, boleto, cartão de crédito e débito automático para seus clientes.",
  },
  {
    question: "As mensagens de cobrança são automáticas?",
    answer: "Sim! Você configura as regras uma vez e o sistema envia automaticamente: lembretes antes do vencimento, no dia do vencimento e após o vencimento. Além disso, pode usar a IA para cobranças manuais personalizadas.",
  },
  {
    question: "É seguro armazenar dados financeiros?",
    answer: "Absolutamente! Usamos criptografia de ponta a ponta, servidores seguros na nuvem (Supabase), autenticação multi-fator e backup automático. Seus dados e de seus clientes estão protegidos com padrões bancários de segurança.",
  },
  {
    question: "Posso testar antes de contratar?",
    answer: "Sim! Oferecemos uma demonstração completa do sistema. Entre em contato pelo WhatsApp e agende uma apresentação personalizada para sua empresa.",
  },
  {
    question: "Como funciona o suporte?",
    answer: "Oferecemos suporte por email no plano Básico, suporte prioritário no Profissional e suporte 24/7 no Enterprise. Além disso, temos documentação completa e tutoriais em vídeo.",
  },
];

export const LandingFAQ = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tire suas dúvidas sobre o sistema
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border border-border rounded-lg px-6"
              >
                <AccordionTrigger className="text-left text-foreground hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};
