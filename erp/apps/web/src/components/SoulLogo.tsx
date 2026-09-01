/** Marca da Soul Muscle, reproduzida em SVG para não depender de imagem externa. */
export function SoulLogo({ className = 'h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 132 44" className={className} role="img" aria-label="Soul Muscle">
      <text
        x="0"
        y="27"
        fontFamily="Poppins, sans-serif"
        fontSize="27"
        fontWeight="700"
        letterSpacing="-0.5"
        fill="currentColor"
      >
        Soul
      </text>
      <text
        x="60"
        y="40"
        fontFamily="Poppins, sans-serif"
        fontSize="12"
        fontWeight="600"
        letterSpacing="2"
        fill="#FEA7E1"
      >
        muscle
      </text>
    </svg>
  );
}
