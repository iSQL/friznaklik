import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  // You can add any custom props you might need, e.g., size
  size?: string | number;
}

const BookItTrimLogo: React.FC<LogoProps> = ({ size = "100%", ...props }) => {
  return (
    <svg
      viewBox="0 0 100 100" // This is from your original SVG
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size} // Control size with a prop
      height={size} // Control size with a prop
      {...props} // Spread any other SVG props like className, onClick, etc.
    >
      {/* Calendar Background */}
      <rect
        x="15"
        y="20"
        width="70"
        height="60"
        rx="8"
        stroke="#10b981" // Emerald 500 / Green
        strokeWidth="4"
        fill="#e0f2f1"   // Emerald 50 / Light Green
      />
      {/* Calendar Top Line */}
      <line
        x1="15"
        y1="38"
        x2="85"
        y2="38"
        stroke="#10b981" // Emerald 500
        strokeWidth="3"
      />
      {/* Calendar Rings */}
      <rect x="30" y="15" width="10" height="10" rx="2" fill="#059669" /> {/* Emerald 600 */}
      <rect x="60" y="15" width="10" height="10" rx="2" fill="#059669" /> {/* Emerald 600 */}
      {/* Calendar Dots */}
      <circle cx="30" cy="50" r="3" fill="#10b981" /> {/* Emerald 500 */}
      <circle cx="45" cy="50" r="3" fill="#10b981" />
      <circle cx="60" cy="50" r="3" fill="#10b981" />
      <circle cx="75" cy="50" r="3" fill="#10b981" />
      <circle cx="30" cy="65" r="3" fill="#10b981" />
      <circle cx="45" cy="65" r="3" fill="#10b981" />
      {/* Scissors Group */}
      <g transform="translate(55 5) scale(0.6)">
        <circle cx="30" cy="25" r="8" stroke="#3b82f6" strokeWidth="4" /> {/* Blue 500 */}
        <circle cx="30" cy="55" r="8" stroke="#3b82f6" strokeWidth="4" />
        <line
          x1="35"
          y1="30"
          x2="70"
          y2="65"
          stroke="#3b82f6"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <line
          x1="35"
          y1="50"
          x2="70"
          y2="15"
          stroke="#3b82f6"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};

export default BookItTrimLogo;