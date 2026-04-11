import { MapPin, ExternalLink } from "lucide-react";

interface LocationData {
  latitude: number;
  longitude: number;
  name?: string | null;
  address?: string | null;
}

const parseLocationContent = (content: string): LocationData | null => {
  // Try JSON format first (new)
  try {
    const parsed = JSON.parse(content);
    if (parsed?.type === 'location' && parsed.latitude && parsed.longitude) {
      return parsed;
    }
  } catch {}

  // Fallback: regex for old format [Localização: lat, lng]
  const match = content.match(/\[Localização:\s*([-\d.]+),\s*([-\d.]+)\]/);
  if (match) {
    return { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]) };
  }

  return null;
};

interface LocationMessageProps {
  content: string;
}

export const LocationMessage = ({ content }: LocationMessageProps) => {
  const location = parseLocationContent(content);
  if (!location) return <p className="text-[14.2px] leading-[19px]">{content}</p>;

  const { latitude, longitude, name, address } = location;
  const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=300x200&markers=${latitude},${longitude},red-pushpin`;
  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  return (
    <div className="space-y-1.5 min-w-[220px]">
      <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={mapUrl}
          alt="Localização no mapa"
          className="rounded-md w-full max-w-[300px] h-[150px] object-cover"
          loading="lazy"
        />
      </a>
      {(name || address) && (
        <div className="px-0.5">
          {name && <p className="text-[13px] font-medium leading-tight">{name}</p>}
          {address && <p className="text-[12px] text-muted-foreground leading-tight">{address}</p>}
        </div>
      )}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-[12px] text-primary hover:underline px-0.5"
      >
        <MapPin className="h-3.5 w-3.5" />
        Abrir no Google Maps
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
};
