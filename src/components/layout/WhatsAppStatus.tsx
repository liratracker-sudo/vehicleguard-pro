import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { useWhatsAppConnection } from '@/contexts/WhatsAppContext';

export const WhatsAppStatus: React.FC = () => {
  const { connectionState, reconnect, refreshConnection } = useWhatsAppConnection();

  const getStatusBadge = () => {
    switch (connectionState.connectionStatus) {
      case 'connected':
        return (
          <Badge className="bg-success/20 text-success border-success/30 gap-1">
            <MessageCircle className="w-3 h-3" />
            WhatsApp Conectado
          </Badge>
        );
      case 'connecting':
      case 'reconnecting':
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30 gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Conectando...
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
            <AlertCircle className="w-3 h-3" />
            Sessão Expirada
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <MessageCircle className="w-3 h-3" />
            WhatsApp Desconectado
          </Badge>
        );
    }
  };

  return (
    <div className="flex items-center gap-2">
      {getStatusBadge()}
      
      {connectionState.connectionStatus === 'disconnected' && (
        <Button
          size="sm"
          variant="outline"
          onClick={reconnect}
          className="h-6 px-2 text-xs"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Reconectar
        </Button>
      )}
      
      {connectionState.connectionStatus === 'expired' && (
        <Button
          size="sm"
          variant="destructive"
          onClick={reconnect}
          className="h-6 px-2 text-xs"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Reconectar
        </Button>
      )}

      {connectionState.lastChecked && (
        <span className="text-xs text-muted-foreground">
          Última verificação: {connectionState.lastChecked.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};