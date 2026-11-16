import React from 'react';
import { WeaponId } from '../game/types';

interface WeaponIconProps {
  weaponId: WeaponId;
  className?: string;
  silhouette?: boolean;
}

export const WeaponIcon: React.FC<WeaponIconProps> = ({
  weaponId,
  className = 'w-24 h-8',
  silhouette = false,
}) => {
  const silClass = silhouette ? 'brightness-[2.1] grayscale contrast-125' : '';
  switch (weaponId) {
    case 'g18':
      // Compact tactical Glock G18 handgun silhouette
      return (
        <svg
          viewBox="0 0 180 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${className} ${silClass}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="g18Body" x1="0" y1="0" x2="180" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#d8dee8" />
              <stop offset="55%" stopColor="#8b95a5" />
              <stop offset="100%" stopColor="#4f5866" />
            </linearGradient>
          </defs>
          {/* Slide */}
          <rect x="48" y="13" width="76" height="11" rx="1.5" fill="url(#g18Body)" stroke="#1b2028" strokeWidth="1.5" />
          {/* Rear & front sight */}
          <rect x="52" y="10" width="5" height="3" fill="#e2e8f0" stroke="#1b2028" strokeWidth="1" />
          <rect x="116" y="10" width="4" height="3" fill="#ef4444" stroke="#1b2028" strokeWidth="1" />
          {/* Ejection port */}
          <rect x="82" y="15" width="14" height="4" rx="0.8" fill="#323a46" />
          {/* Polymer lower frame + rail */}
          <rect x="52" y="24" width="68" height="6" rx="1" fill="#646e7d" stroke="#1b2028" strokeWidth="1.4" />
          {/* Trigger guard & trigger */}
          <path d="M74 30H94V39H74V30Z" fill="none" stroke="#1b2028" strokeWidth="2.2" />
          <path d="M84 30L82 37" stroke="#cfd6e0" strokeWidth="2" strokeLinecap="round" />
          {/* Angled grip + extended 15-rd mag baseplate */}
          <path d="M52 29H68L61 50H46L52 29Z" fill="#525b68" stroke="#1b2028" strokeWidth="1.5" />
          <rect x="45" y="48" width="17" height="4" rx="1" fill="#9ca6b5" stroke="#1b2028" strokeWidth="1.2" />
        </svg>
      );

    case 'm4a1':
      // Classic tactical carbine silhouette (stock, receiver, carry rail/optic, mag, handguard, barrel + muzzle)
      return (
        <svg
          viewBox="0 0 180 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${className} ${silClass}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="m4Body" x1="0" y1="0" x2="180" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#d4d8df" />
              <stop offset="55%" stopColor="#9aa3b2" />
              <stop offset="100%" stopColor="#5b6472" />
            </linearGradient>
          </defs>
          {/* Buffer tube & adjustable stock */}
          <path
            d="M8 22H36V32H22L10 42H6L8 22Z"
            fill="url(#m4Body)"
            stroke="#1b2028"
            strokeWidth="1.5"
          />
          {/* Upper/lower receiver + rail + red-dot */}
          <rect x="36" y="20" width="44" height="12" rx="1.5" fill="url(#m4Body)" stroke="#1b2028" strokeWidth="1.4" />
          <rect x="46" y="13" width="24" height="6" rx="1.2" fill="#e5a93c" stroke="#1b2028" strokeWidth="1.2" />
          <rect x="53" y="15" width="10" height="2.5" fill="#18202c" />
          {/* Pistol grip */}
          <path d="M40 32H49L44 48H35L40 32Z" fill="#7d8696" stroke="#1b2028" strokeWidth="1.4" />
          {/* Curved STANAG magazine */}
          <path d="M62 32H74L79 50H67L62 32Z" fill="#b4bcc8" stroke="#1b2028" strokeWidth="1.4" />
          {/* Handguard */}
          <rect x="80" y="21" width="42" height="9" rx="1.5" fill="url(#m4Body)" stroke="#1b2028" strokeWidth="1.4" />
          <path d="M86 24H116M86 27H116" stroke="#303846" strokeWidth="1.3" strokeLinecap="round" />
          {/* Front sight post */}
          <path d="M124 14L130 14L132 21H123L124 14Z" fill="#c7ced8" stroke="#1b2028" strokeWidth="1.2" />
          {/* Outer barrel & flash hider */}
          <rect x="122" y="23.5" width="44" height="4" fill="#cfd5df" stroke="#1b2028" strokeWidth="1.2" />
          <rect x="164" y="22.5" width="10" height="6" rx="1" fill="#e2e7ef" stroke="#1b2028" strokeWidth="1.2" />
        </svg>
      );

    case 'ump45':
      // Compact SMG silhouette (folding skeleton stock, boxy receiver, straight stick mag, short barrel)
      return (
        <svg
          viewBox="0 0 180 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${className} ${silClass}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="umpBody" x1="0" y1="0" x2="180" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#cfd6e0" />
              <stop offset="60%" stopColor="#8c96a6" />
              <stop offset="100%" stopColor="#525b68" />
            </linearGradient>
          </defs>
          {/* Skeleton folding stock */}
          <path
            d="M14 21H42V25H22V35H42V39H14L11 30L14 21Z"
            fill="url(#umpBody)"
            stroke="#1b2028"
            strokeWidth="1.5"
          />
          {/* Compact upper + shroud */}
          <rect x="42" y="18" width="76" height="14" rx="2" fill="url(#umpBody)" stroke="#1b2028" strokeWidth="1.5" />
          {/* Top rail & micro sight */}
          <rect x="52" y="13" width="38" height="4.5" rx="1" fill="#aab3c2" stroke="#1b2028" strokeWidth="1.1" />
          <rect x="64" y="10" width="12" height="3.5" rx="1" fill="#38bdf8" stroke="#1b2028" strokeWidth="1.1" />
          {/* Pistol grip */}
          <path d="M52 32H62L57 48H47L52 32Z" fill="#768091" stroke="#1b2028" strokeWidth="1.4" />
          {/* Straight SMG stick magazine */}
          <path d="M80 32H91L93 52H82L80 32Z" fill="#bcc4d1" stroke="#1b2028" strokeWidth="1.4" />
          {/* Angled foregrip */}
          <path d="M104 32H113L110 42H103L104 32Z" fill="#6d7686" stroke="#1b2028" strokeWidth="1.2" />
          {/* Barrel + tactical suppressor/muzzle */}
          <rect x="118" y="22.5" width="38" height="6" rx="1.5" fill="#d5dce6" stroke="#1b2028" strokeWidth="1.3" />
          <rect x="155" y="23.5" width="8" height="4" rx="1" fill="#9ba5b5" stroke="#1b2028" strokeWidth="1.1" />
        </svg>
      );

    case 'm1014':
      // Tactical auto shotgun silhouette (thick stock, long heavy barrel + under-tube magazine)
      return (
        <svg
          viewBox="0 0 180 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${className} ${silClass}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="sgBody" x1="0" y1="0" x2="180" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#e2d7c5" />
              <stop offset="55%" stopColor="#a79884" />
              <stop offset="100%" stopColor="#655b4e" />
            </linearGradient>
          </defs>
          {/* Tactical shotgun stock + pistol grip */}
          <path
            d="M8 24L44 21V33H30L10 43H6L8 24Z"
            fill="url(#sgBody)"
            stroke="#1b2028"
            strokeWidth="1.5"
          />
          <path d="M36 32H46L41 47H32L36 32Z" fill="#7c7266" stroke="#1b2028" strokeWidth="1.4" />
          {/* Heavy receiver */}
          <rect x="44" y="19" width="46" height="13" rx="1.5" fill="#c7ccd4" stroke="#1b2028" strokeWidth="1.5" />
          <rect x="56" y="22" width="16" height="4" rx="1" fill="#3a414d" />
          {/* Ribbed forend / pump handguard */}
          <rect x="90" y="25" width="38" height="9" rx="2" fill="url(#sgBody)" stroke="#1b2028" strokeWidth="1.4" />
          <path d="M96 27V32M103 27V32M110 27V32M117 27V32" stroke="#2d2822" strokeWidth="1.4" />
          {/* Long barrel + under-barrel tube magazine */}
          <rect x="90" y="19.5" width="80" height="5" rx="1" fill="#dbe0e8" stroke="#1b2028" strokeWidth="1.3" />
          <rect x="128" y="25.5" width="34" height="4.5" rx="1.5" fill="#adb5c2" stroke="#1b2028" strokeWidth="1.2" />
          <rect x="164" y="17.5" width="4" height="3" fill="#ef4444" />
        </svg>
      );

    case 'awm':
      // Classic olive/tan AWM bolt-action sniper rifle + big 8x scope + bipod
      return (
        <svg
          viewBox="0 0 180 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${className} ${silClass}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="awmChassis" x1="0" y1="0" x2="180" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#8fa868" />
              <stop offset="60%" stopColor="#5e763e" />
              <stop offset="100%" stopColor="#3c4c26" />
            </linearGradient>
          </defs>
          {/* Thumbhole chassis & stock */}
          <path
            d="M6 25H44V35H30L10 42H6V25Z"
            fill="url(#awmChassis)"
            stroke="#161d11"
            strokeWidth="1.5"
          />
          <rect x="16" y="29" width="12" height="4.5" rx="1.5" fill="#182014" />
          {/* Cheek rest */}
          <rect x="16" y="21" width="18" height="4" rx="1.5" fill="#779153" stroke="#161d11" strokeWidth="1.2" />
          {/* Receiver & forend */}
          <rect x="44" y="22" width="58" height="11" rx="1.5" fill="url(#awmChassis)" stroke="#161d11" strokeWidth="1.5" />
          {/* Sniper magazine + bolt handle */}
          <rect x="64" y="33" width="14" height="9" rx="1" fill="#3a424d" stroke="#161d11" strokeWidth="1.3" />
          <circle cx="54" cy="24" r="2.6" fill="#d9e0ea" stroke="#161d11" strokeWidth="1.1" />
          {/* Large 8x Optical Scope + Rings */}
          <rect x="52" y="17" width="5" height="5" fill="#2c3440" />
          <rect x="74" y="17" width="5" height="5" fill="#2c3440" />
          <path
            d="M40 11H48L52 12.5H78L84 10H96V18H84L78 16.5H52L48 18H40V11Z"
            fill="#c7d0dd"
            stroke="#161d11"
            strokeWidth="1.4"
          />
          <line x1="94" y1="11.5" x2="94" y2="16.5" stroke="#ef4444" strokeWidth="1.6" />
          {/* Long fluted barrel + muzzle brake */}
          <rect x="102" y="23.5" width="60" height="4.5" fill="#d6dde6" stroke="#161d11" strokeWidth="1.3" />
          <rect x="162" y="22" width="12" height="7.5" rx="1" fill="#9ca6b5" stroke="#161d11" strokeWidth="1.3" />
          {/* Folded bipod legs */}
          <path d="M98 33L114 42" stroke="#b6c0ce" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
  }
};
