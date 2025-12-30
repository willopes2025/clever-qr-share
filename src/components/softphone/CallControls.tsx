import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, PhoneForwarded } from "lucide-react";

interface CallControlsProps {
  isInCall: boolean;
  isMuted: boolean;
  isSpeakerOn: boolean;
  onCall: () => void;
  onHangup: () => void;
  onMuteToggle: () => void;
  onSpeakerToggle: () => void;
  onTransfer?: () => void;
  disabled?: boolean;
}

export function CallControls({
  isInCall,
  isMuted,
  isSpeakerOn,
  onCall,
  onHangup,
  onMuteToggle,
  onSpeakerToggle,
  onTransfer,
  disabled
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      {isInCall ? (
        <>
          <Button
            variant="outline"
            size="icon"
            className={isMuted ? "bg-destructive/10 text-destructive" : ""}
            onClick={onMuteToggle}
            disabled={disabled}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>

          <Button
            variant="destructive"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={onHangup}
            disabled={disabled}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className={isSpeakerOn ? "bg-primary/10 text-primary" : ""}
            onClick={onSpeakerToggle}
            disabled={disabled}
          >
            {isSpeakerOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>

          {onTransfer && (
            <Button
              variant="outline"
              size="icon"
              onClick={onTransfer}
              disabled={disabled}
            >
              <PhoneForwarded className="h-4 w-4" />
            </Button>
          )}
        </>
      ) : (
        <Button
          className="h-12 w-12 rounded-full bg-green-600 hover:bg-green-700"
          size="icon"
          onClick={onCall}
          disabled={disabled}
        >
          <Phone className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
