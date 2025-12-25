import { useState } from 'react';
import Navbar from "../components/Navbar";

const FeaturesSection = () => {
  // state สำหรับสลับ Tab
  const [activeTab, setActiveTab] = useState('highlights');

  // --- DATA SET 1: MANJU Deep Tech ---
  const agents = [
    {
      role: "Supervisor Agent",
      desc: "สมองส่วนสั่งการ (Orchestrator) ทำหน้าที่วิเคราะห์ Intent ของผู้ใช้ด้วย BERT Model เพื่อแจกจ่ายงานไปยัง Agent เฉพาะทางได้อย่างแม่นยำ",
      icon: "🧠",
      tech: "BERT Fine-tuned",
      color: "border-violet-500 bg-violet-50/50"
    },
    {
      role: "Product Agent",
      desc: "ผู้เชี่ยวชาญด้านคลังสินค้า เชื่อมต่อกับ Google Sheets Database แบบ Real-time ผ่าน gspread เพื่อดึงข้อมูลราคาสินค้า จำนวนสต็อก",
      icon: "📦",
      tech: "Gspread API",
      color: "border-blue-500 bg-blue-50/50"
    },
    {
      role: "Knowledge Agent",
      desc: "คลังความรู้อัจฉริยะ ใช้เทคนิค RAG ร่วมกับ FAISS Vector Store เพื่อค้นหาคำตอบจากเอกสารคู่มือและนโยบายองค์กร ลดปัญหา Hallucination",
      icon: "📚",
      tech: "RAG + FAISS",
      color: "border-emerald-500 bg-emerald-50/50"
    },
    {
      role: "Response Agent",
      desc: "ผู้เรียบเรียงคำตอบ รวบรวมข้อมูลจากทุก Agent แล้วสังเคราะห์เป็นประโยคภาษาไทยที่เป็นธรรมชาติ ก่อนส่งต่อไปยังกระบวนการแปลงเป็นเสียง",
      icon: "💬",
      tech: "Qwen3-8B-4bit",
      color: "border-orange-500 bg-orange-50/50"
    }
  ];

  const pipelineSteps = [
    {
      step: "01",
      title: "Voice Input & ASR",
      desc: "รับเสียงผ่าน WebSocket และแปลงเป็นข้อความด้วยโมเดล Typhoon-ASR ที่ Optimized มาเพื่อภาษาไทยโดยเฉพาะ (Low Latency)",
      tech: "Typhoon ASR"
    },
    {
      step: "02",
      title: "Multi-Agent Processing",
      desc: "ใช้ระบบ LangGraph บริหารจัดการ State และ Workflow ของ Agent ต่างๆ เพื่อหาคำตอบที่ดีที่สุดจาก Knowledge Base หรือ Product DB",
      tech: "LangGraph" 
    },
    {
      step: "03",
      title: "Voice Synthesis (TTS)",
      desc: "แปลงคำตอบกลับเป็นเสียงพูดที่เป็นธรรมชาติด้วย F5-TTS รองรับการทำ Voice Cloning เลียนแบบเสียงต้นฉบับ",
      tech: "F5-TTS-THAI"
    }
  ];

  // --- DATA SET 2: Platform Features ---
  const generalFeatures = [
    {
      title: "Go Execution Engine",
      desc: "ประมวลผล Workflow ด้วยความเร็วสูง ผ่าน Golang Fiber ที่รองรับ Concurrent Request ได้นับล้าน",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />,
      color: "bg-blue-50 text-blue-600"
    },
    {
      title: "Vector Memory (RAG)",
      desc: "ระบบความจำระยะยาว เก็บข้อมูลด้วย pgvector ช่วยให้ AI ค้นหาเอกสารอ้างอิงได้อย่างแม่นยำ",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />,
      color: "bg-indigo-50 text-indigo-600"
    },
    {
      title: "Real-time WebSocket",
      desc: "สื่อสารกับผู้ใช้งานแบบ Low-latency สตรีมข้อความและเสียงกลับไปได้ทันทีโดยไม่ต้องรอ",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
      color: "bg-pink-50 text-pink-600"
    },
    {
      title: "Multi-LLM Orchestration",
      desc: "สลับ Model ได้อิสระใน Workflow เดียว รองรับทั้ง OpenAI GPT-4, Claude 3.5 และ Local LLM",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
      color: "bg-violet-50 text-violet-600"
    }
  ];

  const usageSteps = [
    { num: "01", title: "Drag & Drop Builder", desc: "ลาก Node คำสั่งต่างๆ มาวางบน Canvas เชื่อมต่อเส้น Flow เพื่อกำหนดลำดับการทำงาน ไม่ต้องเขียน Code เอง" },
    { num: "02", title: "Config & Prompt", desc: "คลิกที่ Node เพื่อตั้งค่า Prompt, เลือก Model หรืออัปโหลดไฟล์เอกสาร (Knowledge Base) ที่ต้องการให้ AI รู้" },
    { num: "03", title: "Test & Deploy", desc: "กดปุ่ม Run เพื่อทดสอบการทำงานทันที เมื่อพอใจแล้วกด Deploy เพื่อรับ API Endpoint ไปใช้งานได้เลย" }
  ];

  return (
    <div className="bg-white py-24 relative overflow-hidden" id="features">
      
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 relative z-10">
        <Navbar/>

        {/* --- HEADER --- */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-bold uppercase tracking-widest mb-4">
            Project Overview
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
            MANJU: <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">Multi-Agent AI</span> <br className="hidden md:block"/>
            for Natural Understanding
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed mt-4">
            ระบบผู้ช่วยอัจฉริยะที่ก้าวข้ามขีดจำกัดของ Chatbot ทั่วไป ด้วยสถาปัตยกรรม <strong>Multi-Agent</strong> ที่ทำงานประสานกันเสมือนทีมงานมืออาชีพ รองรับการสื่อสารด้วยเสียงแบบ <strong>Real-time</strong> ผ่านเทคโนโลยีภาษาไทยที่ทันสมัยที่สุด
          </p>
        </div>

        {/* --- TABS NAVIGATION --- */}
        <div className="flex justify-center mb-16">
          <div className="bg-slate-100 p-1.5 rounded-xl inline-flex flex-wrap justify-center gap-2 shadow-inner">
            <button 
              onClick={() => setActiveTab('architecture')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'architecture' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              System Architecture
            </button>
            <button 
              onClick={() => setActiveTab('pipeline')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'pipeline' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Processing Pipeline
            </button>
            <button 
              onClick={() => setActiveTab('highlights')}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'highlights' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Platform Features
            </button>
          </div>
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="min-h-[500px]">
          
          {/* TAB 1: ARCHITECTURE */}
          {activeTab === 'architecture' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {agents.map((agent, idx) => (
                <div key={idx} className={`p-8 rounded-2xl border ${agent.color} hover:shadow-lg transition-all duration-300 group`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-4xl bg-white w-14 h-14 rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                      {agent.icon}
                    </div>
                    <span className="px-3 py-1 bg-white/60 backdrop-blur-sm rounded-full text-xs font-mono font-semibold text-slate-600 border border-slate-200">
                      {agent.tech}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-violet-700 transition-colors">
                    {agent.role}
                  </h3>
                  <p className="text-slate-600 leading-relaxed text-sm">
                    {agent.desc}
                  </p>
                </div>
              ))}
              
              <div className="md:col-span-2 bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold mb-2">Powered by LangGraph</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      เราใช้ Framework ชั้นนำในการจัดการ Multi-Agent System ทำให้แต่ละ Agent สามารถทำงานแบบขนาน (Parallel Processing) และส่งต่อข้อมูลหากันได้อย่างไร้รอยต่อ ผ่าน JSON Protocol มาตรฐาน
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-violet-400">94%</div>
                      <div className="text-xs text-slate-400 mt-1">Intent Accuracy</div>
                    </div>
                    <div className="w-px bg-slate-700" />
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-400">&lt;5s</div>
                      <div className="text-xs text-slate-400 mt-1">Total Latency</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PIPELINE */}
          {activeTab === 'pipeline' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="hidden lg:flex justify-between items-center relative px-10 py-12 bg-slate-50 rounded-3xl border border-slate-200">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-0" />
                <div className="relative z-10 bg-white p-6 rounded-2xl shadow-lg border border-slate-100 w-72 text-center transform hover:-translate-y-2 transition-transform duration-300">
                  <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl border border-red-100">🎤</div>
                  <h4 className="font-bold text-slate-800">Typhoon ASR</h4>
                  <p className="text-xs text-slate-500 mt-2">แปลงเสียงเป็นข้อความ<br/>(Speech-to-Text)</p>
                </div>
                <div className="z-10 bg-slate-200 rounded-full p-2">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </div>
                <div className="relative z-10 bg-slate-900 p-6 rounded-2xl shadow-xl shadow-violet-500/20 border border-slate-700 w-80 text-center transform scale-110">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-violet-600 text-white text-[10px] font-bold uppercase rounded-full tracking-wider">
                    Core Processing
                  </div>
                  <div className="w-14 h-14 bg-violet-500/20 text-violet-400 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-2xl border border-violet-500/30">⚡</div>
                  <h4 className="font-bold text-white text-lg">Multi-Agent Brain</h4>
                  <p className="text-xs text-slate-400 mt-2">Qwen3-8B + RAG<br/>วิเคราะห์และค้นหาคำตอบ</p>
                </div>
                <div className="z-10 bg-slate-200 rounded-full p-2">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </div>
                <div className="relative z-10 bg-white p-6 rounded-2xl shadow-lg border border-slate-100 w-72 text-center transform hover:-translate-y-2 transition-transform duration-300">
                  <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl border border-green-100">🔊</div>
                  <h4 className="font-bold text-slate-800">F5-TTS Thai</h4>
                  <p className="text-xs text-slate-500 mt-2">แปลงข้อความเป็นเสียง<br/>(Text-to-Speech)</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                {pipelineSteps.map((step, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:border-violet-200 transition-colors">
                    <div className="text-4xl font-black text-slate-100 mb-4">{step.step}</div>
                    <h4 className="text-lg font-bold text-slate-800 mb-2">{step.title}</h4>
                    <p className="text-sm text-slate-500 leading-relaxed mb-4 min-h-[60px]">
                      {step.desc}
                    </p>
                    <div className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-mono rounded">
                      Tech: {step.tech}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: HIGHLIGHTS & USAGE (ABSTRACT CSS MOCKUP) */}
          {activeTab === 'highlights' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* 1. Technical Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
                    {generalFeatures.map((feature, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-violet-100 transition-all duration-300 hover:-translate-y-1">
                            <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4`}>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {feature.icon}
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">{feature.title}</h3>
                            <p className="text-slate-500 text-sm">{feature.desc}</p>
                        </div>
                    ))}
                </div>

                <div className="w-full h-px bg-slate-200 mb-16" />

                {/* 2. Abstract UI Mockup (Replica of the dark image) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
                    <div>
                        <span className="text-violet-600 font-semibold tracking-wider text-sm uppercase mb-2 block">Easy Workflow</span>
                        <h2 className="text-3xl font-bold text-slate-900 mb-8">
                            เริ่มใช้งานได้ทันทีใน <br />
                            <span className="text-violet-600">3 ขั้นตอนง่ายๆ</span>
                        </h2>
                        <div className="space-y-6">
                            {usageSteps.map((step, idx) => (
                                <div key={idx} className="flex gap-4 group">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center font-bold text-slate-400 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                                        {step.num}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 group-hover:text-violet-600 transition-colors">{step.title}</h4>
                                        <p className="text-slate-500 text-sm mt-1">{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="mt-8 px-6 py-2.5 bg-slate-900 text-white rounded-full text-sm font-medium hover:bg-violet-600 transition-colors shadow-lg shadow-slate-900/20">
                           <a href="/login"> ทดลองใช้งาน</a>
                        </button>
                    </div>

                    {/* CSS Mockup (Dark UI - Similar to image_486064.png) */}
                    <div className="relative">
                      {/* Background Glow */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/20 to-blue-500/20 rounded-3xl blur-2xl transform rotate-3 scale-95 -z-10" />
                      
                      {/* Window Container */}
                      <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-700/80 relative overflow-hidden h-[380px] group">
                        
                        {/* 1. Header Bar */}
                        <div className="h-10 border-b border-slate-700/50 flex items-center px-4 gap-2 bg-slate-800/50 backdrop-blur-md">
                          <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                            <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                            <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
                          </div>
                          <div className="ml-4 w-24 h-1.5 rounded-full bg-slate-700/50" />
                        </div>

                        {/* 2. Grid Background */}
                        <div className="absolute inset-0 top-10 bg-[#0F172A]" 
                             style={{ 
                               backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', 
                               backgroundSize: '24px 24px',
                               opacity: 0.4 
                             }}>
                        </div>

                        {/* 3. Abstract Nodes */}
                        <div className="relative h-full w-full p-8">
                            
                            {/* Connector Line (Bezier Curve) */}
                            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                                <path 
                                    d="M 180 120 C 180 120, 180 200, 240 200" 
                                    fill="none" 
                                    stroke="#475569" 
                                    strokeWidth="2" 
                                    strokeDasharray="4 4"
                                    className="group-hover:stroke-violet-500 transition-colors duration-500"
                                />
                            </svg>

                            {/* Node 1: Input (Purple) */}
                            <div className="absolute top-16 left-12 w-40 h-16 bg-slate-800/90 backdrop-blur border border-violet-500/30 rounded-lg shadow-lg flex items-center p-3 gap-3 z-10 hover:border-violet-500 transition-colors cursor-default">
                                <div className="w-8 h-8 rounded-md bg-violet-500/20 flex items-center justify-center border border-violet-500/20">
                                    <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="w-16 h-1.5 bg-slate-600 rounded-full" />
                                    <div className="w-10 h-1.5 bg-slate-700 rounded-full" />
                                </div>
                            </div>

                            {/* Node 2: Process (Green) */}
                            <div className="absolute top-40 left-52 w-44 h-16 bg-slate-800/90 backdrop-blur border border-emerald-500/30 rounded-lg shadow-lg flex items-center p-3 gap-3 z-10 hover:border-emerald-500 transition-colors cursor-default">
                                <div className="w-8 h-8 rounded-md bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
                                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="w-20 h-1.5 bg-slate-600 rounded-full" />
                                    <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
                                </div>
                            </div>

                        </div>

                        {/* 4. Bottom Right Badge (Running...) */}
                        <div className="absolute bottom-6 right-6">
                            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg shadow-violet-500/20 flex items-center gap-2 animate-pulse">
                                <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                                Running...
                            </div>
                        </div>

                      </div>
                    </div>
                </div>

             </div>
          )}

        </div>

        {/* --- BOTTOM NOTE --- */}
        <div className="mt-20 text-center">
            <p className="text-slate-500 text-sm mb-4">
                * ข้อมูลอ้างอิงจากรายงานโครงงานวิศวกรรมคอมพิวเตอร์ MANJU (2568)
            </p>
        </div>

      </div>
    </div>
  );
};

export default FeaturesSection;