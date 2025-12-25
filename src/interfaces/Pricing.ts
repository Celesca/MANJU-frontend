// src/interfaces/Pricing.ts
import type { ReactNode } from 'react';

export interface CheckIconProps {
  color?: string;
}

export interface FAQItemProps {
  question: string;
  answer: string;
}

export interface PricingFeatureProps {
  children: ReactNode;
  iconColor?: string;
}