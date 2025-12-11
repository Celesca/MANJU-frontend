import { Volume2, Zap, Music, RotateCcw, Languages } from "lucide-react";

// 1. สร้าง Interface สำหรับโครงสร้างของ Settings
interface VoiceSettings {
  speed: number;
  pitch: number;
  volume: number;
  language: string;
}

// 2. สร้าง Interface สำหรับ Props ที่รับเข้ามา
interface VoiceControlsProps {
  mode: string; // หรือใช้ 'text-to-voice' | 'voice-to-text' เพื่อความแม่นยำกว่า
  settings: VoiceSettings;
  // Type นี้รองรับทั้งการส่งค่าตรงๆ และการส่งฟังก์ชัน (prev) => ... แบบ useState
  onSettingsChange: (value: VoiceSettings | ((prev: VoiceSettings) => VoiceSettings)) => void; 
}

export default function VoiceControls({ mode, settings, onSettingsChange }: VoiceControlsProps) {
  
  // 3. ระบุ Type ให้ key และ value
  // keyof VoiceSettings จะบังคับว่า key ต้องเป็นชื่อ field ที่มีใน interface เท่านั้น (speed, pitch, etc.)
  const handleChange = (key: keyof VoiceSettings, value: number | string) => {
    // ป้องกัน error กรณีไม่ได้ส่ง prop มา (Fallback)
    if (onSettingsChange) {
      // TypeScript จะรู้เองว่า prev คือ VoiceSettings จากการกำหนด Type ด้านบน
      onSettingsChange((prev) => ({ ...prev, [key]: value }));
    }
  };

  // ฟังก์ชัน Reset ค่าเป็น Default
  const handleReset = () => {
    if (onSettingsChange) {
      onSettingsChange({
        speed: 1,
        pitch: 1,
        volume: 1,
        language: 'th-TH'
      });
    }
  };

  return (
    <div className="space-y-8">
      
      {/* -----------------------------
          MODE: Text to Voice (TTS)
      ----------------------------- */}
      {mode === "text-to-voice" ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          
          {/* Speed Control */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm font-medium text-slate-700">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-500" />
                <span>ความเร็ว (Speed)</span>
              </div>
              <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded-md text-xs">
                {settings?.speed || 1}x
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings?.speed || 1}
              onChange={(e) => handleChange("speed", parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600 hover:accent-violet-500 transition-all"
            />
            <div className="flex justify-between text-xs text-slate-400 px-1">
              <span>0.5x (ช้า)</span>
              <span>2.0x (เร็ว)</span>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Pitch Control */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm font-medium text-slate-700">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-pink-500" />
                <span>ระดับเสียง (Pitch)</span>
              </div>
              <span className="bg-pink-100 text-pink-700 px-2 py-0.5 rounded-md text-xs">
                {settings?.pitch || 1}
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings?.pitch || 1}
              onChange={(e) => handleChange("pitch", parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-pink-500 hover:accent-pink-400 transition-all"
            />
            <div className="flex justify-between text-xs text-slate-400 px-1">
              <span>ทุ้มต่ำ</span>
              <span>แหลมสูง</span>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Volume Control */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm font-medium text-slate-700">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-500" />
                <span>ความดัง (Volume)</span>
              </div>
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-xs">
                {Math.round((settings?.volume || 1) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings?.volume || 1}
              onChange={(e) => handleChange("volume", parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
            />
          </div>
        </div>
      ) : (
        /* -----------------------------
            MODE: Voice to Text (STT)
        ----------------------------- */
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          
          {/* Language Selector */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Languages className="w-4 h-4 text-blue-500" />
              <span>ภาษาที่รับฟัง (Input Language)</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleChange("language", "th-TH")}
                className={`p-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                  settings?.language === "th-TH"
                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="text-lg">🇹🇭</span>
                ภาษาไทย
              </button>

              <button
                onClick={() => handleChange("language", "en-US")}
                className={`p-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                  settings?.language === "en-US"
                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="text-lg">🇺🇸</span>
                English
              </button>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Microphone Status</h4>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-sm shadow-red-300"></div>
              <span className="text-sm text-slate-700">Ready to listen</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer / Reset Button */}
      <div className="pt-4 border-t border-slate-100 mt-auto">
        <button
          onClick={handleReset}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors group"
        >
          <RotateCcw className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" />
          คืนค่าเริ่มต้น (Reset to Default)
        </button>
      </div>

    </div>
  );
}