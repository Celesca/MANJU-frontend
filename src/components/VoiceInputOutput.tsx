import React, { useState } from 'react';
import { Mic, Type, Upload, Play, Download, StopCircle } from 'lucide-react';

const VoiceInputOutput = ({ mode }) => {
    const [text, setText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    
    // --- Text to Voice Mode ---
    if (mode === 'text-to-voice') {
        return (
            <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                    <Type className="mr-2 h-6 w-6 text-purple-600" /> ข้อความต้นฉบับ
                </h3>
                <textarea
                    className="w-full h-64 p-4 border border-gray-300 rounded-xl focus:ring-purple-500 focus:border-purple-500 transition-shadow resize-none"
                    placeholder="ป้อนข้อความที่คุณต้องการแปลงเป็นเสียงพูด (สูงสุด 1,000 ตัวอักษร)..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={1000}
                />
                
                <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>ความยาว: {text.length} / 1000 ตัวอักษร</span>
                    <button className="text-purple-600 hover:text-purple-800 font-medium">ล้างข้อความ</button>
                </div>

                {/* Output Area & Playback (จำลอง) */}
                <div className="pt-4 border-t border-gray-200 space-y-4">
                    <h3 className="text-xl font-semibold text-gray-800">ผลลัพธ์เสียง</h3>
                    <div className="flex items-center space-x-3 bg-gray-100 p-3 rounded-lg">
                        <button className="bg-green-500 text-white p-2 rounded-full hover:bg-green-600 transition-colors">
                            <Play size={20} />
                        </button>
                        <div className="flex-1 h-2 bg-purple-200 rounded-full overflow-hidden">
                            <div className="bg-purple-600 h-full w-1/3 transition-all" style={{ width: '40%' }}></div>
                        </div>
                        <button className="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 transition-colors">
                            <Download size={20} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    
    // --- Voice to Text Mode ---
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                <Mic className="mr-2 h-6 w-6 text-purple-600" /> ป้อนเสียง (อัปโหลด/บันทึก)
            </h3>

            {/* Recording/Upload Controls */}
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                <button 
                    onClick={() => setIsRecording(!isRecording)}
                    className={`flex items-center justify-center px-6 py-3 rounded-xl font-bold transition-colors w-full md:w-1/2 ${
                        isRecording 
                            ? 'bg-red-500 text-white hover:bg-red-600' 
                            : 'bg-purple-500 text-white hover:bg-purple-600'
                    }`}
                >
                    {isRecording ? <StopCircle size={20} className="mr-2" /> : <Mic size={20} className="mr-2" />}
                    {isRecording ? 'กำลังบันทึก... (คลิกเพื่อหยุด)' : 'บันทึกเสียงใหม่'}
                </button>
                <button className="flex items-center justify-center px-6 py-3 rounded-xl font-bold bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors w-full md:w-1/2">
                    <Upload size={20} className="mr-2" /> อัปโหลดไฟล์เสียง (.mp3, .wav)
                </button>
            </div>
            
            {/* Output Area (Text Result) */}
            <div className="pt-4 border-t border-gray-200 space-y-4">
                <h3 className="text-xl font-semibold text-gray-800">ผลลัพธ์ข้อความ</h3>
                <textarea
                    className="w-full h-64 p-4 border border-gray-300 rounded-xl bg-gray-50 focus:ring-green-500 focus:border-green-500 transition-shadow resize-none"
                    placeholder="ผลลัพธ์ข้อความที่ถอดเสียงจะปรากฏที่นี่..."
                    disabled
                />
            </div>
        </div>
    );
};

export default VoiceInputOutput;