import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, Copy, Trash2, StopCircle, Play, User } from "lucide-react";

export default function VoiceInputOutput({ mode, settings }) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // เก็บรายการเสียงที่ผ่านการแปลงชื่อแล้ว
  const [thaiVoices, setThaiVoices] = useState([]); 
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(""); // ใช้ URI เป็น Key เพราะแม่นยำกว่า Name
  
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // 🛠️ ฟังก์ชันแปลงชื่อเสียงให้เป็น "ผู้ชาย/ผู้หญิง" แบบอัตโนมัติ
  const getFriendlyName = (voice, index) => {
    const name = voice.name.toLowerCase();
    
    // รายชื่อ Key ที่บ่งบอกเพศ (Windows / Mac / Android)
    if (name.includes("niwat") || name.includes("pattara") || name.includes("sarawut")) {
      return `เสียงผู้ชาย (ชุดที่ ${index + 1})`;
    }
    if (name.includes("premwadee") || name.includes("kanya") || name.includes("narisa")) {
      return `เสียงผู้หญิง (ชุดที่ ${index + 1})`;
    }
    if (name.includes("google") || name.includes("android")) {
      return `เสียง AI Google (มาตรฐาน)`;
    }
    // กรณีไม่รู้จักชื่อ
    return `เสียงไทยชุดที่ ${index + 1}`;
  };

  // ✅ 1. โหลดและกรองเฉพาะเสียงไทย + เปลี่ยนชื่อ
  useEffect(() => {
    const loadVoices = () => {
      const allVoices = synthRef.current.getVoices();
      
      // 🇹🇭 กรองเอาแค่ภาษาไทย (th-TH หรือ th)
      const thVoicesRaw = allVoices.filter(v => v.lang.includes("th"));

      // สร้าง Object ใหม่ที่มีชื่อเล่นที่เข้าใจง่าย
      const cleanVoices = thVoicesRaw.map((v, i) => ({
        original: v,
        label: getFriendlyName(v, i),
        uri: v.voiceURI
      }));

      setThaiVoices(cleanVoices);
      
      // ตั้งค่าเริ่มต้น (เลือกเสียงแรกที่เจอ)
      if (cleanVoices.length > 0) {
        setSelectedVoiceURI(cleanVoices[0].uri);
      }
    };

    loadVoices();
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }
  }, []);

  // ✅ 2. ตั้งค่า Voice to Text (รับภาษาไทยเท่านั้น)
  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.lang = "th-TH"; // บังคับภาษาไทย
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setText(transcript);
      };

      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
    }
  }, []);

  // --- Actions ---

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    alert("คัดลอกข้อความแล้ว");
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) return alert("Browser ไม่รองรับ");
    
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setText(""); 
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const speakText = () => {
    if (!text.trim()) return;
    
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // หาเสียงจาก URI ที่เลือกไว้
    const selectedVoiceObj = thaiVoices.find(v => v.uri === selectedVoiceURI);
    if (selectedVoiceObj) {
      utterance.voice = selectedVoiceObj.original;
    }
    
    // รับค่า settings จากภายนอก
    utterance.rate = settings?.speed || 1;
    utterance.pitch = settings?.pitch || 1;
    utterance.volume = settings?.volume || 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    synthRef.current.cancel();
    setIsSpeaking(false);
  };

  // --- Visual Render ---

  return (
    <div className="min-h-[450px] flex items-center justify-center p-4 md:p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl">
      <div className="w-full max-w-3xl bg-white/90 backdrop-blur-xl shadow-2xl rounded-3xl border border-white/50 flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 md:p-6 text-white flex justify-between items-center rounded-t-3xl">
          <h2 className="text-lg md:text-2xl font-bold flex items-center gap-2">
            {mode === "text-to-voice" ? <Volume2 className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            {mode === "text-to-voice" ? "AI Reader (ภาษาไทย)" : "AI Listener (ภาษาไทย)"}
          </h2>
          {(isRecording || isSpeaking) && (
            <div className="flex gap-1 items-end h-6">
              <span className="w-1 h-2 bg-white animate-[bounce_1s_infinite] rounded-full"></span>
              <span className="w-1 h-4 bg-white animate-[bounce_1.2s_infinite] rounded-full"></span>
              <span className="w-1 h-3 bg-white animate-[bounce_0.8s_infinite] rounded-full"></span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-6 flex-1 flex flex-col">
          
          <div className="relative group flex-1">
            <textarea
              className="w-full h-48 md:h-64 p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 transition-all text-gray-700 text-lg resize-none shadow-inner"
              placeholder={mode === "text-to-voice" ? "พิมพ์ข้อความภาษาไทยที่นี่..." : "กดไมค์แล้วพูดภาษาไทย..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              readOnly={mode !== "text-to-voice" && isRecording}
            />
            <div className="absolute top-3 right-3 flex gap-2">
              <button onClick={handleCopy} className="p-2 bg-white/80 backdrop-blur hover:bg-white rounded-lg shadow-sm border border-gray-100 text-gray-500 transition-all hover:scale-105" title="Copy">
                <Copy size={18} />
              </button>
              <button onClick={() => setText("")} className="p-2 bg-white/80 backdrop-blur hover:bg-white rounded-lg shadow-sm border border-gray-100 text-red-400 transition-all hover:scale-105" title="Clear">
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          <div className="pt-2">
            {mode === "text-to-voice" ? (
              <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                
                {/* 🇹🇭 Dropdown เลือกเสียงแบบ Clean */}
                <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-600">
                        <User size={20} />
                    </div>
                    <select 
                      className="w-full p-3 pl-10 pr-10 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none appearance-none cursor-pointer hover:border-violet-300 transition-colors font-medium text-gray-700"
                      onChange={(e) => setSelectedVoiceURI(e.target.value)}
                      value={selectedVoiceURI}
                      disabled={thaiVoices.length === 0}
                    >
                    {thaiVoices.length === 0 ? (
                        <option>ไม่พบชุดเสียงภาษาไทยในเครื่องนี้</option>
                    ) : (
                        thaiVoices.map((voice) => (
                            <option key={voice.uri} value={voice.uri}>
                            {voice.label}
                            </option>
                        ))
                    )}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>

                {!isSpeaking ? (
                  <button 
                    onClick={speakText}
                    className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-xl shadow-lg shadow-violet-200 transition-all active:scale-95 font-bold text-lg whitespace-nowrap disabled:bg-gray-300 disabled:shadow-none"
                    disabled={thaiVoices.length === 0}
                  >
                    <Play fill="currentColor" size={24} /> อ่านให้ฟัง
                  </button>
                ) : (
                  <button 
                    onClick={stopSpeaking}
                    className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-xl shadow-lg shadow-red-200 transition-all active:scale-95 font-bold text-lg whitespace-nowrap"
                  >
                    <StopCircle size={24} /> หยุดก่อน
                  </button>
                )}
              </div>
            ) : (
              <div className="flex justify-center">
                <button
                  onClick={toggleRecording}
                  className={`relative group flex items-center gap-3 px-10 py-4 rounded-full font-bold text-lg transition-all duration-300 ${
                    isRecording 
                    ? "bg-red-500 text-white shadow-red-200" 
                    : "bg-violet-600 text-white shadow-violet-200"
                  } shadow-xl hover:shadow-2xl hover:-translate-y-1`}
                >
                  {isRecording ? (
                    <>
                      <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20"></span>
                      <MicOff size={24} /> แตะเพื่อหยุด
                    </>
                  ) : (
                    <>
                      <Mic size={24} /> พูดภาษาไทย
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}