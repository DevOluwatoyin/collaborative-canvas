import type { SVGProps } from "react";

/**
 * Single-weight line icons drawn on a 24px grid, stroked with currentColor so
 * one set works on both the light panels and the blue selected state.
 */
function Svg({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export type IconProps = SVGProps<SVGSVGElement>;

export const CursorIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3l14 8-6 1.6L9.6 19z" fill="currentColor" stroke="none" />
  </Svg>
);

export const HandIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 12V5.5a1.5 1.5 0 013 0V11" />
    <path d="M11 11V4.5a1.5 1.5 0 013 0V11" />
    <path d="M14 11V6.5a1.5 1.5 0 013 0V13" />
    <path d="M17 9.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1.5a6 6 0 01-6-6v-1l-1.6-2.8a1.5 1.5 0 012.6-1.5L8 12" />
  </Svg>
);

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16.5 3.9a2.1 2.1 0 013 3L8 18.4l-4 1 1-4z" />
    <path d="M14.5 5.9l3.6 3.6" />
  </Svg>
);

export const TextIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 6h14" />
    <path d="M12 6v13" />
  </Svg>
);

export const NoteIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 5h14v9l-5 5H5z" />
    <path d="M19 14h-5v5" />
  </Svg>
);

export const ImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.4" />
    <path d="M4 17l4.5-4.5 3.5 3.5 3-3 4.5 4.5" />
  </Svg>
);

export const MicIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="10" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0013 0" />
    <path d="M12 17.5V21" />
  </Svg>
);

export const PhysicsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-28 12 12)" />
  </Svg>
);

export const ChevronUpIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 14.5l6-6 6 6" />
  </Svg>
);

export const UndoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9h10a5 5 0 010 10h-4" />
    <path d="M8 5L4 9l4 4" />
  </Svg>
);

export const RedoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 9H10a5 5 0 000 10h4" />
    <path d="M16 5l4 4-4 4" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 7h15" />
    <path d="M9.5 7V4.8h5V7" />
    <path d="M6.5 7l.9 12.2A1.5 1.5 0 008.9 20.6h6.2a1.5 1.5 0 001.5-1.4L17.5 7" />
    <path d="M10.5 11v6M13.5 11v6" />
  </Svg>
);

export const DuplicateIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 5H6a2 2 0 00-2 2v9" />
  </Svg>
);

export const MoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
);

export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const ShareIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="17.5" cy="6" r="2.5" />
    <circle cx="6.5" cy="12" r="2.5" />
    <circle cx="17.5" cy="18" r="2.5" />
    <path d="M15.3 7.3L8.7 10.7M8.7 13.3l6.6 3.4" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const MinusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const HistoryIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 12a8.5 8.5 0 108.5-8.5A8.5 8.5 0 004.7 7.5" />
    <path d="M3.5 3.8v4h4" />
    <path d="M12 8v4.5l3 1.8" />
  </Svg>
);

export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v10" />
    <path d="M8 10.5l4 4 4-4" />
    <path d="M5 19h14" />
  </Svg>
);

export const HelpIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.7 9.4A2.4 2.4 0 0114.4 10c0 1.6-2.4 1.9-2.4 3.4" />
    <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
  </Svg>
);

export const SunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M3 12h2M19 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
  </Svg>
);

export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 14.5A8.5 8.5 0 019.5 3.5a7 7 0 1011 11z" />
  </Svg>
);

export const RadarIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 12l6-4.5" />
  </Svg>
);

export const SelectAllIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
  </Svg>
);

export const BringToFrontIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8" y="8" width="9" height="9" rx="1.5" fill="currentColor" stroke="none" />
    <path d="M5 15V6a1 1 0 011-1h9" />
  </Svg>
);

export const SendToBackIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="5" width="9" height="9" rx="1.5" fill="currentColor" stroke="none" />
    <path d="M10 19h8a1 1 0 001-1v-8" />
  </Svg>
);

export const SpawnIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="2" />
    <circle cx="17" cy="8" r="2.5" />
    <circle cx="8" cy="17" r="2.5" />
    <circle cx="17" cy="17" r="1.6" />
  </Svg>
);

/* Shape kinds, drawn as filled silhouettes to match the reference picker. */

export const SquareIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" />
  </Svg>
);

export const CircleIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7.5" />
  </Svg>
);

export const TriangleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.5l8 15H4z" />
  </Svg>
);

export const ExitIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" />
    <path d="M10 8l-4 4 4 4" />
    <path d="M6 12h9" />
  </Svg>
);

export const SignOutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3a9 9 0 106.4 15.3" />
    <path d="M12 3v9" />
  </Svg>
);

export const FitViewIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
    <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
  </Svg>
);

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.5l11 6.5-11 6.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7" y="5" width="3.4" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="13.6" y="5" width="3.4" height="14" rx="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const SkipBackIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11.5 6.5l-7 5.5 7 5.5z" fill="currentColor" stroke="none" />
    <path d="M19.5 6.5l-7 5.5 7 5.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const SkipForwardIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12.5 6.5l7 5.5-7 5.5z" fill="currentColor" stroke="none" />
    <path d="M4.5 6.5l7 5.5-7 5.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const BoldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 5h5.5a3.5 3.5 0 010 7H7z" />
    <path d="M7 12h6.5a3.5 3.5 0 010 7H7z" />
  </Svg>
);

export const ItalicIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 5h-5M14 19H9M13.5 5l-3 14" />
  </Svg>
);

export const AlignLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />
  </Svg>
);

export const AlignCenterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />
  </Svg>
);

export const AlignRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />
  </Svg>
);

export const SlidersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

/** App mark, matching app/icon.svg. Used where the wordmark will not fit. */
export const LogoMark = (props: IconProps) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 64 64"
    role="img"
    aria-label="Orbitboard"
    {...props}
  >
    <rect width="64" height="64" rx="14" fill="#0d9f90" />
    <ellipse
      cx="32"
      cy="32"
      rx="24"
      ry="10"
      fill="none"
      stroke="#06201d"
      strokeWidth="3.5"
      opacity="0.55"
      transform="rotate(-28 32 32)"
    />
    <circle cx="32" cy="32" r="9" fill="#06201d" />
    <circle cx="49" cy="21" r="4" fill="#e85d4c" />
  </svg>
);
