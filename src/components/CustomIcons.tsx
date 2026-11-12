import React from 'react';

export const GoldenGavelIcon: React.FC<{ className?: string }> = ({
  className = 'w-11 h-11',
}) => (
  <svg viewBox="0 0 48 48" fill="none" className={className}>
    {/* Gavel Head */}
    <g transform="rotate(35 28 18)">
      <rect x="19" y="8" width="18" height="9" rx="2" fill="#C9922E" />
      <rect x="17" y="7" width="4" height="11" rx="1.5" fill="#B57E1D" />
      <rect x="35" y="7" width="4" height="11" rx="1.5" fill="#B57E1D" />
      {/* Handle */}
      <rect x="26" y="17" width="4" height="24" rx="2" fill="#C9922E" />
      <rect x="25.5" y="36" width="5" height="5" rx="1.5" fill="#A67014" />
    </g>
  </svg>
);

export const NavyCarIcon: React.FC<{ className?: string }> = ({
  className = 'w-11 h-11',
}) => (
  <svg viewBox="0 0 52 44" fill="none" className={className}>
    {/* Car Roof & Windshield */}
    <path
      d="M11 18L15.5 8.5C16.3 6.8 18 5.8 19.9 5.8H32.1C34 5.8 35.7 6.8 36.5 8.5L41 18H11Z"
      fill="#123B70"
    />
    <path
      d="M14.5 16.5L17.8 9.8C18.3 8.8 19.3 8.2 20.4 8.2H31.6C32.7 8.2 33.7 8.8 34.2 9.8L37.5 16.5H14.5Z"
      fill="#F4F7FB"
    />
    {/* Side Mirrors */}
    <rect x="6" y="15" width="4.5" height="3.2" rx="1.5" fill="#123B70" />
    <rect x="41.5" y="15" width="4.5" height="3.2" rx="1.5" fill="#123B70" />
    {/* Car Body */}
    <rect x="8" y="17" width="36" height="14" rx="4.5" fill="#123B70" />
    {/* Headlights */}
    <ellipse cx="14" cy="23.5" rx="3" ry="2.2" fill="#FFFFFF" />
    <ellipse cx="38" cy="23.5" rx="3" ry="2.2" fill="#FFFFFF" />
    {/* Grille */}
    <rect x="20" y="22" width="12" height="2" rx="1" fill="#CBD5E1" />
    <rect x="21" y="25.5" width="10" height="2" rx="1" fill="#CBD5E1" />
    {/* Wheels */}
    <rect x="10" y="29" width="6.5" height="7" rx="2" fill="#0B2547" />
    <rect x="35.5" y="29" width="6.5" height="7" rx="2" fill="#0B2547" />
  </svg>
);

export const CarSoldIcon: React.FC<{ className?: string }> = ({
  className = 'w-12 h-11',
}) => (
  <svg viewBox="0 0 58 46" fill="none" className={className}>
    <g transform="translate(0, 0)">
      <path
        d="M9 18L13.5 8.5C14.3 6.8 16 5.8 17.9 5.8H30.1C32 5.8 33.7 6.8 34.5 8.5L39 18H9Z"
        fill="#123B70"
      />
      <path
        d="M12.5 16.5L15.8 9.8C16.3 8.8 17.3 8.2 18.4 8.2H29.6C30.7 8.2 31.7 8.8 32.2 9.8L35.5 16.5H12.5Z"
        fill="#F4F7FB"
      />
      <rect x="4" y="15" width="4.5" height="3.2" rx="1.5" fill="#123B70" />
      <rect x="39.5" y="15" width="4.5" height="3.2" rx="1.5" fill="#123B70" />
      <rect x="6" y="17" width="36" height="14" rx="4.5" fill="#123B70" />
      <ellipse cx="12" cy="23.5" rx="2.8" ry="2.2" fill="#FFFFFF" />
      <ellipse cx="36" cy="23.5" rx="2.8" ry="2.2" fill="#FFFFFF" />
      <rect x="18" y="22" width="12" height="2" rx="1" fill="#CBD5E1" />
      <rect x="19" y="25.5" width="10" height="2" rx="1" fill="#CBD5E1" />
      <rect x="8" y="29" width="6.5" height="7" rx="2" fill="#0B2547" />
      <rect x="33.5" y="29" width="6.5" height="7" rx="2" fill="#0B2547" />
    </g>
    {/* Green Check Badge */}
    <circle cx="43" cy="31" r="10.5" fill="#FFFFFF" />
    <circle cx="43" cy="31" r="9" fill="#289E47" />
    <path
      d="M38.5 31.2L41.5 34.2L47.8 27.8"
      stroke="#FFFFFF"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CarUnsoldIcon: React.FC<{ className?: string }> = ({
  className = 'w-12 h-11',
}) => (
  <svg viewBox="0 0 58 46" fill="none" className={className}>
    <g transform="translate(0, 0)">
      <path
        d="M9 18L13.5 8.5C14.3 6.8 16 5.8 17.9 5.8H30.1C32 5.8 33.7 6.8 34.5 8.5L39 18H9Z"
        fill="#123B70"
      />
      <path
        d="M12.5 16.5L15.8 9.8C16.3 8.8 17.3 8.2 18.4 8.2H29.6C30.7 8.2 31.7 8.8 32.2 9.8L35.5 16.5H12.5Z"
        fill="#F4F7FB"
      />
      <rect x="4" y="15" width="4.5" height="3.2" rx="1.5" fill="#123B70" />
      <rect x="39.5" y="15" width="4.5" height="3.2" rx="1.5" fill="#123B70" />
      <rect x="6" y="17" width="36" height="14" rx="4.5" fill="#123B70" />
      <ellipse cx="12" cy="23.5" rx="2.8" ry="2.2" fill="#FFFFFF" />
      <ellipse cx="36" cy="23.5" rx="2.8" ry="2.2" fill="#FFFFFF" />
      <rect x="18" y="22" width="12" height="2" rx="1" fill="#CBD5E1" />
      <rect x="19" y="25.5" width="10" height="2" rx="1" fill="#CBD5E1" />
      <rect x="8" y="29" width="6.5" height="7" rx="2" fill="#0B2547" />
      <rect x="33.5" y="29" width="6.5" height="7" rx="2" fill="#0B2547" />
    </g>
    {/* Red X Badge */}
    <circle cx="43" cy="31" r="10.5" fill="#FFFFFF" />
    <circle cx="43" cy="31" r="9" fill="#D9383A" />
    <path
      d="M39.5 27.5L46.5 34.5M46.5 27.5L39.5 34.5"
      stroke="#FFFFFF"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

export const PieChartKpiIcon: React.FC<{ className?: string }> = ({
  className = 'w-10 h-10',
}) => (
  <svg viewBox="0 0 44 44" fill="none" className={className}>
    {/* Main 3/4 Navy Pie */}
    <path
      d="M21 23V6C11.6 6 4 13.6 4 23C4 32.4 11.6 40 21 40C28.8 40 35.4 34.7 37.4 27.5L21 23Z"
      fill="#123B70"
    />
    {/* Separated Slice */}
    <path
      d="M23.5 20.5L39.8 24.8C40.3 23 40.5 21.2 40.5 19.3C40.5 10.6 33.4 3.5 24.7 3.5H23.5V20.5Z"
      fill="#165B9D"
    />
  </svg>
);

export const GoldenTargetIcon: React.FC<{ className?: string }> = ({
  className = 'w-11 h-11',
}) => (
  <svg viewBox="0 0 48 48" fill="none" className={className}>
    <circle cx="22" cy="26" r="15" stroke="#C9922E" strokeWidth="3.2" />
    <circle cx="22" cy="26" r="9.5" stroke="#C9922E" strokeWidth="3" />
    <circle cx="22" cy="26" r="4.2" fill="#C9922E" />
    {/* Arrow hitting bullseye */}
    <path
      d="M22 26L39 9"
      stroke="#9E6B14"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path d="M35 8H40V13" stroke="#9E6B14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 26L27 25L23 21L22 26Z" fill="#9E6B14" />
  </svg>
);

export const AscendingBarsIcon: React.FC<{ className?: string }> = ({
  className = 'w-10 h-10',
}) => (
  <svg viewBox="0 0 44 44" fill="none" className={className}>
    <rect x="7" y="25" width="6.5" height="11" rx="1" fill="#165B9D" />
    <rect x="17.5" y="18" width="6.5" height="18" rx="1" fill="#1597CE" />
    <rect x="28" y="9" width="6.5" height="27" rx="1" fill="#123B70" />
    <rect x="4" y="36" width="34" height="3" rx="1.5" fill="#123B70" />
  </svg>
);

export const ExcelSheetIcon: React.FC<{ className?: string }> = ({
  className = 'w-6 h-6',
}) => (
  <svg viewBox="0 0 28 28" fill="none" className={className}>
    <rect x="2" y="3" width="24" height="22" rx="3" fill="#1D6F42" />
    <rect x="13" y="5" width="11" height="4.5" fill="#33C481" fillOpacity="0.4" />
    <rect x="13" y="10.5" width="11" height="4.5" fill="#33C481" fillOpacity="0.25" />
    <rect x="13" y="16" width="11" height="4.5" fill="#33C481" fillOpacity="0.4" />
    <rect x="2" y="5" width="13" height="18" rx="2" fill="#107C41" />
    <path
      d="M5.5 9.5L8.5 14L5.3 18.5H7.5L9.6 15.3L11.7 18.5H13.9L10.7 14L13.7 9.5H11.5L9.6 12.5L7.7 9.5H5.5Z"
      fill="#FFFFFF"
    />
  </svg>
);
