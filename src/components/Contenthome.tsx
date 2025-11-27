import React, { useState, useCallback } from "react";
import { ChevronDown, Download, Loader2, Play, User, Users, Volume2, Mic } from "lucide-react";

// ------------------- Types -------------------
type Tab =
  | "TEXT TO SPEECH"
  | "SPEECH TO TEXT"
  | "VOICE CLONING";

type Speaker = {
  name: string;
  icon: React.ElementType;
  description: string;
};

// ------------------- API CONFIG -------------------
const apiKey = "";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`;

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const pcmToWav = (_pcm16: Int16Array, _sampleRate: number): Blob => {
  const mockWavData = new Uint8Array([
    82, 73, 70, 70, 20, 0, 0, 0, 87, 65, 86, 69,
  ]);
  return new Blob([mockWavData], { type: "audio/wav" });
};

const ContentInputPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("TEXT TO SPEECH");

  const [text, setText] = useState(
    'Sometimes, I feel many people expect a lot from me, and I try to do as much as I can.'
  );

  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [selectedLanguage] = useState("THAI");

  const tabs: Tab[] = [
    "TEXT TO SPEECH",
    "SPEECH TO TEXT",
    "VOICE CLONING"
  ];

  const useCases: Speaker[] = [
    { name: "Samara", icon: User, description: "Narrate a story" },
    { name: "Spuds", icon: Volume2, description: "Recount an old story" },
    { name: "Jessica", icon: User, description: "Customer support" },
    { name: "2 speakers", icon: Users, description: "Create a dialogue" },
    { name: "Announcer", icon: Mic, description: "Voiceover a game" },
  ];

  const handlePlay = useCallback(async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    setAudioUrl(null);

    try {
      const payload = {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
        },
      };

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      const part = result?.candidates?.[0]?.content?.parts?.[0];
      const audioData = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType;

      if (!audioData || !mimeType) return;

      const pcmData = base64ToArrayBuffer(audioData);
      const pcm16 = new Int16Array(pcmData);

      const wavBlob = pcmToWav(pcm16, 16000);
      const url = URL.createObjectURL(wavBlob);

      setAudioUrl(url);
      new Audio(url).play();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [text]);

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      {/* BG Blur */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute w-[800px] h-[800px] bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 top-0 right-0" />
        <div className="absolute w-[600px] h-[600px] bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 bottom-0 left-0" />
      </div>

      <div className="w-full max-w-6xl z-10">
        {/* Tabs */}
        <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-all ${
                activeTab === tab
                  ? "bg-black text-white shadow-lg"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 border border-gray-100">
          {/* Text Area */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full min-h-[250px] bg-gray-50 border border-gray-200 rounded-2xl p-4 text-gray-800 focus:ring-2 focus:ring-indigo-400 outline-none"
          />

          {/* Use Cases */}
          <div className="flex flex-wrap gap-3 mt-6 mb-8">
            {useCases.map((item) => (
              <button
                key={item.name}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-full text-sm text-gray-700 hover:bg-indigo-50 shadow-sm"
              >
                <item.icon className="w-4 h-4 text-indigo-600" />
                <span>{item.name}</span>
                <span className="text-gray-500">· {item.description}</span>
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center border-t pt-4">
            {/* Language */}
            <button className="inline-flex items-center px-4 py-2 bg-white border rounded-full shadow-sm text-sm text-gray-700">
              <img
                src="https://img.freepik.com/free-vector/illustration-thailand-flag_53876-27145.jpg?semt=ais_hybrid&w=740&q=80"
                className="w-4 h-4 mr-2 rounded-sm"
                alt="Flag"
              />
              {selectedLanguage}
              <ChevronDown className="ml-2 w-4 h-4" />
            </button>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              {audioUrl && (
                <a
                  download="manju.wav"
                  href={audioUrl}
                  className="p-3 bg-gray-100 rounded-full hover:bg-gray-200"
                >
                  <Download className="w-5 h-5" />
                </a>
              )}

              <button
                onClick={handlePlay}
                disabled={isLoading}
                className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-full font-bold text-lg shadow-xl hover:bg-indigo-700 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    PLAY
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentInputPage;