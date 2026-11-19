import React, { useEffect, useState } from 'react';
import { WeaponId } from '../game/types';
import {
  getWeaponCorsImageUrl,
  getWeaponSiteImageUrl,
  subscribeCleanWeaponIconUrl,
  WEAPON_IMAGE_SPECS,
} from '../game/weapon25d';

interface WeaponIconProps {
  weaponId: WeaponId;
  className?: string;
  silhouette?: boolean;
}

const FallbackWeaponSvg: React.FC<{ weaponId: WeaponId; className: string }> = ({
  weaponId,
  className,
}) => {
  switch (weaponId) {
    case 'g18':
      return (
        <svg viewBox="0 0 180 56" fill="none" className={className} aria-hidden="true">
          <rect x="48" y="13" width="76" height="11" rx="1.5" fill="#9ca3af" stroke="#1b2028" strokeWidth="1.5" />
          <rect x="52" y="24" width="68" height="6" rx="1" fill="#646e7d" stroke="#1b2028" strokeWidth="1.4" />
          <path d="M52 29H68L61 50H46L52 29Z" fill="#525b68" stroke="#1b2028" strokeWidth="1.5" />
        </svg>
      );
    case 'deagle':
      return (
        <svg viewBox="0 0 180 56" fill="none" className={className} aria-hidden="true">
          <path d="M42 12H138L142 17V25H44L42 12Z" fill="#cbd5e1" stroke="#181c22" strokeWidth="1.5" />
          <path d="M47 30H67L60 52H41L47 30Z" fill="#272c35" stroke="#181c22" strokeWidth="1.5" />
        </svg>
      );
    case 'ak47':
      return (
        <svg viewBox="0 0 180 56" fill="none" className={className} aria-hidden="true">
          <path d="M8 23H42V32H22L10 40H6L8 23Z" fill="#7c4a26" stroke="#1b2028" strokeWidth="1.5" />
          <rect x="42" y="20" width="74" height="11" rx="1.5" fill="#4b5563" stroke="#1b2028" strokeWidth="1.4" />
          <path d="M68 31H80L87 51H74L68 31Z" fill="#8b5a2b" stroke="#1b2028" strokeWidth="1.4" />
          <rect x="116" y="23" width="50" height="4" fill="#d1d5db" stroke="#1b2028" strokeWidth="1.2" />
        </svg>
      );
    case 'awm':
      return (
        <svg viewBox="0 0 180 56" fill="none" className={className} aria-hidden="true">
          <path d="M6 25H44V35H30L10 42H6V25Z" fill="#5e763e" stroke="#161d11" strokeWidth="1.5" />
          <rect x="44" y="22" width="58" height="11" rx="1.5" fill="#5e763e" stroke="#161d11" strokeWidth="1.5" />
          <rect x="102" y="23.5" width="60" height="4.5" fill="#d6dde6" stroke="#161d11" strokeWidth="1.3" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 180 56" fill="none" className={className} aria-hidden="true">
          <rect x="36" y="20" width="86" height="11" rx="1.5" fill="#9aa3b2" stroke="#1b2028" strokeWidth="1.4" />
          <path d="M62 31H74L79 50H67L62 31Z" fill="#b4bcc8" stroke="#1b2028" strokeWidth="1.4" />
          <rect x="122" y="23.5" width="44" height="4" fill="#cfd5df" stroke="#1b2028" strokeWidth="1.2" />
        </svg>
      );
  }
};

export const WeaponIcon: React.FC<WeaponIconProps> = ({
  weaponId,
  className = 'w-24 h-8',
  silhouette = false,
}) => {
  const [fallbackStage, setFallbackStage] = useState<0 | 1 | 2>(0);
  const [cleanDataUrl, setCleanDataUrl] = useState<string | null>(null);
  const spec = WEAPON_IMAGE_SPECS[weaponId];

  useEffect(() => {
    setFallbackStage(0);
    setCleanDataUrl(null);
    if (spec.hasCheckerBg) {
      let active = true;
      subscribeCleanWeaponIconUrl(weaponId, (url) => {
        if (active) setCleanDataUrl(url);
      });
      return () => {
        active = false;
      };
    }
  }, [weaponId, spec.hasCheckerBg]);

  if (fallbackStage === 2) {
    const silClass = silhouette ? 'brightness-[2.1] grayscale contrast-125' : '';
    return <FallbackWeaponSvg weaponId={weaponId} className={`${className} ${silClass}`} />;
  }

  const src =
    spec.hasCheckerBg && cleanDataUrl
      ? cleanDataUrl
      : fallbackStage === 0
        ? getWeaponSiteImageUrl(weaponId)
        : getWeaponCorsImageUrl(weaponId);

  const silClass = silhouette
    ? 'brightness-[2.2] grayscale contrast-125 opacity-60'
    : 'drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]';

  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      <img
        src={src}
        alt={weaponId}
        loading="eager"
        decoding="async"
        draggable={false}
        onError={() => {
          setFallbackStage((prev) => (prev === 0 ? 1 : 2));
        }}
        className={`w-full h-full object-contain pointer-events-none ${silClass}`}
        style={{
          transform: `scale(${spec.uiScale})`,
        }}
      />
    </span>
  );
};
