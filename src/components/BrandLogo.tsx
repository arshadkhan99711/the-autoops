import { useId } from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

export function BrandLogo({ size = 28, className = '' }: BrandLogoProps) {
  const uid = useId().replace(/:/g, '');
  const ringId = `autoops-ring-${uid}`;
  const coreId = `autoops-core-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={ringId} x1="3" y1="3" x2="33" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="52%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id={coreId} x1="10" y1="9" x2="26" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
      </defs>

      {/* Outer octagonal precision frame */}
      <path
        d="M12.2 3.5H23.8L32.5 12.2V23.8L23.8 32.5H12.2L3.5 23.8V12.2L12.2 3.5Z"
        fill="#0A1226"
        stroke={`url(#${ringId})`}
        strokeWidth="2"
      />

      {/* Inner autonomous circuit "A" apex & crossbar */}
      <path
        d="M11.5 25.5L18 10L24.5 25.5"
        stroke={`url(#${coreId})`}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.8 21.2H22.2"
        stroke="#38BDF8"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Autonomous core telemetry node */}
      <circle cx="18" cy="15.8" r="2.1" fill="#A78BFA" />
    </svg>
  );
}
