import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const defaultProps: IconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function BrainIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      {/* Left hemisphere */}
      <path
        d="M12 2C9.5 2 7.5 3.5 7 5.5C5.5 5.8 4 7.2 4 9
        c0 1.5.8 2.8 2 3.5c-.3.8-.3 1.8.2 2.7c.5 1 1.5 1.6 2.5 1.8
        c.2 1.5 1.5 2.8 3.3 3"
      />
      {/* Right hemisphere */}
      <path
        d="M12 2c2.5 0 4.5 1.5 5 3.5c1.5.3 3 1.7 3 3.5
        c0 1.5-.8 2.8-2 3.5c.3.8.3 1.8-.2 2.7c-.5 1-1.5 1.6-2.5 1.8
        c-.2 1.5-1.5 2.8-3.3 3"
      />
      {/* Central fissure */}
      <line x1="12" y1="2" x2="12" y2="22" />
      {/* Neural nodes */}
      <circle cx="8" cy="9" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="9" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="9" cy="14" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="0.5" fill="currentColor" stroke="none" />
      {/* Neural connections */}
      <path d="M8 9l4 5M16 9l-4 5" strokeWidth={1.5} />
    </svg>
  );
}

export function AiIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      {/* Chip outline */}
      <rect x="5" y="5" width="14" height="14" rx="2" />
      {/* Pins top */}
      <line x1="9" y1="2" x2="9" y2="5" />
      <line x1="15" y1="2" x2="15" y2="5" />
      {/* Pins bottom */}
      <line x1="9" y1="19" x2="9" y2="22" />
      <line x1="15" y1="19" x2="15" y2="22" />
      {/* Pins left */}
      <line x1="2" y1="9" x2="5" y2="9" />
      <line x1="2" y1="15" x2="5" y2="15" />
      {/* Pins right */}
      <line x1="19" y1="9" x2="22" y2="9" />
      <line x1="19" y1="15" x2="22" y2="15" />
      {/* Inner circuit pattern */}
      <circle cx="12" cy="12" r="2" />
      <line x1="12" y1="10" x2="12" y2="7" strokeWidth={1.5} />
      <line x1="12" y1="14" x2="12" y2="17" strokeWidth={1.5} />
      <line x1="10" y1="12" x2="7" y2="12" strokeWidth={1.5} />
      <line x1="14" y1="12" x2="17" y2="12" strokeWidth={1.5} />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      {/* Shield */}
      <path
        d="M12 2L3 7v5c0 5.25 3.83 10.15 9 11
        c5.17-.85 9-5.75 9-11V7l-9-5z"
      />
      {/* Lock body */}
      <rect x="9" y="11" width="6" height="5" rx="1" />
      {/* Lock shackle */}
      <path d="M10 11V9a2 2 0 0 1 4 0v2" fill="none" />
      {/* Keyhole */}
      <circle cx="12" cy="13.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      {/* Main lightning bolt */}
      <path d="M13 2L4 14h7l-1 8l9-12h-7l1-8z" />
      {/* Speed lines */}
      <line x1="2" y1="10" x2="4" y2="10" strokeWidth={1.5} />
      <line x1="2" y1="14" x2="3.5" y2="14" strokeWidth={1.5} />
      <line x1="20" y1="10" x2="22" y2="10" strokeWidth={1.5} />
      <line x1="20.5" y1="14" x2="22" y2="14" strokeWidth={1.5} />
    </svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      {/* Outer circle */}
      <circle cx="12" cy="12" r="10" />
      {/* Latitude lines */}
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      {/* Longitude line */}
      <ellipse cx="12" cy="12" rx="4" ry="10" />
      {/* Connection nodes */}
      <circle cx="5" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="2.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="18" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="18" r="1" fill="currentColor" stroke="none" />
      {/* Node connections */}
      <line x1="5" y1="8" x2="12" y2="2.5" strokeWidth={1} />
      <line x1="19" y1="8" x2="12" y2="2.5" strokeWidth={1} />
      <line x1="7" y1="18" x2="17" y2="18" strokeWidth={1} />
    </svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      {/* Left branch splitting into merge */}
      <path d="M6 4v4c0 2 2 4 6 4" />
      <path d="M18 4v4c0 2-2 4-6 4" />
      {/* Merged line going down */}
      <line x1="12" y1="12" x2="12" y2="20" />
      {/* Arrow at top-left */}
      <circle cx="6" cy="4" r="1.5" />
      {/* Arrow at top-right */}
      <circle cx="18" cy="4" r="1.5" />
      {/* Merge point */}
      <circle cx="12" cy="12" r="1.5" />
      {/* End point */}
      <circle cx="12" cy="20" r="1.5" />
      {/* Data flow dots */}
      <circle cx="8" cy="8" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      {/* Outer gear path with teeth */}
      <path
        d="M12 1l1.5 2.6a8 8 0 0 1 2.2.9L18.5 3l1.5 1.5
        l-1.5 2.8a8 8 0 0 1 .9 2.2L22 11v2l-2.6 1.5a8 8 0 0 1
        -.9 2.2L20 19.5l-1.5 1.5l-2.8-1.5a8 8 0 0 1-2.2.9L12 23
        h-0l-1.5-2.6a8 8 0 0 1-2.2-.9L5.5 21L4 19.5l1.5-2.8a8 8
        0 0 1-.9-2.2L2 13v-2l2.6-1.5a8 8 0 0 1 .9-2.2L4 4.5
        L5.5 3l2.8 1.5a8 8 0 0 1 2.2-.9L12 1z"
      />
      {/* Center circle */}
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function ArrowsIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      {/* Top arrow going right */}
      <line x1="4" y1="8" x2="20" y2="8" />
      <polyline points="16,4 20,8 16,12" />
      {/* Bottom arrow going left */}
      <line x1="20" y1="16" x2="4" y2="16" />
      <polyline points="8,12 4,16 8,20" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3
        A7 7 0 0 0 21 12.79z"
      />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      <path
        d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0
        c0-4-4-6-4-10z"
      />
      <path
        d="M12 18a2 2 0 0 1-2-2c0-1.5 2-3 2-3
        s2 1.5 2 3a2 2 0 0 1-2 2z"
      />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18
        s-3-2-3-9"
      />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function QuestionIcon(props: IconProps) {
  return (
    <svg {...defaultProps} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path
        d="M9.09 9a3 3 0 0 1 5.83 1
        c0 2-3 3-3 3"
      />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
