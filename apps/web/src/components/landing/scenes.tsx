/**
 * Desk scenes behind the template showcase. Everything is drawn in SVG/CSS (no stock photos),
 * so it's light, sharp at any size and free to use.
 *
 *  - `bg`     fills the whole stage
 *  - `behind` sits right behind the paper (e.g. a clipboard), sized relative to it
 *  - `front`  sits on top of the paper's top edge (e.g. the clipboard clip)
 */
import { ReactNode } from 'react';

export interface Scene {
  id: string;
  name: string;
  /** light or dark text on this background */
  tone: 'light' | 'dark';
  bg: ReactNode;
  behind?: ReactNode;
  front?: ReactNode;
}

// ───────────────────────── Props (desk objects) ─────────────────────────

function Pencil({ className, color = '#2b2b2b', style }: { className?: string; color?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 40 520" aria-hidden="true">
      <defs>
        <linearGradient id={`pg-${color}`} x1="0" x2="1">
          <stop offset="0" stopColor={color} />
          <stop offset=".45" stopColor={color} stopOpacity=".75" />
          <stop offset="1" stopColor={color} />
        </linearGradient>
      </defs>
      <rect x="8" y="70" width="24" height="420" rx="2" fill={`url(#pg-${color})`} />
      <rect x="8" y="470" width="24" height="34" rx="3" fill="#c9c9c9" />
      <rect x="8" y="476" width="24" height="3" fill="#9a9a9a" />
      <rect x="8" y="494" width="24" height="3" fill="#9a9a9a" />
      <rect x="9" y="504" width="22" height="14" rx="5" fill="#e98b8b" />
      <polygon points="8,70 32,70 20,14" fill="#e8c9a0" />
      <polygon points="15.5,32 24.5,32 20,14" fill="#2b2b2b" />
    </svg>
  );
}

function Glasses({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 300 120" aria-hidden="true">
      <g fill="none" stroke="#111" strokeWidth="11" strokeLinecap="round">
        <rect x="20" y="22" width="110" height="78" rx="30" />
        <rect x="170" y="22" width="110" height="78" rx="30" />
        <path d="M130 52 Q150 36 170 52" />
        <path d="M20 40 L0 30" />
        <path d="M280 40 L300 30" />
      </g>
      <g fill="#fff" opacity=".12">
        <rect x="26" y="28" width="98" height="66" rx="26" />
        <rect x="176" y="28" width="98" height="66" rx="26" />
      </g>
    </svg>
  );
}

function Plant({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const leaves = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2;
    const r = 70 + (i % 3) * 22;
    return { x: 160 + Math.cos(a) * r * 0.7, y: 160 + Math.sin(a) * r * 0.7, rot: (a * 180) / Math.PI + 90, s: 0.8 + (i % 4) * 0.12 };
  });
  return (
    <svg className={className} style={style} viewBox="0 0 320 320" aria-hidden="true">
      {leaves.map((l, i) => (
        <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(${l.s})`}>
          <path d="M0 -46 C 22 -30, 22 10, 0 40 C -22 10, -22 -30, 0 -46 Z" fill={i % 2 ? '#3f8f3a' : '#5bab45'} />
          <path d="M0 -40 L0 36" stroke="#2f6d2b" strokeWidth="2" />
        </g>
      ))}
      <circle cx="160" cy="160" r="44" fill="#4c9b3e" />
    </svg>
  );
}

function Coffee({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 240 240" aria-hidden="true">
      <rect x="10" y="10" width="220" height="220" rx="26" fill="#d7c3a1" />
      <circle cx="120" cy="120" r="88" fill="#f4f1ec" />
      <circle cx="120" cy="120" r="70" fill="#c0392b" />
      <circle cx="120" cy="120" r="56" fill="#3b2216" />
      <circle cx="104" cy="104" r="10" fill="#6b4430" opacity=".6" />
    </svg>
  );
}

function Laptop({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 420 300" aria-hidden="true">
      <rect x="0" y="0" width="420" height="300" rx="22" fill="#2c2f36" />
      <rect x="22" y="22" width="376" height="200" rx="8" fill="#3a3e47" />
      {Array.from({ length: 4 }, (_, r) =>
        Array.from({ length: 11 }, (_, c) => <rect key={`${r}-${c}`} x={30 + c * 33} y={30 + r * 44} width="27" height="36" rx="5" fill="#23262c" />),
      )}
      <rect x="140" y="236" width="140" height="48" rx="10" fill="#35383f" />
    </svg>
  );
}

function PenCup({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const pens = ['#e74c3c', '#2d6cdf', '#1b1b1b', '#e74c3c', '#2d6cdf', '#f1c40f', '#1b1b1b'];
  return (
    <svg className={className} style={style} viewBox="0 0 220 220" aria-hidden="true">
      <circle cx="110" cy="110" r="96" fill="#3a3a3a" />
      <circle cx="110" cy="110" r="84" fill="#262626" />
      {pens.map((c, i) => {
        const a = (i / pens.length) * Math.PI * 2;
        return <circle key={i} cx={110 + Math.cos(a) * 46} cy={110 + Math.sin(a) * 46} r="20" fill={c} />;
      })}
      <circle cx="110" cy="110" r="20" fill="#7f8c8d" />
    </svg>
  );
}

function Stamp({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 160 160" aria-hidden="true">
      <circle cx="80" cy="80" r="74" fill="#c9a77c" />
      <circle cx="80" cy="80" r="56" fill="#b48f60" />
      <circle cx="80" cy="80" r="30" fill="#d8b98d" />
    </svg>
  );
}

/** Soft paper grain over flat colours, so desks don't look like plain fills */
function Grain({ opacity = 0.18 }: { opacity?: number }) {
  return (
    <svg className="absolute inset-0 h-full w-full" aria-hidden="true" style={{ opacity, mixBlendMode: 'multiply' }}>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
}

const shadow = 'drop-shadow(0 18px 18px rgb(0 0 0 / .28))';

// ───────────────────────── Scenes ─────────────────────────

export const SCENES: Scene[] = [
  {
    id: 'marble',
    name: 'Marble',
    tone: 'dark',
    bg: (
      <div className="absolute inset-0 bg-[#eef0f2]">
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true" preserveAspectRatio="none">
          <filter id="marble" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.0032 0.0085" numOctaves="5" seed="7" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="table" tableValues="1 1 .96 .3 .96 1 1 .9 1" />
              <feFuncG type="table" tableValues="1 1 .96 .3 .96 1 1 .9 1" />
              <feFuncB type="table" tableValues="1 1 .97 .33 .97 1 1 .92 1" />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#marble)" />
        </svg>
        <Plant className="absolute -bottom-16 -left-16 w-[300px] sm:w-[380px]" style={{ filter: shadow }} />
        <Pencil className="absolute top-[18%] right-[6%] hidden h-[62%] sm:block" style={{ filter: shadow }} />
      </div>
    ),
  },
  {
    id: 'clipboard',
    name: 'Clipboard',
    tone: 'dark',
    bg: (
      <div className="absolute inset-0 bg-gradient-to-br from-[#e7ebee] via-[#dde2e6] to-[#cfd5da]">
        <Grain opacity={0.12} />
      </div>
    ),
    behind: <div className="absolute -inset-x-[5%] -top-[4%] -bottom-[3%] rounded-[6px] bg-[#b8946a] shadow-[0_30px_50px_-20px_rgb(0_0_0/.45)]" />,
    front: (
      <svg className="absolute -top-[7%] left-1/2 w-[34%] -translate-x-1/2" viewBox="0 0 220 110" aria-hidden="true" style={{ filter: shadow }}>
        <defs>
          <linearGradient id="clip" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#f2f2f2" />
            <stop offset=".5" stopColor="#a9adb2" />
            <stop offset="1" stopColor="#e6e7e9" />
          </linearGradient>
        </defs>
        <rect x="10" y="58" width="200" height="46" rx="10" fill="url(#clip)" stroke="#8a8f95" />
        <path d="M70 60 C70 10, 150 10, 150 60" fill="none" stroke="#9ea3a8" strokeWidth="14" />
        <circle cx="110" cy="30" r="14" fill="#d9dbde" stroke="#8a8f95" strokeWidth="3" />
      </svg>
    ),
  },
  {
    id: 'teal',
    name: 'Teal desk',
    tone: 'light',
    bg: (
      <div className="absolute inset-0 bg-[#3f8790]">
        <Grain />
        <Pencil className="absolute bottom-[-6%] left-[12%] hidden h-[56%] rotate-[28deg] sm:block" color="#3fa34d" style={{ filter: shadow }} />
        <Glasses className="absolute top-[6%] right-[-2%] w-[260px] rotate-[-34deg] sm:w-[340px]" style={{ filter: shadow }} />
        <Coffee className="absolute bottom-[6%] left-[-40px] w-[170px]" style={{ filter: shadow }} />
      </div>
    ),
  },
  {
    id: 'lavender',
    name: 'Lavender desk',
    tone: 'dark',
    bg: (
      <div className="absolute inset-0 bg-[#aeb1ec]">
        <Grain />
        <PenCup className="absolute top-[8%] left-[4%] w-[140px] sm:w-[170px]" style={{ filter: shadow }} />
        <Pencil className="absolute bottom-[4%] left-[18%] hidden h-[48%] rotate-[4deg] sm:block" style={{ filter: shadow }} />
        <Glasses className="absolute top-[22%] right-[2%] w-[220px] rotate-[60deg] sm:w-[280px]" style={{ filter: shadow }} />
        <Stamp className="absolute right-[6%] bottom-[8%] w-[120px]" style={{ filter: shadow }} />
      </div>
    ),
  },
  {
    id: 'kraft',
    name: 'Kraft desk',
    tone: 'dark',
    bg: (
      <div className="absolute inset-0 bg-[#e3c07c]">
        <Grain opacity={0.22} />
        <Coffee className="absolute bottom-[8%] left-[2%] w-[180px]" style={{ filter: shadow }} />
        <Pencil className="absolute top-[30%] left-[16%] hidden h-[50%] sm:block" color="#1f1f1f" style={{ filter: shadow }} />
        <Laptop className="absolute right-[-70px] bottom-[10%] hidden w-[380px] rotate-[-8deg] md:block" style={{ filter: shadow }} />
        <PenCup className="absolute top-[10%] right-[4%] w-[150px]" style={{ filter: shadow }} />
      </div>
    ),
  },
  {
    id: 'slate',
    name: 'Slate desk',
    tone: 'light',
    bg: (
      <div className="absolute inset-0 bg-[#5a8496]">
        <Grain />
        <Pencil className="absolute bottom-[-4%] left-[14%] hidden h-[52%] rotate-[-30deg] sm:block" color="#4caf50" style={{ filter: shadow }} />
      </div>
    ),
    // a second sheet peeking out, like a stack of printed invoices
    behind: <div className="absolute inset-0 translate-x-[-7%] translate-y-[5%] rotate-[-6deg] rounded-[4px] bg-[#f3f4f6] shadow-[0_24px_40px_-18px_rgb(0_0_0/.45)]" />,
  },
];
