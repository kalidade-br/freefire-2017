import React from 'react';

interface IconProps {
  className?: string;
}

export const IconBackpackSvg: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <path
      d="M11 8V6.5C11 5.1 12.1 4 13.5 4H18.5C19.9 4 21 5.1 21 6.5V8"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <rect x="7" y="8" width="18" height="19" rx="4" fill="currentColor" />
    <path d="M9 14.5H23" stroke="#181c22" strokeWidth="1.8" />
    <rect x="11" y="18" width="10" height="6" rx="1.5" fill="#181c22" fillOpacity="0.45" stroke="#181c22" strokeWidth="1.2" />
    <rect x="14" y="13" width="4" height="3" rx="0.8" fill="#181c22" />
  </svg>
);

export const IconMedkitSvg: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 8V6.5C12 5.7 12.7 5 13.5 5H18.5C19.3 5 20 5.7 20 6.5V8"
      stroke="currentColor"
      strokeWidth="2"
    />
    <rect x="5" y="8.5" width="22" height="16.5" rx="2.5" fill="currentColor" />
    <path d="M16 12V21.5M11.2 16.75H20.8" stroke="#181c22" strokeWidth="3.1" strokeLinecap="square" />
  </svg>
);

export const IconGrenadeSvg: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <path
      d="M14 5H19L22 7.5L20 10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="13" y="6.5" width="5.5" height="3.5" rx="0.8" fill="currentColor" />
    <ellipse cx="15.8" cy="18.5" rx="6.8" ry="8.2" fill="currentColor" />
    <path
      d="M10.2 15.5H21.4M10 19.5H21.6M15.8 10.8V26.2"
      stroke="#181c22"
      strokeWidth="1.4"
      strokeOpacity="0.55"
    />
    <circle cx="22.5" cy="9.5" r="2.1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const IconGlooSvg: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <path
      d="M6 10C6 7.8 7.8 6 10 6H22C24.2 6 26 7.8 26 10V24.5C26 25.3 25.3 26 24.5 26H7.5C6.7 26 6 25.3 6 24.5V10Z"
      fill="currentColor"
    />
    <path
      d="M16 9V23M10 13.5L16 10L22 13.5M10 19.5L16 23L22 19.5"
      stroke="#0f172a"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconSprintSvg: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <circle cx="19.5" cy="6.5" r="2.7" fill="currentColor" />
    <path
      d="M12.5 12.5L16.5 10.5L20 13.8L24.5 13"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.5 11.2L14 18.2L19.5 21.2L18 27.5"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.8 18.5L9.5 23.2L6 22.8"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15.8 11.5L10.5 14L8.5 17.2"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconFireBurstSvg: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
    {/* Three angled bullets + classic Free Fire impact burst rays */}
    <path
      d="M27.5 11.5L19.5 19.5L16.8 16.8L24.8 8.8C26.1 7.5 28 7.5 28.8 8.3C29.6 9.1 29.6 10.2 27.5 11.5Z"
      fill="currentColor"
    />
    <path
      d="M31.5 20.5L21 23.8L19.8 20.3L30.3 17C32 16.5 33.4 17.2 33.7 18.2C34 19.2 33.1 20 31.5 20.5Z"
      fill="currentColor"
    />
    <path
      d="M22.5 29.5L15.5 23.5L17.8 20.8L24.8 26.8C26 27.8 26.1 29.2 25.3 30C24.5 30.8 23.5 30.4 22.5 29.5Z"
      fill="currentColor"
    />
    <path
      d="M13 18.5L7.5 15.5M12 22.5L6.5 23.8M15 26L11.5 31.5"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
  </svg>
);

export const IconScopeSvg: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <circle cx="16" cy="16" r="8.5" stroke="currentColor" strokeWidth="2.3" />
    <path
      d="M16 4V9.5M16 22.5V28M4 16H9.5M22.5 16H28"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
    />
    <circle cx="16" cy="16" r="1.8" fill="currentColor" />
  </svg>
);

export const IconJumpSvg: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <circle cx="18.5" cy="6.5" r="2.4" fill="currentColor" />
    <path
      d="M12.5 12.2L17 10.5L22.5 11.5"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
    />
    <path
      d="M16.8 11L15 17.5L21 20.5L22.5 26.2"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.8 17.5L9.5 20.5L8.2 26"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M5 27.5H27" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
  </svg>
);

export const IconCrouchSvg: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <circle cx="13" cy="8.5" r="2.4" fill="currentColor" />
    <path
      d="M12.5 11.5L15 17.5L20 18.5L21 25"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.5 17.5L10.5 21.5L10.5 25.5"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Aimed Rifle */}
    <path d="M13.5 13.8H26.5M21.5 13.8V16" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
  </svg>
);

export const IconProneSvg: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <circle cx="19.5" cy="17" r="2.2" fill="currentColor" />
    <path
      d="M5 23.5L12.5 22.5L18.5 20.2L22 22.5"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Aimed Rifle Ahead */}
    <path d="M19 19.2H29.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M5 25.5H28" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.4" strokeLinecap="round" />
  </svg>
);

export const IconFistSvg: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <rect x="8.5" y="10" width="3.5" height="9" rx="1.6" fill="currentColor" />
    <rect x="12.6" y="8.5" width="3.6" height="10.5" rx="1.6" fill="currentColor" />
    <rect x="16.8" y="9" width="3.6" height="10" rx="1.6" fill="currentColor" />
    <rect x="21" y="10.5" width="3.2" height="8.5" rx="1.5" fill="currentColor" />
    <path
      d="M8.5 18.5C8.5 17 10 16 11.5 16H21C22.8 16 24.2 17.4 24.2 19.2V22C24.2 24.4 22.2 26 19.8 26H13C10.5 26 8.5 24 8.5 21.5V18.5Z"
      fill="currentColor"
    />
  </svg>
);

export const IconReloadSvg: React.FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <path
      d="M23.5 12.5C22.1 9.5 19.2 7.5 15.8 7.5C11.1 7.5 7.3 11.3 7.3 16C7.3 20.7 11.1 24.5 15.8 24.5C19.6 24.5 22.8 22 23.9 18.6"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    <path d="M25.5 7.5V13.5H19.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="14.5" y="12.5" width="2.8" height="7" rx="1" fill="currentColor" />
  </svg>
);

export const IconHelmetSvg: React.FC<IconProps> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 13C4 8.2 7.6 4.5 12 4.5C16.4 4.5 20 8.2 20 13V16.5H15.5V14H8.5V16.5H4V13Z"
      fill="currentColor"
    />
    <path d="M3 16.5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const IconVestSvg: React.FC<IconProps> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M7 4H10L12 7L14 4H17L19 9V20H5V9L7 4Z"
      fill="currentColor"
    />
    <path d="M8.5 12H15.5M8.5 15.5H15.5" stroke="#181c22" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const IconCoinSvg: React.FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="6.5" stroke="#92400e" strokeWidth="1.3" />
    <path
      d="M9.5 8.5H14.5M9.5 12H13.6M9.5 8.5V16"
      stroke="#78350f"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconVendingSvg: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="4" y="2.5" width="16" height="19" rx="2" fill="currentColor" />
    <rect x="6.5" y="5" width="7.5" height="9" rx="1" fill="#0f172a" />
    <rect x="15.5" y="5" width="2" height="5" rx="0.5" fill="#facc15" />
    <rect x="6.5" y="16" width="11" height="3" rx="0.8" fill="#0f172a" />
  </svg>
);

export const IconVehicleSvg: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M5 11L7 6.5C7.4 5.6 8.2 5 9.2 5H14.8C15.8 5 16.6 5.6 17 6.5L19 11V17.5C19 18.1 18.5 18.5 17.9 18.5H16.8C16.2 18.5 15.8 18.1 15.8 17.5V16.5H8.2V17.5C8.2 18.1 7.8 18.5 7.2 18.5H6.1C5.5 18.5 5 18.1 5 17.5V11Z"
      fill="currentColor"
    />
    <path d="M7.5 10.5L8.6 7.2H15.4L16.5 10.5H7.5Z" fill="#0f172a" />
    <circle cx="8" cy="13.5" r="1.2" fill="#fde047" />
    <circle cx="16" cy="13.5" r="1.2" fill="#fde047" />
  </svg>
);

export const RankEmblemSvg: React.FC<{
  color: string;
  accent: string;
  className?: string;
}> = ({ color, accent, className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
    <path
      d="M20 3L34 10V22C34 29.5 27.8 35.4 20 38C12.2 35.4 6 29.5 6 22V10L20 3Z"
      fill={color}
      stroke={accent}
      strokeWidth="2.2"
    />
    <path
      d="M20 8L29 12.8V21.5C29 26.8 25 31.2 20 33.2C15 31.2 11 26.8 11 21.5V12.8L20 8Z"
      fill="#11161d"
      fillOpacity="0.65"
    />
    <path
      d="M20 11.5L22.5 17L28.5 17.6L23.8 21.5L25.3 27.3L20 24.1L14.7 27.3L16.2 21.5L11.5 17.6L17.5 17L20 11.5Z"
      fill={accent}
    />
  </svg>
);
