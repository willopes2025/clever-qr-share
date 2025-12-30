import { Button } from "@/components/ui/button";

interface DialpadProps {
  onDigit: (digit: string) => void;
  disabled?: boolean;
}

const digits = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#']
];

export function Dialpad({ onDigit, disabled }: DialpadProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {digits.flat().map((digit) => (
        <Button
          key={digit}
          variant="outline"
          className="h-12 w-12 text-lg font-medium"
          onClick={() => onDigit(digit)}
          disabled={disabled}
        >
          {digit}
        </Button>
      ))}
    </div>
  );
}
