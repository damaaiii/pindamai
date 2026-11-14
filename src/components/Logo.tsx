import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showWordmark = true }) => {
  const dim = size === 'sm' ? 32 : size === 'lg' ? 48 : 38;

  return (
    <div className="inline-flex items-center gap-2.5 shrink-0">
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="512" height="512" rx="128" fill="#FCE9ED" stroke="#2B2226" strokeWidth="18" />
        {/* Open book */}
        <path
          d="M116 322C116 298 156 288 256 308C356 288 396 298 396 322V396C396 396 344 376 256 396C168 376 116 396 116 396V322Z"
          fill="#C9DFC0"
          stroke="#2B2226"
          strokeWidth="18"
          strokeLinejoin="round"
        />
        <path d="M256 308V396" stroke="#2B2226" strokeWidth="14" strokeLinecap="round" />
        {/* Speech bubble */}
        <path
          d="M258 106H372C396.3 106 416 125.7 416 150V218C416 242.3 396.3 262 372 262H316L278 292V262H258C233.7 262 214 242.3 214 218V150C214 125.7 233.7 106 258 106Z"
          fill="#F8E6A0"
          stroke="#2B2226"
          strokeWidth="18"
          strokeLinejoin="round"
        />
        <path d="M266 168H364M266 204H330" stroke="#2B2226" strokeWidth="16" strokeLinecap="round" />
        {/* Magnifying glass */}
        <circle
          cx="192"
          cy="204"
          r="82"
          fill="#FFF8F0"
          fillOpacity="0.94"
          stroke="#2B2226"
          strokeWidth="20"
        />
        <circle cx="192" cy="204" r="54" stroke="#F6C9D5" strokeWidth="14" />
        <path d="M134 262L92 304" stroke="#2B2226" strokeWidth="26" strokeLinecap="round" />
        <path d="M134 262L92 304" stroke="#F6C9D5" strokeWidth="12" strokeLinecap="round" />
      </svg>
      {showWordmark && (
        <span
          className={`font-display font-extrabold tracking-tight text-[#2B2226] whitespace-nowrap ${
            size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl'
          }`}
        >
          PINDAMAI
        </span>
      )}
    </div>
  );
};
