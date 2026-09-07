/**
 * PetArt — hand-drawn kawaii SVG artwork kit. Zero deps, offline-safe,
 * theme-matched (cream / teal / amber / ink). Decorative: aria-hidden.
 *
 * Usage: <PetArt name="lost" size={160} />
 */
export type PetArtName =
  | "lost" // 404 — puppy + question mark
  | "sleepy" // empty lists — curled cat + Zzz
  | "happy" // success/done — jumping pup + hearts
  | "mail" // magic link / reminders — envelope + paw seal
  | "camera" // upload — camera + paw + sparkles
  | "box" // vault/docs — open box + papers
  | "rocket" // onboarding done — rocket pup
  | "siren" // errors — pup with cone + cross
  | "clock" // reminders — alarm clock + paw
  | "link"; // share — chain link + heart

const INK = "#1C1917";
const TEAL = "#0D9488";
const TEAL_DARK = "#0F766E";
const AMBER = "#F59E0B";
const AMBER_SOFT = "#FCD34D";
const CREAM = "#FFFBF5";
const BLUSH = "#FDA4AF";

function PupFace({ x = 60, y = 66 }: { x?: number; y?: number }) {
  return (
    <g>
      {/* ears */}
      <ellipse cx={x - 24} cy={y - 10} rx={9} ry={16} fill={TEAL_DARK} transform={`rotate(18 ${x - 24} ${y - 10})`} />
      <ellipse cx={x + 24} cy={y - 10} rx={9} ry={16} fill={TEAL_DARK} transform={`rotate(-18 ${x + 24} ${y - 10})`} />
      {/* head */}
      <ellipse cx={x} cy={y} rx={24} ry={21} fill={AMBER_SOFT} />
      {/* muzzle */}
      <ellipse cx={x} cy={y + 9} rx={11} ry={8} fill={CREAM} />
      {/* eyes */}
      <circle cx={x - 9} cy={y - 3} r={2.6} fill={INK} />
      <circle cx={x + 9} cy={y - 3} r={2.6} fill={INK} />
      <circle cx={x - 8.2} cy={y - 3.8} r={0.9} fill={CREAM} />
      <circle cx={x + 9.8} cy={y - 3.8} r={0.9} fill={CREAM} />
      {/* blush */}
      <ellipse cx={x - 15} cy={y + 4} rx={3.4} ry={2.2} fill={BLUSH} opacity={0.8} />
      <ellipse cx={x + 15} cy={y + 4} rx={3.4} ry={2.2} fill={BLUSH} opacity={0.8} />
      {/* nose + mouth */}
      <ellipse cx={x} cy={y + 7} rx={3.4} ry={2.6} fill={INK} />
      <path d={`M ${x} ${y + 9.5} Q ${x - 4} ${y + 13} ${x - 7} ${y + 11.5} M ${x} ${y + 9.5} Q ${x + 4} ${y + 13} ${x + 7} ${y + 11.5}`} stroke={INK} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </g>
  );
}

function CatCurl({ x = 60, y = 70 }: { x?: number; y?: number }) {
  return (
    <g>
      {/* tail curl */}
      <path d={`M ${x - 26} ${y + 8} Q ${x - 38} ${y + 2} ${x - 30} ${y - 12} Q ${x - 24} ${y - 20} ${x - 16} ${y - 14}`} stroke={TEAL} strokeWidth={7} fill="none" strokeLinecap="round" />
      {/* body */}
      <ellipse cx={x} cy={y} rx={26} ry={18} fill={TEAL} />
      {/* head */}
      <circle cx={x + 16} cy={y - 12} r={13} fill={TEAL} />
      {/* ears */}
      <polygon points={`${x + 6},${y - 20} ${x + 9},${y - 30} ${x + 14},${y - 21}`} fill={TEAL_DARK} />
      <polygon points={`${x + 19},${y - 22} ${x + 24},${y - 30} ${x + 27},${y - 20}`} fill={TEAL_DARK} />
      {/* closed happy eyes */}
      <path d={`M ${x + 10} ${y - 13} Q ${x + 13} ${y - 11} ${x + 16} ${y - 13}`} stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <path d={`M ${x + 20} ${y - 13} Q ${x + 23} ${y - 11} ${x + 26} ${y - 13}`} stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <ellipse cx={x + 7} cy={y - 8} rx={2.6} ry={1.8} fill={BLUSH} opacity={0.8} />
      {/* stripes */}
      <path d={`M ${x - 14} ${y - 12} l 0 6 M ${x - 8} ${y - 13} l 0 6`} stroke={TEAL_DARK} strokeWidth={2.4} strokeLinecap="round" />
    </g>
  );
}

function PawPrint({ x, y, s = 1, fill = INK }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill} opacity={0.9}>
      <ellipse cx={0} cy={2} rx={4.6} ry={3.8} />
      <circle cx={-5.4} cy={-3.4} r={2.2} />
      <circle cx={-1.8} cy={-5.4} r={2.2} />
      <circle cx={1.8} cy={-5.4} r={2.2} />
      <circle cx={5.4} cy={-3.4} r={2.2} />
    </g>
  );
}

function Heart({ x, y, s = 1, fill = "#F43F5E" }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <path
      d={`M ${x} ${y + 4 * s} C ${x - 8 * s} ${y - 3 * s} ${x - 4 * s} ${y - 8 * s} ${x} ${y - 3.5 * s} C ${x + 4 * s} ${y - 8 * s} ${x + 8 * s} ${y - 3 * s} ${x} ${y + 4 * s} Z`}
      fill={fill}
    />
  );
}

function Sparkle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      d={`M ${x} ${y - 6 * s} Q ${x + 1.4 * s} ${y - 1.4 * s} ${x + 6 * s} ${y} Q ${x + 1.4 * s} ${y + 1.4 * s} ${x} ${y + 6 * s} Q ${x - 1.4 * s} ${y + 1.4 * s} ${x - 6 * s} ${y} Q ${x - 1.4 * s} ${y - 1.4 * s} ${x} ${y - 6 * s} Z`}
      fill={AMBER}
    />
  );
}

const SCENES: Record<PetArtName, React.ReactNode> = {
  lost: (
    <g>
      <text x={88} y={42} fontSize={34} fontWeight={800} fill={TEAL} fontFamily="inherit">?</text>
      <PupFace x={52} y={72} />
      {/* magnifier */}
      <circle cx={88} cy={82} r={11} fill="none" stroke={INK} strokeWidth={3.4} />
      <line x1={96} y1={90} x2={104} y2={98} stroke={INK} strokeWidth={4} strokeLinecap="round" />
    </g>
  ),
  sleepy: (
    <g>
      <CatCurl />
      <text x={88} y={34} fontSize={16} fontWeight={800} fill={TEAL} fontFamily="inherit">z</text>
      <text x={96} y={24} fontSize={12} fontWeight={800} fill={TEAL} opacity={0.7} fontFamily="inherit">z</text>
      <text x={102} y={16} fontSize={9} fontWeight={800} fill={TEAL} opacity={0.45} fontFamily="inherit">z</text>
    </g>
  ),
  happy: (
    <g>
      <PupFace x={60} y={66} />
      <Heart x={26} y={30} s={1.1} />
      <Heart x={94} y={26} s={0.8} />
      <Heart x={100} y={58} s={0.6} fill={BLUSH} />
      <Sparkle x={24} y={66} />
      {/* party hat */}
      <polygon points="52,40 68,40 60,22" fill={TEAL} />
      <circle cx={60} cy={22} r={3.4} fill={AMBER} />
    </g>
  ),
  mail: (
    <g>
      <rect x={26} y={46} width={68} height={46} rx={8} fill={CREAM} stroke={INK} strokeWidth={3} />
      <path d="M 28 50 L 60 72 L 92 50" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(60 34)">
        <circle r={13} fill={AMBER} />
        <PawPrint x={0} y={1} s={0.85} fill={CREAM} />
      </g>
      <Heart x={94} y={96} s={0.7} />
    </g>
  ),
  camera: (
    <g>
      <rect x={26} y={48} width={68} height={44} rx={10} fill={TEAL} />
      <rect x={46} y={40} width={28} height={12} rx={4} fill={TEAL_DARK} />
      <circle cx={60} cy={70} r={15} fill={CREAM} />
      <circle cx={60} cy={70} r={9} fill={INK} />
      <circle cx={63} cy={67} r={3} fill={CREAM} />
      <PawPrint x={88} y={40} s={0.7} fill={AMBER} />
      <Sparkle x={26} y={36} />
      <Sparkle x={98} y={64} s={0.7} />
    </g>
  ),
  box: (
    <g>
      {/* papers */}
      <rect x={44} y={30} width={32} height={40} rx={3} fill={CREAM} stroke={INK} strokeWidth={2.4} transform="rotate(-6 60 50)" />
      <rect x={52} y={28} width={32} height={40} rx={3} fill={CREAM} stroke={INK} strokeWidth={2.4} transform="rotate(7 68 48)" />
      <PawPrint x={62} y={46} s={0.9} fill={TEAL} />
      {/* box */}
      <polygon points="30,66 60,78 90,66 90,96 30,96" fill={AMBER} />
      <polygon points="30,66 60,78 90,66 60,54" fill={AMBER_SOFT} />
      <polygon points="30,66 60,78 60,108 30,96" fill={TEAL_DARK} opacity={0.25} />
      {/* flaps */}
      <polygon points="30,66 18,56 44,56 60,66" fill={AMBER_SOFT} stroke={INK} strokeWidth={2} />
      <polygon points="90,66 102,56 76,56 60,66" fill={AMBER_SOFT} stroke={INK} strokeWidth={2} />
    </g>
  ),
  rocket: (
    <g>
      {/* flames */}
      <polygon points="52,92 60,108 68,92" fill={AMBER} />
      <polygon points="55,92 60,102 65,92" fill="#F43F5E" />
      {/* body */}
      <ellipse cx={60} cy={62} rx={18} ry={28} fill={TEAL} />
      <circle cx={60} cy={56} r={10} fill={CREAM} stroke={INK} strokeWidth={2.4} />
      {/* pup pilot */}
      <circle cx={60} cy={57} r={6.4} fill={AMBER_SOFT} />
      <circle cx={57.6} cy={56.4} r={1.2} fill={INK} />
      <circle cx={62.4} cy={56.4} r={1.2} fill={INK} />
      <ellipse cx={51} cy={54} rx={3} ry={5.4} fill={TEAL_DARK} />
      <ellipse cx={69} cy={54} rx={3} ry={5.4} fill={TEAL_DARK} />
      {/* nose + fins */}
      <polygon points="60,28 68,44 52,44" fill={AMBER} />
      <polygon points="43,74 36,88 46,82" fill={AMBER} />
      <polygon points="77,74 84,88 74,82" fill={AMBER} />
      <Sparkle x={28} y={40} s={0.8} />
      <Sparkle x={94} y={46} s={0.6} />
    </g>
  ),
  siren: (
    <g>
      {/* cone */}
      <polygon points="60,18 34,66 86,66" fill={CREAM} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <polygon points="60,18 48,44 72,44" fill={BLUSH} opacity={0.7} />
      {/* face through cone */}
      <circle cx={53} cy={56} r={2.2} fill={INK} />
      <circle cx={67} cy={56} r={2.2} fill={INK} />
      <ellipse cx={60} cy={61} rx={3} ry={2.2} fill={INK} />
      {/* cross badge */}
      <g transform="translate(88 84)">
        <circle r={12} fill={CREAM} stroke={INK} strokeWidth={2.6} />
        <rect x={-3} y={-7} width={6} height={14} rx={2} fill="#F43F5E" />
        <rect x={-7} y={-3} width={14} height={6} rx={2} fill="#F43F5E" />
      </g>
    </g>
  ),
  clock: (
    <g>
      {/* bells */}
      <circle cx={40} cy={30} r={7} fill={AMBER} stroke={INK} strokeWidth={2.6} />
      <circle cx={80} cy={30} r={7} fill={AMBER} stroke={INK} strokeWidth={2.6} />
      {/* face */}
      <circle cx={60} cy={64} r={28} fill={CREAM} stroke={INK} strokeWidth={3.2} />
      {/* paw hands */}
      <line x1={60} y1={64} x2={60} y2={46} stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
      <line x1={60} y1={64} x2={73} y2={70} stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
      <PawPrint x={60} y={64} s={0.8} fill={TEAL} />
      {/* legs */}
      <line x1={46} y1={88} x2={42} y2={98} stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
      <line x1={74} y1={88} x2={78} y2={98} stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
    </g>
  ),
  link: (
    <g>
      {/* chain */}
      <rect x={30} y={52} width={30} height={20} rx={10} fill="none" stroke={TEAL} strokeWidth={7} />
      <rect x={60} y={52} width={30} height={20} rx={10} fill="none" stroke={TEAL_DARK} strokeWidth={7} />
      <Heart x={60} y={30} s={1} />
      <Sparkle x={28} y={88} s={0.8} />
      <Sparkle x={94} y={86} s={0.6} />
    </g>
  ),
};

export function PetArt({
  name,
  size = 120,
  className,
}: {
  name: PetArtName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      <circle cx={60} cy={60} r={54} fill="#F7EFE2" />
      <circle cx={60} cy={60} r={54} fill="none" stroke={INK} strokeOpacity={0.08} strokeWidth={2} />
      {SCENES[name]}
    </svg>
  );
}
