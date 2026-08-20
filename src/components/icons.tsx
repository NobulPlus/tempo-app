import type { SVGProps } from "react";

/**
 * Icon set lifted from the original prototype so the visual identity carries
 * over exactly. Same paths, same weights — just typed and reusable.
 */

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = ({ size = 20, ...rest }: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  ...rest,
});

export const TempoMark = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M4 9a3 3 0 0 1 3-3h9.5a3.5 3.5 0 1 1 0 7H15l-2.2 3.3A3 3 0 0 1 10.3 18H7a3 3 0 0 1-3-3V9zm12.5 2a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
  </svg>
);

export const HomeIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M12 3 3 10.5V21h6v-6h6v6h6V10.5L12 3z" />
  </svg>
);

export const PitchIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M15 5.1 9 3 3.6 4.8A1 1 0 0 0 3 5.7V20l6-2.1 6 2.1 5.4-1.8a1 1 0 0 0 .6-.9V3l-6 2.1z" />
  </svg>
);

export const BallIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="12" r="9" />
    <path d="m12 7 4 2.9-1.5 4.7h-5L8 9.9 12 7z" />
  </svg>
);

export const BallDetailedIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth={1.1}>
    <circle cx="12" cy="12" r="10" />
    <path d="m12 5.6 4.6 3.4-1.8 5.5H9.2L7.4 9 12 5.6z" />
    <path d="M12 2v3.6M2.6 9 7.4 9M21.4 9l-4.8 0M6.2 20.4 9.2 14.5M17.8 20.4l-3-5.9" />
  </svg>
);

export const UserIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
  </svg>
);

export const UsersIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <circle cx="8" cy="9" r="3" />
    <circle cx="17" cy="10" r="2.4" />
    <path d="M2 19c0-3 2.7-4.6 6-4.6S14 16 14 19M14.6 19c0-2.3 1.4-3.8 3.6-3.8S22 16.7 22 19" />
  </svg>
);

export const GroupIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <circle cx="7" cy="9" r="2.6" />
    <circle cx="12" cy="7.6" r="2.6" />
    <circle cx="17" cy="9" r="2.6" />
    <path d="M2 18.5c0-2.6 2.2-4 5-4s5 1.4 5 4M12 18.5c0-2.6 2.2-4 5-4s5 1.4 5 4" />
  </svg>
);

export const PinIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
  </svg>
);

export const ClockIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.5l3.5 2" />
  </svg>
);

export const CalendarIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 8v9H5v-9h14z" />
  </svg>
);

export const ShieldIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3zm-1 14-4-4 1.4-1.4L11 13.2l4.6-4.6L17 10l-6 6z" />
  </svg>
);

export const SearchIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth={2.4}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const ArrowRightIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth={2.2}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);

export const MenuIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const BellIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22zm7-6v-5a7 7 0 0 0-5.3-6.8V3.5a1.7 1.7 0 1 0-3.4 0v.7A7 7 0 0 0 5 11v5l-1.6 1.6v.9h17.2v-.9L19 16z" />
  </svg>
);

export const StarIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="m12 17.3-6.2 3.7 1.7-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.5 4.8 1.7 7z" />
  </svg>
);

export const FlameIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M12 2s1.5 3.2 1.5 5.2c0 1.4-.9 2.3-2 2.3-1.4 0-2.2-1.1-2-2.7C7.3 8.5 6 11 6 13.5A6 6 0 0 0 18 14c0-4.2-3.5-7.4-6-12z" />
  </svg>
);

export const LightningIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
  </svg>
);

export const CheckIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth={2.4}>
    <path d="M4 12.5 9.5 18 20 6.5" />
  </svg>
);

export const TrendIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M3 17 9.5 10.5l3.5 3.5L21 6" />
    <path d="M15 6h6v6" />
  </svg>
);

export const LightsIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <circle cx="12" cy="12" r="4" />
    <path
      d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
      stroke="currentColor"
      strokeWidth={1.8}
    />
  </svg>
);

export const ShowerIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M4 11h16v2H4zM6 4h12v2H6z" />
    <circle cx="8" cy="17" r="1" />
    <circle cx="12" cy="19" r="1" />
    <circle cx="16" cy="17" r="1" />
  </svg>
);

export const ParkingIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M6 3h6a5 5 0 0 1 0 10H9v8H6V3zm3 3v4h3a2 2 0 1 0 0-4H9z" />
  </svg>
);

export const MailIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 7L4.4 6.5 4 6v.6l8 4.7 8-4.7V6l-.4.5L12 11z" />
  </svg>
);

export const LockIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V6a3 3 0 0 1 3-3z" />
  </svg>
);

export const PhoneIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.2.2 2.4.57 3.5a1 1 0 0 1-.25 1l-2.22 2.3z" />
  </svg>
);

export const EyeIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M12 5c-5 0-9.3 3.1-11 7 1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
  </svg>
);

export const BuildingIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M3 21V9l9-6 9 6v12h-7v-6h-4v6H3z" />
  </svg>
);

export const CarIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h1a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h1zm2.1 0h9.8l-1-3H8.1l-1 3zM7 13.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm10 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z" />
  </svg>
);

export const QuoteIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M4 8.5C4 6 6 4 9 4v2.6c-1.5.3-2.4 1.2-2.6 2.4H9V13H4V8.5zm9 0C13 6 15 4 18 4v2.6c-1.5.3-2.4 1.2-2.6 2.4H18V13h-5V8.5z" />
  </svg>
);

/**
 * Doodle set — deliberately looser, hand-drawn line weight, reserved for the
 * "how it works" storytelling section only (the Footy Addicts pattern).
 * Everything else keeps the precise functional set above.
 */
export const DoodleFindIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 17 8 8.5c1-.3 2 .2 2.6 1.2l3 6" />
    <circle cx="16.5" cy="7.5" r="3.2" />
    <path d="M14.7 5.8c.6.6 1.7.6 2.3 0M14.9 8.6c1.1.5 2.2.3 3-.4" />
    <path d="M4 19.5c4-1.5 12-1.5 16 0" strokeDasharray="1 3.2" />
  </svg>
);

export const DoodleBookIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3.5c-1 3-1 14 0 17M8.5 4.2c1.5 1 1.5 15.6 0 16.6M15.5 4.2c-1.5 1-1.5 15.6 0 16.6" />
    <path d="M12.4 11.6 15 9.2M12.4 12.4 15 14.8" />
  </svg>
);

export const DoodlePlayIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6.5c3-2.5 9-2.5 12 .3M4.5 12c3.8-2.8 11.2-2.8 15 0M7 17.3c2.2-1.8 7.8-1.8 10 0" />
    <path d="M17.5 6.5 19 5M18 12.2h2M16.7 17.6l1.3 1.2" />
  </svg>
);

export const WhatsAppIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.3-.5 0-1.1.2-3.6-.8-3-1.3-4.9-4.4-5-4.6-.2-.2-1.2-1.6-1.2-3s.8-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .5 0 .7.5l.9 2.2c.1.2.1.4 0 .6l-.5.7c-.1.2-.3.3-.1.6.2.3.8 1.4 1.8 2.3 1.3 1.1 2.3 1.5 2.6 1.6.3.1.4.1.6-.1l.9-1c.2-.2.4-.2.6-.1l2.1 1c.2.1.4.2.4.3.1.2.1.6-.1 1.3z" />
  </svg>
);
