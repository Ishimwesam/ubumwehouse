import React from 'react';

const StatIcon = ({ children }) => (
  <span className="tp-stat-icon-svg" aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false">
      {children}
    </svg>
  </span>
);

export const StatIconWallet = () => (
  <StatIcon>
    <rect x="3" y="6" width="18" height="12" rx="2.5" ry="2.5" />
    <path d="M3 10h18" />
    <circle cx="16.5" cy="14" r="1" />
  </StatIcon>
);

export const StatIconCheck = () => (
  <StatIcon>
    <circle cx="12" cy="12" r="8" />
    <path d="m8.5 12.2 2.3 2.3 4.7-4.8" />
  </StatIcon>
);

export const StatIconFile = () => (
  <StatIcon>
    <path d="M8 3h6l4 4v14H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M14 3v5h5" />
    <path d="M10 12h6M10 16h4" />
  </StatIcon>
);
