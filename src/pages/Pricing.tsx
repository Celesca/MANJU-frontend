import React, { useState } from 'react';
import type { FAQItemProps } from '../interfaces/Pricing';
import PricingFeature from '../components/PricingFeature';
import Navbar from '../components/Navbar';

const CONTACT_EMAIL = "siratee6775@gmail.com";
const CC_EMAIL = "folk.sawit@gmail.com";

const PricingSection: React.FC = () => {
  const [isAnnual, setIsAnnual] = useState<boolean>(true);

  return (
    <div className="bg-slate-50 py-24 relative overflow-hidden" id="pricing">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-white to-slate-50 pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 relative z-10">
        <Navbar />
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            เลือกแพ็กเกจที่เหมาะกับ <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
              ขนาดธุรกิจของคุณ
            </span>
          </h2>
          <p className="text-slate-600 text-lg mb-8">
            เริ่มต้นใช้งานฟรีได้ทันที อัปเกรดเมื่อคุณพร้อมขยายทีมและปริมาณการใช้งาน
          </p>

          {/* Toggle Switch */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>Monthly</span>
            <button 
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-14 h-8 bg-slate-200 rounded-full p-1 transition-colors duration-300 focus:outline-none hover:bg-slate-300"
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${isAnnual ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
            <span className={`text-sm font-medium ${isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>
              Yearly <span className="text-violet-600 text-xs bg-violet-100 px-2 py-0.5 rounded-full ml-1">-20%</span>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* 1. Starter Plan */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Starter</h3>
            <p className="text-slate-500 text-sm mb-6">สำหรับผู้เริ่มต้นและโปรเจกต์ขนาดเล็ก</p>
            <div className="mb-6">
              <span className="text-4xl font-bold text-slate-900">{isAnnual ? '฿0' : '฿0'}</span>
              <span className="text-slate-400 text-sm"> / เดือน</span>
            </div>
            <button className="w-full py-2.5 rounded-xl border-2 border-slate-900 text-slate-900 font-semibold hover:bg-slate-900 hover:text-white transition-colors mb-8">
              เริ่มต้นใช้งานฟรี
            </button>
            
            <ul className="space-y-4 text-sm">
              <PricingFeature>
                <strong>500 นาที</strong> Voice Processing / เดือน
              </PricingFeature>
              <PricingFeature>สร้างได้ <strong>1 Agent Workflow</strong></PricingFeature>
              <PricingFeature>Standard TTS Voice (Typhoon)</PricingFeature>
              <PricingFeature>เชื่อมต่อ Google Sheets (Read-only)</PricingFeature>
              <PricingFeature>Community Support</PricingFeature>
            </ul>
          </div>

          {/* 2. Pro Plan (Highlighted) */}
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 shadow-2xl shadow-violet-500/20 transform md:-translate-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-4 py-1 bg-violet-600 text-white text-xs font-bold rounded-bl-xl">POPULAR</div>
            <h3 className="text-xl font-bold text-white mb-2">Pro Business</h3>
            <p className="text-slate-400 text-sm mb-6">สำหรับธุรกิจที่ต้องการฟีเจอร์ครบครัน</p>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">{isAnnual ? '฿290' : '฿350'}</span>
              <span className="text-slate-400 text-sm"> / เดือน</span>
            </div>
            <button className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors shadow-lg shadow-violet-600/30 mb-8">
              <a href={`mailto:${CONTACT_EMAIL}?cc=${CC_EMAIL}&subject=สนใจแพ็กเกจ%20Pro%20Business`}>
                เริ่มใช้งานแพ็กเกจ Pro Business
              </a>
            </button>
            
            <ul className="space-y-4 text-sm text-slate-300">
              <PricingFeature iconColor="text-violet-400"><strong>5,000 นาที</strong> Voice Processing</PricingFeature>
              <PricingFeature iconColor="text-violet-400">ไม่จำกัด Agent Workflow</PricingFeature>
              <PricingFeature iconColor="text-violet-400"><strong>Voice Cloning</strong> (สร้างเสียงแบรนด์เองได้)</PricingFeature>
              <PricingFeature iconColor="text-violet-400">Google Sheets Real-time Sync (Read/Write)</PricingFeature>
              <PricingFeature iconColor="text-violet-400">RAG Knowledge Base (อัปโหลด PDF ไม่จำกัด)</PricingFeature>
              <PricingFeature iconColor="text-violet-400">Priority GPU Processing</PricingFeature>
            </ul>
          </div>

          {/* 3. Enterprise Plan */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Enterprise</h3>
            <p className="text-slate-500 text-sm mb-6">สำหรับองค์กรขนาดใหญ่และการปรับแต่งพิเศษ</p>
            <div className="mb-6">
              <span className="text-4xl font-bold text-slate-900">Custom</span>
            </div>
            <button className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:border-slate-900 hover:text-slate-900 transition-colors mb-8">
              <a href={`mailto:${CONTACT_EMAIL}?cc=${CC_EMAIL}&subject=สนใจแพ็กเกจ%20Enterprise`}>
                ติดต่อทีมงานเพื่อเสนอราคา
              </a>
            </button>
            
            <ul className="space-y-4 text-sm">
              <PricingFeature><strong>Unlimited</strong> Voice Processing</PricingFeature>
              <PricingFeature>On-Premise Deployment</PricingFeature>
              <PricingFeature>เชื่อมต่อ CRM / Ticketing System</PricingFeature>
              <PricingFeature>Fine-tune LLM เฉพาะองค์กร</PricingFeature>
              <PricingFeature>Dedicated Support Manager (24/7)</PricingFeature>
              <PricingFeature>SLA 99.9% Uptime Guarantee</PricingFeature>
            </ul>
          </div>

        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold text-slate-900 mb-8 text-center">คำถามที่พบบ่อย (FAQ)</h3>
            <div className="space-y-4">
                <FAQItem question="Voice Processing นับเวลาอย่างไร?" answer="เรานับเวลาเฉพาะตอนที่ AI ประมวลผลเสียงพูด (ASR) และสร้างเสียงตอบกลับ (TTS) เท่านั้น ไม่นับเวลาเงียบหรือเวลาที่ AI กำลังคิดหาคำตอบ" />
                <FAQItem question="สามารถเปลี่ยนแพ็กเกจภายหลังได้ไหม?" answer="ได้ตลอดเวลา คุณสามารถอัปเกรดหรือดาวน์เกรดแพ็กเกจได้ทันทีผ่านหน้า Dashboard โดยระบบจะคำนวณส่วนต่างให้ตามจริง" />
                <FAQItem question="ข้อมูลใน Google Sheets ปลอดภัยแค่ไหน?" answer="เราใช้การเชื่อมต่อผ่าน Google API OAuth 2.0 มาตรฐานสากล ระบบจะเข้าถึงเฉพาะไฟล์ที่คุณอนุญาตเท่านั้น และไม่มีการเก็บข้อมูลนั้นไว้ถาวร" />
            </div>
        </div>

      </div>
    </div>
  );
};

// Sub-component FAQItem
const FAQItem: React.FC<FAQItemProps> = ({ question, answer }) => (
    <div className="border-b border-slate-200 pb-4">
        <h4 className="font-semibold text-slate-800 mb-2">{question}</h4>
        <p className="text-slate-500 text-sm leading-relaxed">{answer}</p>
    </div>
);

export default PricingSection;