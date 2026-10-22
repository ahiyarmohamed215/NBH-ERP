import React from 'react';

/**
 * NBH ERP — Official Luxury Brand Letter Logo
 * Minimalist, pure luxury lettermark "NBH®" in deep sapphire blue.
 * Features refined letter spacing and a delicate registered trademark (®) emblem.
 */
export default function NbhLogo({
  size = 20,
  width,
  height,
  className = '',
  style = {},
  onClick,
}) {
  const isClickable = Boolean(onClick);

  // Maintain sleek luxury ~2.83:1 aspect ratio (width: 68, height: 24)
  const computedHeight = height || size;
  const computedWidth = width || Math.round(computedHeight * 2.83);

  return (
    <div
      className={`nbh-logo ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isClickable ? 'pointer' : 'default',
        userSelect: 'none',
        ...style,
      }}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 68 24"
        width={computedWidth}
        height={computedHeight}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          flexShrink: 0,
          display: 'block',
          transition: 'transform 0.15s ease',
        }}
        aria-label="NBH® Logo"
      >
        <defs>
          <linearGradient id="nbhLuxuryBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="45%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
        </defs>

        {/* Luxury "NBH" Lettermark with refined wide tracking */}
        <text
          x="26"
          y="18.5"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif"
          fontSize="18"
          fontWeight="800"
          fill="url(#nbhLuxuryBlue)"
          textAnchor="middle"
          letterSpacing="3.2"
        >
          NBH
        </text>

        {/* Delicate Registered Trademark Emblem (®) in Top-Right */}
        <g transform="translate(58, 6.5)">
          <circle cx="0" cy="0" r="3.2" stroke="url(#nbhLuxuryBlue)" strokeWidth="0.8" fill="none" />
          <text
            x="0"
            y="1.25"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif"
            fontSize="3.6"
            fontWeight="700"
            fill="url(#nbhLuxuryBlue)"
            textAnchor="middle"
          >
            R
          </text>
        </g>
      </svg>
    </div>
  );
}
