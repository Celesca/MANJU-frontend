import { useState } from 'react';

const Footer = () => {
  // 1. สร้าง State สำหรับเก็บค่าอีเมลที่พิมพ์
  const [email, setEmail] = useState('');

  // 2. ฟังก์ชันทำงานเมื่อกดปุ่ม Subscribe
  const handleSubscribe = () => {
    const recipient = "siratee6775@gmail.com";
    const cc = "folk.sawit@gmail.com";
    const subject = "ขอสมัครรับข่าวสาร (Newsletter Subscription)";
    const body = `สวัสดีทีมงาน,\n\nฉันต้องการสมัครรับข่าวสารของ MANJU\nอีเมลของฉันคือ: ${email || "ไม่ได้ระบุ"}`;

    // เปิดแอปอีเมล
    window.location.href = `mailto:${recipient}?cc=${cc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <footer className="bg-slate-900 text-slate-300 relative overflow-hidden">
      
      {/* Decorative Top Line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-50" />
      
      {/* Background Glow */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 pt-16 pb-12 relative z-10">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-8 mb-12">
          
          {/* Brand Column (กว้าง 2 ส่วน) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-violet-500/30">
                M
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">MANJU</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              แพลตฟอร์มสร้าง AI Agent แบบ No-Code ที่ทรงพลังที่สุด ออกแบบ Workflow เชื่อมต่อ Database และ Deploy ได้ในไม่กี่คลิก
            </p>
            
            {/* Newsletter Input (แก้ไขส่วนนี้) */}
            <div className="flex gap-2">
               <input 
                 type="email" 
                 placeholder="Enter your email" 
                 value={email} // ผูกค่ากับ State
                 onChange={(e) => setEmail(e.target.value)} // อัปเดต State เมื่อพิมพ์
                 className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-4 py-2 w-full focus:outline-none focus:border-violet-500 transition-colors"
               />
               <button 
                 onClick={handleSubscribe} // เรียกฟังก์ชันเมื่อกดปุ่ม
                 className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
               >
                 Subscribe
               </button>
            </div>
          </div>

          {/* Links Column 1 */}
          <div className="lg:col-span-1">
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Product</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="/features" className="hover:text-violet-400 transition-colors">Features</a></li>
              <li><a href="/pricing" className="hover:text-violet-400 transition-colors">Pricing</a></li>
            </ul>
          </div>

          {/* Links Column 2 */}
          <div className="lg:col-span-1">
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Resources</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="/features" className="hover:text-violet-400 transition-colors">Documentation</a></li>
            </ul>
          </div>

          {/* Links Column 3 */}
          <div className="lg:col-span-1">
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="/about" className="hover:text-violet-400 transition-colors">About</a></li>
              <li><a href="/about" className="hover:text-violet-400 transition-colors">Contact</a></li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-sm">
            &copy; 2025 MANJU Inc. All rights reserved.
          </p>
          
          {/* Social Icons */}
          <div className="flex gap-6">
            <a href="https://github.com/Celesca/MANJU-frontend" className="text-slate-400 hover:text-white transition-colors">
              <span className="sr-only">GitHub</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/></svg>
            </a>
            <a href="https://x.com/login" className="text-slate-400 hover:text-white transition-colors">
              <span className="sr-only">Twitter / X</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" /></svg>
            </a>
            <a href="https://discord.gg/n3v2ACnk" className="text-slate-400 hover:text-white transition-colors">
              <span className="sr-only">Discord</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037 13.48 13.48 0 00-.59 1.226 18.356 18.356 0 00-5.526 0 13.48 13.48 0 00-.59-1.226.074.074 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
            </a>
          </div>
        </div>
        
      </div>
    </footer>
  );
};

export default Footer;