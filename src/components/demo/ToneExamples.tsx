import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const tones = [
  {
    id: "amigavel",
    name: "Amigável",
    emoji: "🤝",
    description: "Gentil e compreensivo",
    color: "bg-green-500",
    message: "Olá João! 😊 Tudo bem? Passando para lembrar que sua mensalidade de R$ 800,00 venceu há alguns dias. Sabemos que imprevistos acontecem! Quando conseguir regularizar? Estamos aqui para ajudar no que precisar. Abraços! 💚",
  },
  {
    id: "formal",
    name: "Formal",
    emoji: "📋",
    description: "Profissional e técnico",
    color: "bg-blue-500",
    message: "Prezado Sr. João Silva, informamos que consta em nosso sistema uma pendência financeira no valor de R$ 800,00, referente à mensalidade com vencimento em 26/11/2025. Solicitamos a regularização para evitar transtornos. Em caso de dúvidas, estamos à disposição. Atenciosamente, Equipe Financeira.",
  },
  {
    id: "urgente",
    name: "Urgente",
    emoji: "⚡",
    description: "Ênfase na prioridade",
    color: "bg-amber-500",
    message: "ATENÇÃO João! Sua fatura de R$ 800,00 está VENCIDA há 15 dias. É importante regularizar o quanto antes para evitar problemas. Por favor, efetue o pagamento ainda hoje através do PIX: [chave]. Precisamos resolver isso com URGÊNCIA!",
  },
  {
    id: "firme",
    name: "Firme",
    emoji: "💪",
    description: "Assertivo e direto",
    color: "bg-orange-500",
    message: "João, sua fatura de R$ 800,00 está em atraso há 15 dias. Não recebemos nenhum contato seu sobre isso. Precisamos que o pagamento seja feito imediatamente. Caso já tenha pago, envie o comprovante. Não podemos mais aguardar. Link para pagamento: [pix]",
  },
  {
    id: "agressivo",
    name: "Agressivo",
    emoji: "🔥",
    description: "Incisivo com consequências",
    color: "bg-red-500",
    message: "Sr. João, esta é uma NOTIFICAÇÃO URGENTE. Sua fatura de R$ 800,00 está vencida há 15 dias e não podemos mais aguardar. O não pagamento IMEDIATO resultará em negativação do CPF nos órgãos de proteção ao crédito. Regularize HOJE: [link do pix]",
  },
  {
    id: "muito_agressivo",
    name: "Muito Agressivo",
    emoji: "💥",
    description: "Último aviso, menção judicial",
    color: "bg-red-700",
    message: "ÚLTIMA NOTIFICAÇÃO - Sr. João Silva, seu débito de R$ 800,00 será encaminhado para COBRANÇA JUDICIAL em 48 horas. Seu nome será negativado no SPC/SERASA e você poderá responder processo por inadimplência. Esta é sua ÚLTIMA CHANCE de resolver amigavelmente. Pague AGORA: [link]",
  },
];

const ToneExamples = () => {
  const [activeTone, setActiveTone] = useState(tones[0]);

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Tons de Cobrança Inteligentes
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A IA adapta a mensagem de acordo com o tom escolhido. Do amigável ao mais incisivo.
          </p>
        </motion.div>

        {/* Tone selector */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {tones.map((tone) => (
            <button
              key={tone.id}
              onClick={() => setActiveTone(tone)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300",
                activeTone.id === tone.id
                  ? "bg-primary text-primary-foreground border-primary shadow-lg scale-105"
                  : "bg-card border-border hover:border-primary/50 hover:bg-muted"
              )}
            >
              <span className="text-lg">{tone.emoji}</span>
              <span className="font-medium">{tone.name}</span>
            </button>
          ))}
        </div>

        {/* Active tone preview */}
        <motion.div
          key={activeTone.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-2xl mx-auto"
        >
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
            {/* Header */}
            <div className={cn("px-6 py-4 flex items-center gap-4", activeTone.color)}>
              <span className="text-4xl">{activeTone.emoji}</span>
              <div>
                <h3 className="text-xl font-bold text-white">{activeTone.name}</h3>
                <p className="text-white/80 text-sm">{activeTone.description}</p>
              </div>
            </div>

            {/* Message preview */}
            <div className="p-6">
              <p className="text-sm text-muted-foreground mb-2 font-medium">
                Mensagem gerada pela IA:
              </p>
              <div className="bg-muted/50 rounded-xl p-4 border border-border">
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {activeTone.message}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className={cn("w-2 h-2 rounded-full", activeTone.color)} />
                <span>Tom: <strong>{activeTone.name}</strong></span>
                <span className="mx-2">•</span>
                <span>Cliente: João Silva</span>
                <span className="mx-2">•</span>
                <span>Valor: R$ 800,00</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Usage tip */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-muted-foreground mt-8"
        >
          💡 <strong>Dica:</strong> Diga "Cobra o [nome] com tom [tipo]" para especificar o tom desejado
        </motion.p>
      </div>
    </section>
  );
};

export default ToneExamples;
