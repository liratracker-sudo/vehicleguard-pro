import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWhatsAppConnection } from "@/contexts/WhatsAppContext";
import { supabase } from "@/integrations/supabase/client";
import { QrCode, RefreshCw, CheckCircle, XCircle, Wifi, WifiOff } from "lucide-react";

interface ReconnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReconnectDialog: React.FC<ReconnectDialogProps> = ({ open, onOpenChange }) => {
  const { connectionState, checkConnection } = useWhatsAppConnection();
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fechar automaticamente quando conectar
  useEffect(() => {
    if (connectionState.isConnected && open) {
      setTimeout(() => {
        onOpenChange(false);
        setQrCodeData(null);
      }, 1500);
    }
  }, [connectionState.isConnected, open, onOpenChange]);

  // Polling para verificar conexão
  useEffect(() => {
    if (!open || connectionState.isConnected || !qrCodeData) return;

    const interval = setInterval(async () => {
      await checkConnection();
    }, 3000);

    return () => clearInterval(interval);
  }, [open, connectionState.isConnected, qrCodeData, checkConnection]);

  const generateQRCode = async (forceNew = false) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.company_id) throw new Error('Empresa não encontrada');

      const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('instance_name')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .maybeSingle();

      if (!settings?.instance_name) throw new Error('Instância não configurada');

      const response = await supabase.functions.invoke('whatsapp-evolution', {
        body: {
          action: 'get_qr_code',
          instance_name: settings.instance_name,
          force_new: forceNew,
          company_id: profile.company_id
        }
      });

      if (response.error) throw new Error(response.error.message);

      if (response.data?.success && response.data?.qrCode) {
        setQrCodeData(response.data.qrCode);
      } else {
        throw new Error(response.data?.error || 'Falha ao gerar QR Code');
      }
    } catch (err: any) {
      console.error('Erro ao gerar QR Code:', err);
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    if (open && !connectionState.isConnected && !qrCodeData && !loading) {
      generateQRCode();
    }
  };

  useEffect(() => {
    handleOpen();
  }, [open]);

  const getStatusBadge = () => {
    switch (connectionState.connectionStatus) {
      case 'connected':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'reconnecting':
        return (
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            Reconectando...
          </Badge>
        );
      case 'connecting':
        return (
          <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
            <Wifi className="w-3 h-3 mr-1 animate-pulse" />
            Conectando...
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive" className="bg-destructive/20">
            <WifiOff className="w-3 h-3 mr-1" />
            Desconectado
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            Reconectar WhatsApp
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            Status: {getStatusBadge()}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 py-4">
          {connectionState.isConnected ? (
            <div className="flex flex-col items-center space-y-3 py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-lg font-medium text-green-500">WhatsApp Conectado!</p>
              <p className="text-sm text-muted-foreground">Fechando automaticamente...</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center space-y-3 py-8">
              <RefreshCw className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center space-y-3 py-4">
              <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
              <p className="text-sm text-destructive text-center">{error}</p>
              <div className="flex gap-2">
                <Button onClick={() => generateQRCode(false)} variant="outline" size="sm">
                  Tentar Novamente
                </Button>
                <Button onClick={() => generateQRCode(true)} variant="destructive" size="sm">
                  Nova Instância
                </Button>
              </div>
            </div>
          ) : qrCodeData ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-lg border shadow-sm">
                <img 
                  src={qrCodeData}
                  alt="QR Code WhatsApp"
                  className="w-52 h-52"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.svg';
                  }}
                />
              </div>
              
              <div className="flex items-center gap-2 text-amber-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Aguardando leitura do QR Code...</span>
              </div>
              
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Abra o WhatsApp no seu celular</p>
                <p className="text-xs text-muted-foreground">
                  Menu (⋮) → Dispositivos conectados → Conectar dispositivo
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => generateQRCode(false)} 
                  variant="outline" 
                  size="sm"
                  disabled={loading}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar QR
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-3 py-8">
              <Button onClick={() => generateQRCode(false)} disabled={loading}>
                <QrCode className="w-4 h-4 mr-2" />
                Gerar QR Code
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};