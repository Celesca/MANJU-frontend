import { useState } from 'react';
// สมมติว่ามีคอมโพเนนต์สำหรับ Input/Output, Voice Selection และ Tone Adjustment
import VoiceInputOutput from '../components/VoiceInputOutput';
import VoiceControls from '../components/VoiceControls';

export default function VoiceStudio() {
    const [mode, setMode] = useState('text-to-voice'); // 'text-to-voice' หรือ 'voice-to-text'
    
    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
                
                {/* --- 1. Header และ Mode Switch --- */}
                <div className="p-6 border-b border-gray-200">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">AI Voice Studio</h1>
                    <div className="flex space-x-4">
                        <button
                            onClick={() => setMode('text-to-voice')}
                            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                                mode === 'text-to-voice' 
                                    ? 'bg-purple-600 text-white' 
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            Text to Voice (ข้อความเป็นเสียง)
                        </button>
                        <button
                            onClick={() => setMode('voice-to-text')}
                            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                                mode === 'voice-to-text' 
                                    ? 'bg-purple-600 text-white' 
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            Voice to Text (เสียงเป็นข้อความ)
                        </button>
                    </div>
                </div>

                {/* --- 2. Main Workspace (แบ่ง 2 คอลัมน์) --- */}
                <div className="flex flex-col lg:flex-row">
                    
                    {/* คอลัมน์ซ้าย: Input/Output และ Filter */}
                    <div className="lg:w-2/3 p-8 border-r border-gray-100">
                        <VoiceInputOutput mode={mode} />
                    </div>

                    {/* คอลัมน์ขวา: Controls (Tone & Voice Selection) */}
                    <div className="lg:w-1/3 p-8">
                        <VoiceControls mode={mode} />
                    </div>
                    
                </div>
            </div>
        </div>
    );
}