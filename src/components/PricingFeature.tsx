import React from 'react';
// Import Interface ที่เราทำไว้
import type { CheckIconProps, PricingFeatureProps } from '../interfaces/Pricing';

// --- Internal Component: CheckIcon ---
// (เก็บไว้ในไฟล์นี้เพราะใช้คู่กับ PricingFeature ตลอด)
const CheckIcon: React.FC<CheckIconProps> = ({ color = "text-green-500" }) => (
  <svg className={`w-5 h-5 ${color} flex-shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
  </svg>
);

// --- Main Component: PricingFeature ---
const PricingFeature: React.FC<PricingFeatureProps> = ({ children, iconColor }) => {
  return (
    <li className="flex items-start gap-3">
      <CheckIcon color={iconColor} />
      <span className="text-slate-600 dark:text-slate-300">{children}</span>
    </li>
  );
};

export default PricingFeature;