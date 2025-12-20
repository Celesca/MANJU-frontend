import React, { useState, useRef, useEffect } from 'react';
// Import วิดีโอจาก assets
import demoVideo from '../assets/TestDemo.mp4';

// สร้าง Interface สำหรับ Step (Optional แต่ดีสำหรับ TypeScript)
interface Step {
  id: number;
  title: string;
  desc: string;
  icon: React.ReactNode;
}

const TutorialSection: React.FC = () => {
  // ระบุ Type ให้ useRef เป็น HTMLVideoElement
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  useEffect(() => {
    // ตรวจสอบว่ามี element จริงๆ ก่อนเรียกใช้
    if (videoRef.current) {
      videoRef.current.play().catch((error) => {
        console.log("Autoplay prevented:", error);
        setIsPlaying(false);
      });
    }
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const steps: Step[] = [
    {
      id: 1,
      title: "Design Your Flow",
      desc: "สร้างการทำงานของ AI ได้ง่ายๆ ด้วยระบบ Drag & Drop เชื่อมต่อ Voice Input, AI Model และ Output เข้าด้วยกันอย่างอิสระ",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      id: 2,
      title: "Add Knowledge (RAG)",
      desc: "อัปโหลดเอกสาร PDF หรือข้อมูลสินค้า เพื่อให้ Agent เรียนรู้และตอบคำถามเฉพาะทางได้อย่างแม่นยำ ไม่ต้องเขียนโค้ด",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 3,
      title: "Test & Deploy",
      desc: "ทดสอบการโต้ตอบด้วยเสียงจริงทันทีในหน้า Dashboard ปรับแต่ง Prompt และ Model (GPT-4/Qwen) จนพอใจแล้วใช้งานได้เลย",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];

return (
    <div className="py-24 bg-white relative overflow-hidden">
      
      {/* Background Shapes */}
      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3 w-[600px] h-[600px] bg-violet-100/30 rounded-full blur-3xl pointer-events-none" />

      {/* 🟢 แก้ไข: เปลี่ยน max-w-[90rem] เป็น w-full และเพิ่ม px-4 ถึง px-16 ตามขนาดจอ */}
      <div className="max-w-[100rem] px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 mx-auto">
        
        {/* Header */}
        <div className="text-center mb-16 relative z-10">
          <span className="inline-block px-3 py-1 mb-4 text-xs font-semibold tracking-wider text-violet-600 uppercase bg-violet-100 rounded-full">
            No-Code Builder
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
            สร้าง AI Agent ของคุณ <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
              ง่ายเหมือนลากวาง
            </span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            ออกแบบ Workflow การทำงานของระบบเสียงได้ด้วยตัวเอง กำหนด Model, Prompt และแหล่งข้อมูล (Data Source) ได้อย่างอิสระผ่านหน้า Visual Editor
          </p>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-10 xl:gap-20 relative z-10">
          
          {/* LEFT SIDE: Video Player */}
          {/* 🟢 ใช้ w-full lg:w-[75%] ให้วิดีโอใหญ่สะใจเต็มพื้นที่ */}
          <div className="w-full lg:w-[75%] relative group perspective-1000">
            <div className="relative rounded-xl bg-slate-900 shadow-2xl shadow-violet-500/20 border border-slate-700/50 overflow-hidden transform transition-transform duration-500 group-hover:scale-[1.005]">
              
              {/* Window Controls */}
              <div className="h-9 bg-slate-800 flex items-center px-4 gap-2 border-b border-slate-700">
                <div className="w-3.5 h-3.5 rounded-full bg-red-500/80" />
                <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/80" />
                <div className="w-3.5 h-3.5 rounded-full bg-green-500/80" />
                <div className="ml-4 text-sm text-slate-400 font-mono">MANJU Workflow Builder</div>
              </div>

              {/* Video Container */}
              <div className="relative aspect-video bg-black cursor-pointer group" onClick={togglePlay}>
                <video 
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  src={demoVideo}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
                
                <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-300 ${isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-lg hover:scale-110 transition-transform">
                     <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -inset-2 bg-gradient-to-r from-violet-600 to-blue-600 rounded-2xl blur-2xl opacity-20 -z-10" />
          </div>

          {/* RIGHT SIDE: Steps */}
          {/* 🟢 ปรับความกว้างส่วนข้อความให้สัมพันธ์กัน */}
          <div className="w-full lg:w-[25%] space-y-8">
            {steps.map((step, index) => (
              <div key={step.id} className="flex gap-4 group">
                <div className="flex-shrink-0 relative">
                   <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-lg shadow-violet-100/50 flex items-center justify-center text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-all duration-300 transform group-hover:-translate-y-1 z-10 relative">
                     {step.icon}
                   </div>
                   {index !== steps.length - 1 && (
                     <div className="absolute top-12 left-1/2 -translate-x-1/2 w-0.5 h-12 bg-slate-100" />
                   )}
                </div>
                
                <div className="pt-1">
                  <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-violet-700 transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-slate-500 leading-relaxed text-sm">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
            
            <div className="pt-4 pl-16">
              <button className="px-6 py-2.5 rounded-full bg-slate-900 text-white font-medium hover:bg-violet-600 transition-colors shadow-lg shadow-slate-900/20 flex items-center gap-2 group text-sm">
                Start Building
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TutorialSection;