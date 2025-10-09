import { useState, useEffect } from 'react';
import { nowInBrasilia, formatDateTimeBR } from '@/lib/timezone';

/**
 * Hook que retorna a data/hora atual no horário de Brasília
 * Atualiza automaticamente a cada minuto
 */
export function useBrasiliaTime() {
  const [currentTime, setCurrentTime] = useState(() => nowInBrasilia());

  useEffect(() => {
    // Atualizar a cada minuto
    const interval = setInterval(() => {
      setCurrentTime(nowInBrasilia());
    }, 60000); // 60 segundos

    return () => clearInterval(interval);
  }, []);

  return {
    currentTime,
    formatted: formatDateTimeBR(currentTime),
  };
}
