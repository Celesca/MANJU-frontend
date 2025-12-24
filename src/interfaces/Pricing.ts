// src/interfaces/Pricing.ts
import { ReactNode } from 'react';

export interface CheckIconProps {
  color?: string;
}

export interface FAQItemProps {
  question: string;
  answer: string;
}

// ✅ เพิ่ม Interface สำหรับ Component ใหม่
export interface PricingFeatureProps {
  children: ReactNode; // ใช้ children เพื่อให้ใส่ tag html (เช่น <strong>) ได้
  iconColor?: string;
}