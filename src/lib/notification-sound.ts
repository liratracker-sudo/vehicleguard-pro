// Som de notificação usando Web Audio API
export const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // Criar oscilador para o som
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // Configurar tipo de onda e frequência (som agradável de notificação)
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime) // Nota Lá
    oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1) // Sobe
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.2) // Volta
    
    // Configurar volume (fade in/out)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05)
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.2)
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.4)
    
    // Tocar e parar
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.4)
    
    // Limpar contexto após terminar
    setTimeout(() => {
      audioContext.close()
    }, 500)
  } catch (error) {
    console.error('Erro ao tocar som de notificação:', error)
  }
}
