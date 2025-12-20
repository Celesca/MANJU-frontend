import CardSwap, { Card } from "../components/ContentCard";
import GradientText from "../components/GradientText";
import Navbar from "../components/Navbar";
import TextWelcome from "../components/TextType";
import Aurora from "../components/Backgound";
import UserCardSwap from "../components/UserCardSwap";
import { useEffect, useState } from "react";
import VoiceStudio from "./Voice";
import TutorialSection from "../components/TutorialSection";
import TechStackSection from "../components/Techstack";
import Footer from "../components/Footer";
import FaqPage from "../components/FAQ";

export default function Home() {
  const [showFirst, setShowFirst] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => {
      setShowFirst((prev) => !prev);
    }, 10000); // สลับทุก 10 วินาที

    return () => clearInterval(interval);
  }, []);

  return (
    // 1. CONTAINER
    <div className="w-full min-h-screen bg-white text-gray-900 relative overflow-hidden">

      {/* 2. AURORA EFFECT */}
      <div className="absolute top-0 left-0 right-0 h-96 z-10 pointer-events-none">
        <Aurora
          colorStops={["#0F172A", "#8B5CF6", "#3B82F6", "#F1F5F9"]}
          amplitude={0.5}
          blend={0.3}
          speed={0.7}
        />
      </div>

      {/* 3. MAIN CONTENT WRAPPER */}
      <div className="relative z-20">

        <Navbar />

        {/* ================= HERO SECTION START ================= */}
        <section className="pt-28 pb-20 max-w-7xl mx-auto text-center px-6">
          <div className="relative flex flex-col items-center justify-center pt-20 pb-10 overflow-hidden">

            {/* 1. BACKGROUND GLOW */}
            <div />
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-blue-100/40 blur-[80px] rounded-full -z-10 pointer-events-none" />

            {/* 2. BADGE */}
            <div className="mb-8 inline-flex items-center gap-x-2 rounded-full border border-violet-200 bg-white/50 px-4 py-1.5 text-sm font-medium text-violet-700 shadow-sm backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-violet-600 animate-pulse"></span>
              <span>Powered by Multi-Agent & F5-TTS</span>
            </div>

            {/* 3. HEADLINE */}
            <div className="max-w-5xl mx-auto text-center px-4">
              <GradientText
                colors={["#8B5CF6", "#3B82F6", "#0F172A"]}
                animationSpeed={8}
                showBorder={false}
                className="inline-block"
              >
                {showFirst ? (
                  <TextWelcome
                    className="text-7xl sm:text-8xl lg:text-9xl font-black tracking-tighter transition-all duration-700 ease-out"
                    text="MANJU"
                  />
                ) : (
                  <TextWelcome
                    className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight transition-all duration-700 ease-out leading-tight"
                    text="Multi-Agent AI for Natural Just-in-time Understanding"
                  />
                )}
              </GradientText>
            </div>

            {/* 4. DESCRIPTION ZONE */}
            <div className="flex flex-col items-center mt-8 px-4">
              <div className="w-24 md:w-250 h-1.5 bg-gradient-to-r from-transparent via-violet-400 to-transparent rounded-full opacity-60" />
              <p className="mt-8 max-w-2xl text-center text-lg md:text-xl text-slate-600 leading-relaxed font-light">
                Your intelligent virtual assistant, ready to serve
                <span className="font-semibold text-violet-700 mx-1">24/7</span>.
                Powered by Multi-Agent architecture for natural interaction.
                <br className="hidden md:block" />
                Reduce wait times with responses Just in time.
              </p>
            </div>

            {/* 5. BUTTONS */}
            <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full justify-center px-4">
              <a
                href="/projects"
                className="group relative inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white transition-all duration-200 bg-gradient-to-r from-violet-600 to-blue-600 rounded-full shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-600 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Talk to MANJU
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 group-hover:animate-pulse">
                    <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                    <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 9.375c-2.932 0-5.405-1.875-6.324-4.5h2.824a.75.75 0 010 1.5H5.25a.75.75 0 01-.75-.75v-6a.75.75 0 01.75-.75z" />
                  </svg>
                </span>
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />
              </a>

              <a
                href="/features"
                className="inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-slate-700 transition-all duration-200 bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:text-violet-700 hover:border-violet-200 hover:shadow-md"
              >
                View Architecture
              </a>
            </div>

          </div>
        </section>
        {/* ================= HERO SECTION END (ปิดตรงนี้ถูกต้อง) ================= */}


        {/* ================= TUTORIAL SECTION (Full Width) ================= */}
        <TutorialSection />

        {/* ================= VOICE STUDIO SECTION ================= */}
        <div className="flex flex-col items-center mb-32 mt-32 relative px-4">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-r from-violet-100/40 to-blue-100/40 blur-[90px] -z-10 rounded-full pointer-events-none" />

          <span className="mb-6 inline-flex items-center gap-x-2 rounded-full bg-violet-50 px-4 py-1.5 text-sm font-medium text-violet-700 ring-1 ring-inset ring-violet-200/60 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-600"></span>
            </span>
            Interactive Demo
          </span>

          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900 text-center tracking-tight">
            Experience <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">AI Voice Studio</span>
          </h2>

          <p className="text-lg md:text-xl text-slate-500 mb-12 max-w-2xl text-center leading-relaxed">
            ทดลองขุมพลัง <b>Thai Voice AI</b> ของ MANJU ได้ทันทีที่นี่ <br className="hidden md:block" />
            ไม่ว่าจะพิมพ์ข้อความให้ AI พูด (TTS) หรือสั่งงานด้วยเสียง (ASR)
          </p>

          <div className="w-full max-w-5xl bg-white/80 backdrop-blur-sm rounded-[2rem] shadow-2xl shadow-slate-200/60 border border-white/50 p-2 md:p-4 ring-1 ring-slate-100/50">
            <VoiceStudio />
          </div>
        </div>

        <TechStackSection />

        {/* ================= CARD SWAP SECTION ================= */}
        <div className="mb-32 mt-20 relative">
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-violet-100/50 blur-[100px] -z-10 rounded-full" />

          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
              Why Choose <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-500">MANJU?</span>
            </h2>
            <p className="mt-4 text-slate-500 text-lg max-w-2xl mx-auto">
              The ultimate solution for Just-in-time understanding.
            </p>
          </div>

          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center lg:items-start lg:space-x-16 px-6 lg:px-8">
            {/* คอลัมน์ซ้าย: ข้อความ */}
            <div className="md:w-1/2 mb-10 md:mb-0 md:pt-10 text-left">
              <div>
                <h3 className="text-3xl font-bold text-slate-800 mb-4 leading-snug">
                  More than just a Chatbot.<br />
                  It's a <span className="text-violet-600">Voice Intelligence.</span>
                </h3>
                <p className="text-lg text-slate-600 leading-relaxed">
                  MANJU ปฏิวัติการให้บริการด้วยระบบ AI ที่ "ฟัง-คิด-พูด" ได้เหมือนมนุษย์
                  ลดภาระงานของทีม Support และมอบประสบการณ์ที่น่าประทับใจให้ลูกค้าของคุณ
                  ด้วยเทคโนโลยี End-to-End ที่ดีที่สุด
                </p>
              </div>

              <ul className="mt-6 space-y-6">
                {[
                  {
                    title: "Natural Thai Voice (F5-TTS)",
                    desc: "เสียงสังเคราะห์ภาษาไทยที่เป็นธรรมชาติ ปรับอารมณ์ได้ ไม่เหมือนหุ่นยนต์",
                    color: "bg-violet-100 text-violet-600"
                  },
                  {
                    title: "Multi-Agent Architecture",
                    desc: "ทำงานร่วมกันหลายโมเดล (Product & Knowledge Agent) เพื่อคำตอบที่แม่นยำที่สุด",
                    color: "bg-blue-100 text-blue-600"
                  },
                  {
                    title: "Real-Time Interaction",
                    desc: "ตอบโต้ทันใจผ่าน WebSocket ด้วย Latency ต่ำกว่า 5 วินาที",
                    color: "bg-emerald-100 text-emerald-600"
                  }
                ].map((item, index) => (
                  <li key={index} className="flex items-start">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mr-4 shadow-sm`}>
                      {/* Icon เครื่องหมายถูก */}
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <div>
                      <strong className="block text-lg font-semibold text-slate-800">{item.title}</strong>
                      <span className="text-slate-500 text-sm md:text-base">{item.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="pt-4">
                <a href="#tech-details" className="inline-flex items-center font-semibold text-violet-600 hover:text-violet-700 transition-colors group">
                  Learn more about our tech
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                </a>
              </div>
            </div>

            {/* คอลัมน์ขวา: CardSwap */}
            <div className="lg:w-1/2 flex justify-center mt-12 lg:mt-0 relative lg:ml-10">
              <div style={{ height: '550px', position: 'relative' }} className="w-full max-w-sm">
                <CardSwap
                  cardDistance={50}
                  verticalDistance={80}
                  delay={4000}
                  pauseOnHover={true}
                >
                  <Card className="bg-white rounded-3xl shadow-xl shadow-violet-200/50 border border-violet-100 p-6 h-full flex flex-col justify-center overflow-hidden relative m-0">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
                    <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mb-4 text-violet-600">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-slate-800">Typhoon ASR & F5-TTS</h3>
                    <p className="text-slate-600 leading-relaxed text-sm">
                      สุดยอดเทคโนโลยีเสียงภาษาไทย แปลงเสียงเป็นข้อความแม่นยำด้วย Typhoon และโต้ตอบกลับด้วยเสียงสังเคราะห์ระดับ Human-quality จาก F5-TTS
                    </p>
                  </Card>

                  <Card className="bg-white rounded-3xl shadow-xl shadow-blue-200/50 border border-blue-100 p-6 h-full flex flex-col justify-center overflow-hidden m-0">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500" />
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 text-blue-600">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 0 0 2.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-slate-800">Smart Brain (LLM)</h3>
                    <p className="text-slate-600 leading-relaxed text-sm">
                      ขับเคลื่อนด้วย Qwen LLM และระบบ RAG ค้นหาข้อมูลสินค้าและเอกสารได้แม่นยำ ไม่มั่วคำตอบ
                    </p>
                  </Card>

                  <Card className="bg-white rounded-3xl shadow-xl shadow-indigo-200/50 border border-indigo-100 p-6 h-full flex flex-col justify-center overflow-hidden m-0">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500" />
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-slate-800">Multi-Agent System</h3>
                    <p className="text-slate-600 leading-relaxed text-sm">
                      แบ่งงานให้ผู้เชี่ยวชาญ 3 ด้าน (Product, Knowledge, General Agent) จัดการทุกคำถามได้อย่างมีประสิทธิภาพ
                    </p>
                  </Card>
                </CardSwap>
              </div>
            </div>
          </div>
        </div>



        {/* ================= USER SHOWCASE SECTION ================= */}
        <div className="pt-40 my-32 relative">
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[500px] h-[500px] bg-blue-100/40 blur-[100px] -z-10 rounded-full pointer-events-none" />

          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center md:space-x-16">

              <div className="md:w-1/2 flex justify-center mb-16 md:mb-0 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-violet-200/50 blur-[60px] -z-10 rounded-full" />
                <UserCardSwap />
              </div>

              <div className="md:w-1/2 text-left">
                <span className="inline-block px-3 py-1 mb-4 text-xs font-semibold tracking-wider text-blue-600 uppercase bg-blue-50 rounded-full border border-blue-100">
                  Use Cases
                </span>

                <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-slate-900 leading-tight">
                  พลิกโฉมการบริการ <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600">
                    ด้วยทีมงาน AI อัจฉริยะ
                  </span>
                </h2>

                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                  MANJU ไม่ได้เป็นเพียงแค่โปรแกรมตอบรับอัตโนมัติ แต่เป็น <strong>Ecosystem</strong> ที่ผสานการทำงานของ AI Agents ผู้เชี่ยวชาญ
                  เพื่อยกระดับประสบการณ์ลูกค้าและลดภาระงานของทีม Support ได้อย่างแท้จริง
                </p>

                <ul className="space-y-6">
                  <li className="flex items-start group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mr-4 group-hover:bg-violet-600 group-hover:text-white transition-colors duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800 group-hover:text-violet-700 transition-colors">Smart Customer Support</h4>
                      <p className="text-slate-500 text-sm mt-1">
                        ลดเวลารอสาย ตอบคำถามพื้นฐานทันที 24 ชม. ให้ทีมงานโฟกัสกับเคสที่ซับซ้อน
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mr-4 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72m-13.5 8.65h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .415.336.75.75.75Z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800 group-hover:text-blue-700 transition-colors">E-Commerce & Retail</h4>
                      <p className="text-slate-500 text-sm mt-1">
                        Product Agent ช่วยเช็คสต็อก ราคาสินค้า และปิดการขายด้วยข้อมูลที่แม่นยำ
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mr-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Knowledge Management</h4>
                      <p className="text-slate-500 text-sm mt-1">
                        Knowledge Agent ค้นหานโยบายและเอกสารองค์กรผ่าน RAG ได้ในเสี้ยววินาที
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <FaqPage/>
        <Footer />

      </div> {/* End of relative z-20 (Main content) */}
    </div> // End of w-full min-h-screen
  );
}