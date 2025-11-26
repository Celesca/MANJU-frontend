import React from 'react';

const VoiceControls = ({ mode }) => {
    
    // ซ่อน controls หากไม่ใช่โหมด Text-to-Voice
    if (mode !== 'text-to-voice') {
        return (
            <div className="p-4 bg-gray-100 rounded-xl text-center">
                <p className="text-gray-500 italic">
                    การปรับแต่งโทนเสียงและผู้พูดมีผลเฉพาะในโหมด 
                    <span className="font-semibold text-purple-600"> "Text to Voice" </span> เท่านั้น
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-900 border-b pb-3 mb-4">🎙️ การตั้งค่าเสียง</h3>

            {/* A. Voice Selection */}
            <div className="control-group">
                <label className="block text-sm font-medium text-gray-700 mb-2">1. เลือกผู้พูด (Voice Actor)</label>
                <select className="w-full p-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 transition-shadow">
                    <option value="thai-male-formal">Thai - ชาย (เป็นทางการ)</option>
                    <option value="thai-female-casual">Thai - หญิง (เป็นกันเอง)</option>
                    <option value="eng-adult-a1">English - Adult A1</option>
                    <option value="jpn-child-b3">Japanese - Child B3</option>
                </select>
            </div>

            {/* B. Tone/Emotion Adjustment (ปรับโทนเสียง) */}
            <div className="control-group">
                <label className="block text-sm font-medium text-gray-700 mb-2">2. ปรับโทนเสียง/อารมณ์</label>
                <input 
                    type="range" 
                    min="0" max="100" defaultValue="50" 
                    className="w-full h-3 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600" 
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>เศร้า/เคร่งเครียด</span>
                    <span>เป็นกลาง</span>
                    <span>สนุก/ตื่นเต้น</span>
                </div>
            </div>

            {/* C. Speed Control */}
            <div className="control-group">
                <label className="block text-sm font-medium text-gray-700 mb-2">3. ความเร็ว (Speed)</label>
                <input 
                    type="range" 
                    min="0.5" max="2" step="0.1" defaultValue="1" 
                    className="w-full h-3 bg-green-100 rounded-lg appearance-none cursor-pointer accent-green-600" 
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>ช้า (0.5x)</span>
                    <span>ปกติ (1.0x)</span>
                    <span>เร็ว (2.0x)</span>
                </div>
            </div>
            
            {/* D. Pitch Control */}
            <div className="control-group">
                <label className="block text-sm font-medium text-gray-700 mb-2">4. ระดับเสียง (Pitch)</label>
                <input 
                    type="range" 
                    min="-10" max="10" step="1" defaultValue="0" 
                    className="w-full h-3 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>ทุ้ม/ต่ำ (-10)</span>
                    <span>ปกติ (0)</span>
                    <span>แหลม/สูง (+10)</span>
                </div>
            </div>

            {/* Generation Button */}
            <button className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-purple-700 transition-colors mt-8">
                🔊 แปลงข้อความและสร้างเสียง
            </button>
        </div>
    );
};

export default VoiceControls;