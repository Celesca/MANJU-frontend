import { useState } from 'react';
import { Mic, Type, Settings2, Sparkles} from 'lucide-react';
import VoiceInputOutput from '../components/VoiceInputOutput'; // ตรวจสอบ path ให้ถูกต้อง
import VoiceControls from '../components/VoiceControls';     // ตรวจสอบ path ให้ถูกต้อง

export default function VoiceStudio() {
  const [mode, setMode] = useState('text-to-voice'); // 'text-to-voice' | 'voice-to-text'

  // ✅ State กลางสำหรับเก็บการตั้งค่า (เพื่อให้ Controls ทางขวา คุม Input ทางซ้ายได้ในอนาคต)
  const [settings, setSettings] = useState({
    speed: 1,
    pitch: 1,
    volume: 1,
    language: 'th-TH'
  });

  return (
    <div className="bg-[#F8FAFC] relative overflow-hidden font-sans text-slate-800">
      
      {/* 🔮 Background Decorations (สร้างบรรยากาศ) */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-100/50 to-transparent -z-10" />
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-purple-200/40 rounded-full blur-3xl -z-10" />
      <div className="absolute top-[20%] left-[-10%] w-72 h-72 bg-blue-200/40 rounded-full blur-3xl -z-10" />

      {/* --- Main Container --- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* 1️⃣ Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center gap-3">
              <Sparkles className="text-violet-500 fill-violet-100" />
              AI Studio
            </h1>
            <p className="text-slate-500 mt-2 text-lg">แปลงเสียงเป็นอักษร และเสกอักษรให้มีเสียง</p>
          </div>

          {/* 2️⃣ Mode Switcher (Segmented Control Style) */}
          <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex relative">
            <button
              onClick={() => setMode('text-to-voice')}
              className={`relative z-10 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                mode === 'text-to-voice' 
                  ? 'text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {/* Background pill for active state */}
              {mode === 'text-to-voice' && (
                <span className="absolute inset-0 bg-violet-600 rounded-xl -z-10 animate-fade-in" />
              )}
              <Type size={18} />
              Text to Voice
            </button>

            <button
              onClick={() => setMode('voice-to-text')}
              className={`relative z-10 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                mode === 'voice-to-text' 
                  ? 'text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
               {mode === 'voice-to-text' && (
                <span className="absolute inset-0 bg-violet-600 rounded-xl -z-10 animate-fade-in" />
              )}
              <Mic size={18} />
              Voice to Text
            </button>
          </div>
        </header>

        {/* --- Workspace Grid --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* 3️⃣ Main Working Area (Left/Center) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-1 shadow-sm border border-white/50">
              {/* ส่ง settings ลงไป (ถ้า Component ลูกรองรับ) */}
              <VoiceInputOutput mode={mode} settings={settings} />
            </div>
            
            {/* Area for History or Logs (Optional Expansion) */}
            <div className="hidden md:block p-6 rounded-2xl border border-slate-200/60 bg-white/40 text-slate-400 text-sm text-center border-dashed">
              History & Saved Clips will appear here...
            </div>
          </div>

          {/* 4️⃣ Controls Sidebar (Right) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden sticky top-8">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-slate-500" />
                <h3 className="font-bold text-slate-700">Studio Controls</h3>
              </div>
              
              <div className="p-6">
                {/* ส่ง setSettings ลงไปเพื่อให้ Controls ปรับค่าได้ */}
                <VoiceControls mode={mode} settings={settings} onSettingsChange={setSettings} />
              </div>

              {/* Pro Tip Box */}
              <div className="bg-indigo-50 p-4 m-4 rounded-xl text-xs text-indigo-800 leading-relaxed">
                <strong className="block mb-1 font-bold">💡 Pro Tip:</strong>
                {mode === 'text-to-voice' 
                  ? 'ลองปรับ Pitch ให้ต่ำลงเล็กน้อยเพื่อให้เสียงดูเป็นทางการมากขึ้น'
                  : 'พูดให้ชัดถ้อยชัดคำและอยู่ในที่เงียบ เพื่อความแม่นยำสูงสุด'}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}