/**
 * Hand-drawn style SVG illustrations for eSignatureGO.
 * Sketchy, friendly line art with a slight wobble to feel human.
 */

interface IllustrationProps {
  className?: string;
  size?: number;
}

// Shared sketchy filter for hand-drawn feel
const SketchFilter = ({ id }: { id: string }) => (
  <defs>
    <filter id={id}>
      <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="4" seed="1" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" />
    </filter>
  </defs>
);

export function EmptyDocumentsIllustration({ className = '', size = 200 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" className={className}>
      <SketchFilter id="sketch-empty" />
      <g filter="url(#sketch-empty)">
        {/* Stack of papers */}
        <rect x="52" y="38" width="96" height="124" rx="4" fill="#f0f4ff" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 3" />
        <rect x="46" y="44" width="96" height="124" rx="4" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 3" />
        <rect x="40" y="50" width="96" height="124" rx="4" fill="white" stroke="#64748b" strokeWidth="2.5" />

        {/* Lines on paper */}
        <path d="M56 74 Q72 72 120 74" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        <path d="M56 90 Q80 88 110 90" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        <path d="M56 106 Q90 104 120 106" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        <path d="M56 122 Q68 120 96 122" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />

        {/* Pen hovering */}
        <g transform="rotate(-30, 148, 60)">
          <rect x="142" y="30" width="8" height="52" rx="2" fill="#3b82f6" stroke="#2563eb" strokeWidth="1.5" />
          <path d="M142 82 L146 92 L150 82" fill="#1e40af" stroke="#1e40af" strokeWidth="1" />
          <rect x="142" y="30" width="8" height="10" rx="1" fill="#60a5fa" />
        </g>

        {/* Small sparkle / plus sign */}
        <path d="M158 140 L158 152 M152 146 L164 146" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />

        {/* Arrow pointing up */}
        <path d="M88 158 Q88 148 88 140" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
        <path d="M82 146 L88 138 L94 146" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  );
}

export function SigningIllustration({ className = '', size = 200 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" className={className}>
      <SketchFilter id="sketch-sign" />
      <g filter="url(#sketch-sign)">
        {/* Document */}
        <rect x="35" y="30" width="100" height="130" rx="4" fill="white" stroke="#64748b" strokeWidth="2.5" />

        {/* Text lines */}
        <path d="M50 54 Q70 52 120 54" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        <path d="M50 68 Q80 66 110 68" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        <path d="M50 82 Q90 80 120 82" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />

        {/* Signature line */}
        <path d="M50 120 L120 120" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
        <text x="52" y="116" fontSize="7" fill="#94a3b8" fontFamily="serif" fontStyle="italic">sign here</text>

        {/* Hand-drawn signature */}
        <path d="M55 115 Q60 105 68 112 Q76 120 82 108 Q86 100 90 112 Q94 118 100 110 Q106 102 112 114"
          stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* Hand with pen */}
        <g transform="translate(110, 90)">
          {/* Hand outline */}
          <path d="M20 30 Q14 28 12 20 Q10 14 16 10 Q20 8 22 14 L24 8 Q26 2 30 4 Q34 6 32 12 L34 6 Q36 0 40 2 Q44 4 42 12 L42 8 Q44 2 48 4 Q52 6 50 16 L48 28 Q46 34 38 36 Q30 38 20 30Z"
            fill="#fde8d0" stroke="#c2956a" strokeWidth="1.5" />
          {/* Pen in hand */}
          <rect x="8" y="6" width="5" height="36" rx="1.5" fill="#3b82f6" stroke="#2563eb" strokeWidth="1" transform="rotate(-15, 10, 24)" />
          <path d="M5 40 L7.5 48 L10 40" fill="#1e40af" transform="rotate(-15, 7.5, 44)" />
        </g>

        {/* Checkmark circle */}
        <circle cx="155" cy="145" r="22" fill="#dcfce7" stroke="#22c55e" strokeWidth="2.5" />
        <path d="M144 145 L152 153 L167 138" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  );
}

export function SuccessIllustration({ className = '', size = 160 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" fill="none" className={className}>
      <SketchFilter id="sketch-success" />
      <g filter="url(#sketch-success)">
        {/* Envelope / document */}
        <rect x="30" y="40" width="80" height="60" rx="4" fill="white" stroke="#64748b" strokeWidth="2" />
        <path d="M30 44 L70 74 L110 44" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

        {/* Paper peeking out */}
        <rect x="40" y="28" width="60" height="30" rx="2" fill="#f0f4ff" stroke="#94a3b8" strokeWidth="1.5" />
        <path d="M50 38 Q65 36 90 38" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M50 46 Q70 44 80 46" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />

        {/* Flying checkmark */}
        <circle cx="115" cy="35" r="18" fill="#dcfce7" stroke="#22c55e" strokeWidth="2.5" />
        <path d="M106 35 L112 41 L125 28" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />

        {/* Sparkles */}
        <path d="M128 60 L130 55 L132 60 L137 58 L132 60 L134 65 L132 60 L127 62Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.5" />
        <path d="M22 55 L24 50 L26 55 L31 53 L26 55 L28 60 L26 55 L21 57Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.5" />
        <circle cx="45" cy="112" r="2" fill="#3b82f6" opacity="0.6" />
        <circle cx="100" cy="108" r="1.5" fill="#22c55e" opacity="0.6" />
        <circle cx="75" cy="118" r="2.5" fill="#f59e0b" opacity="0.5" />

        {/* Confetti lines */}
        <path d="M55 105 Q50 115 48 120" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M70 105 L72 122" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M85 105 Q90 115 92 120" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function CreditCoinIllustration({ className = '', size = 120 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" className={className}>
      <SketchFilter id="sketch-coin" />
      <g filter="url(#sketch-coin)">
        {/* Coin stack */}
        <ellipse cx="60" cy="88" rx="32" ry="10" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
        <rect x="28" y="78" width="64" height="10" fill="#fef3c7" />
        <ellipse cx="60" cy="78" rx="32" ry="10" fill="#fef9c3" stroke="#f59e0b" strokeWidth="2" />
        <rect x="28" y="68" width="64" height="10" fill="#fef9c3" />
        <ellipse cx="60" cy="68" rx="32" ry="10" fill="#fefce8" stroke="#f59e0b" strokeWidth="2" />
        <rect x="28" y="58" width="64" height="10" fill="#fefce8" />

        {/* Top coin */}
        <ellipse cx="60" cy="58" rx="32" ry="10" fill="#fef9c3" stroke="#eab308" strokeWidth="2.5" />

        {/* Dollar sign */}
        <text x="56" y="46" fontSize="28" fontWeight="bold" fill="#ca8a04" fontFamily="serif">$</text>

        {/* Sparkles */}
        <path d="M95 48 L97 43 L99 48 L104 46 L99 48 L101 53 L99 48 L94 50Z" fill="#fbbf24" />
        <path d="M20 58 L22 53 L24 58 L29 56 L24 58 L26 63 L24 58 L19 60Z" fill="#fbbf24" />

        {/* Plus flying coin */}
        <circle cx="96" cy="32" r="12" fill="#fef3c7" stroke="#eab308" strokeWidth="2" />
        <path d="M92 32 L100 32 M96 28 L96 36" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function WaitingIllustration({ className = '', size = 140 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" fill="none" className={className}>
      <SketchFilter id="sketch-wait" />
      <g filter="url(#sketch-wait)">
        {/* Clock */}
        <circle cx="70" cy="60" r="40" fill="white" stroke="#64748b" strokeWidth="2.5" />
        <circle cx="70" cy="60" r="34" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />

        {/* Clock hands */}
        <line x1="70" y1="60" x2="70" y2="38" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="70" y1="60" x2="86" y2="54" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
        <circle cx="70" cy="60" r="3" fill="#334155" />

        {/* Hour markers */}
        <circle cx="70" cy="30" r="2" fill="#94a3b8" />
        <circle cx="100" cy="60" r="2" fill="#94a3b8" />
        <circle cx="70" cy="90" r="2" fill="#94a3b8" />
        <circle cx="40" cy="60" r="2" fill="#94a3b8" />

        {/* Dotted trail */}
        <path d="M50 110 Q60 105 70 108 Q80 111 90 106" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 4" />

        {/* Small document */}
        <rect x="90" y="85" width="28" height="36" rx="2" fill="white" stroke="#94a3b8" strokeWidth="1.5" />
        <path d="M96 95 L112 95" stroke="#cbd5e1" strokeWidth="1" strokeLinecap="round" />
        <path d="M96 101 L108 101" stroke="#cbd5e1" strokeWidth="1" strokeLinecap="round" />
        <path d="M96 107 L112 107" stroke="#cbd5e1" strokeWidth="1" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function UploadIllustration({ className = '', size = 160 }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" fill="none" className={className}>
      <SketchFilter id="sketch-upload" />
      <g filter="url(#sketch-upload)">
        {/* Cloud */}
        <path d="M40 90 Q20 90 20 72 Q20 56 36 52 Q34 36 52 30 Q68 24 78 36 Q86 24 100 28 Q116 32 116 50 Q132 50 136 64 Q140 80 124 88 Q128 92 120 96 L40 96Z"
          fill="#f0f4ff" stroke="#64748b" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Arrow up */}
        <path d="M80 110 L80 68" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
        <path d="M66 82 L80 66 L94 82" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />

        {/* Document icon */}
        <rect x="68" y="116" width="24" height="30" rx="2" fill="white" stroke="#64748b" strokeWidth="2" />
        <path d="M74 126 L86 126" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M74 132 L82 132" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />

        {/* Sparkle */}
        <path d="M46 40 L48 35 L50 40 L55 38 L50 40 L52 45 L50 40 L45 42Z" fill="#3b82f6" opacity="0.6" />
        <path d="M110 38 L112 33 L114 38 L119 36 L114 38 L116 43 L114 38 L109 40Z" fill="#3b82f6" opacity="0.6" />
      </g>
    </svg>
  );
}
