import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, X, Minimize2, Maximize2 } from "lucide-react";
import { Dialpad } from "./Dialpad";
import { CallControls } from "./CallControls";
import { useSoftphone } from "@/hooks/useSoftphone";

interface SoftphoneWidgetProps {
  onClose?: () => void;
}

export function SoftphoneWidget({ onClose }: SoftphoneWidgetProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [showDialpad, setShowDialpad] = useState(true);

  const {
    activeCall,
    isRegistering,
    makeCall,
    hangup,
    toggleMute,
    formatDuration
  } = useSoftphone();

  const callState = activeCall?.status || 'idle';
  const isMuted = activeCall?.isMuted || false;
  const callDuration = activeCall?.duration || 0;

  const handleDigit = (digit: string) => {
    if (callState === 'in_progress') {
      // DTMF would be sent here
      console.log('DTMF:', digit);
    } else {
      setPhoneNumber(prev => prev + digit);
    }
  };

  const handleCall = () => {
    if (phoneNumber.trim()) {
      makeCall(phoneNumber);
    }
  };

  const handleHangup = () => {
    hangup();
    setPhoneNumber("");
  };

  const getStatusBadge = () => {
    switch (callState) {
      case 'idle':
        return <Badge variant="secondary">Disponível</Badge>;
      case 'connecting':
        return <Badge variant="outline" className="animate-pulse">Conectando...</Badge>;
      case 'ringing':
        return <Badge variant="outline" className="animate-pulse bg-yellow-500/10 text-yellow-600">Chamando...</Badge>;
      case 'in_progress':
        return <Badge className="bg-green-600">Em chamada</Badge>;
      case 'ended':
        return <Badge variant="secondary">Chamada encerrada</Badge>;
      default:
        return null;
    }
  };

  const isInCall = callState === 'in_progress';

  if (isMinimized) {
    return (
      <Card className="fixed bottom-4 right-4 w-64 shadow-lg z-50">
        <CardHeader className="p-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <span className="text-sm font-medium">Softphone</span>
          </div>
          <div className="flex items-center gap-1">
            {isInCall && (
              <span className="text-xs text-muted-foreground">
                {formatDuration(callDuration)}
              </span>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(false)}>
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        {isInCall && (
          <CardContent className="p-3 pt-0">
            <CallControls
              isInCall={true}
              isMuted={isMuted}
              isSpeakerOn={false}
              onCall={handleCall}
              onHangup={handleHangup}
              onMuteToggle={toggleMute}
              onSpeakerToggle={() => {}}
            />
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 shadow-lg z-50">
      <CardHeader className="p-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          <CardTitle className="text-base">Softphone</CardTitle>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(true)}>
            <Minimize2 className="h-3 w-3" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-4">
        {/* Display de número/duração */}
        <div className="text-center">
          {isInCall ? (
            <div>
              <p className="text-lg font-mono">{phoneNumber}</p>
              <p className="text-2xl font-bold text-primary">{formatDuration(callDuration)}</p>
            </div>
          ) : (
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Digite o número"
              className="text-center text-lg font-mono"
              disabled={callState !== 'idle'}
            />
          )}
        </div>

        {/* Dialpad */}
        {showDialpad && callState === 'idle' && (
          <div className="flex justify-center">
            <Dialpad onDigit={handleDigit} disabled={isRegistering} />
          </div>
        )}

        {/* Controles */}
        <CallControls
          isInCall={isInCall}
          isMuted={isMuted}
          isSpeakerOn={false}
          onCall={handleCall}
          onHangup={handleHangup}
          onMuteToggle={toggleMute}
          onSpeakerToggle={() => {}}
          disabled={isRegistering || (callState === 'idle' && !phoneNumber.trim())}
        />

        {/* Toggle dialpad em chamada */}
        {isInCall && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setShowDialpad(!showDialpad)}
          >
            {showDialpad ? "Ocultar teclado" : "Mostrar teclado"}
          </Button>
        )}

        {showDialpad && isInCall && (
          <div className="flex justify-center">
            <Dialpad onDigit={handleDigit} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
