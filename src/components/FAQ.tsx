import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Minus, HelpCircle, FileText, CreditCard, Settings } from 'lucide-react';

// --- 1. ข้อมูลตัวอย่าง (FAQ Data) ---
// ปรับเนื้อหาให้เข้ากับ Project MANJU (AI Voice/TTS)
const faqData = [
  {
    id: 1,
    category: "general",
    question: "MANJU คืออะไร และทำอะไรได้บ้าง?",
    answer: "MANJU คือแพลตฟอร์ม AI Text-to-Speech ที่เปลี่ยนข้อความให้เป็นเสียงพูดที่เป็นธรรมชาติเหมือนมนุษย์ เหมาะสำหรับงาน Content Creator, Audiobook, สื่อการสอน และระบบตอบรับอัตโนมัติ",
  },
  {
    id: 2,
    category: "general",
    question: "สามารถนำเสียงไปใช้ในเชิงพาณิชย์ได้หรือไม่?",
    answer: "ได้ครับ! หากคุณสมัครใช้งานแพ็กเกจ Pro หรือ Business คุณจะได้รับลิขสิทธิ์ในการนำเสียงไปใช้ในงานเชิงพาณิชย์ได้ทันที ทั้ง YouTube, โฆษณา และสื่อประชาสัมพันธ์ต่างๆ",
  },
  {
    id: 3,
    category: "technical",
    question: "รองรับภาษาอะไรบ้าง?",
    answer: "ปัจจุบันเรารองรับภาษาไทยและภาษาอังกฤษเป็นหลัก โดยมีสำเนียงและอารมณ์ให้เลือกมากกว่า 50 แบบ และกำลังพัฒนาภาษาอื่นๆ เพิ่มเติมในอนาคต",
  },
  {
    id: 4,
    category: "billing",
    question: "คิดค่าบริการอย่างไร?",
    answer: "เราใช้ระบบ Credit ตามจำนวนตัวอักษรที่แปลงเป็นเสียง โดยมีทั้งแบบ Free Tier สำหรับทดลองใช้งาน และแบบ Subscription รายเดือนที่คุ้มค่าสำหรับผู้ใช้งานประจำ",
  },
  {
    id: 5,
    category: "billing",
    question: "ยกเลิกบริการได้ตอนไหน?",
    answer: "คุณสามารถยกเลิกแพ็กเกจรายเดือนได้ตลอดเวลาผ่านหน้าตั้งค่าบัญชี โดยสิทธิ์การใช้งานจะยังคงอยู่จนกว่าจะครบรอบบิลปัจจุบัน",
  },
];

const categories = [
  { id: 'all', label: 'ทั้งหมด', icon: HelpCircle },
  { id: 'general', label: 'ทั่วไป', icon: FileText },
  { id: 'technical', label: 'การใช้งาน', icon: Settings },
  { id: 'billing', label: 'ราคา & การชำระเงิน', icon: CreditCard },
];

const FaqPage = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter Logic
  const filteredFaqs = faqData.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-white py-20 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        
        {/* --- Header Section --- */}
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight"
          >
            มีคำถาม <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">สงสัยใช่ไหม?</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-500"
          >
            รวบรวมคำตอบสำหรับทุกเรื่องที่คุณอยากรู้เกี่ยวกับ MANJU
          </motion.p>
        </div>

        {/* --- Search Bar --- */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative max-w-lg mx-auto mb-12"
        >
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all shadow-sm hover:shadow-md"
            placeholder="ค้นหาคำถาม..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </motion.div>

        {/* --- Category Tabs --- */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                    setActiveCategory(cat.id);
                    setActiveQuestion(null); // Reset open question when changing tab
                }}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? 'bg-gray-900 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon size={16} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* --- FAQ List (Accordion) --- */}
        <motion.div layout className="space-y-4">
          <AnimatePresence mode='popLayout'>
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq) => (
                <motion.div
                  layout
                  key={faq.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className={`border rounded-2xl overflow-hidden transition-colors duration-300 ${
                    activeQuestion === faq.id 
                        ? 'bg-white border-purple-200 shadow-xl ring-1 ring-purple-100' 
                        : 'bg-white border-gray-100 shadow-sm hover:border-purple-100'
                  }`}
                >
                  <button
                    onClick={() => setActiveQuestion(activeQuestion === faq.id ? null : faq.id)}
                    className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                  >
                    <span className={`text-lg font-semibold ${activeQuestion === faq.id ? 'text-purple-700' : 'text-gray-800'}`}>
                      {faq.question}
                    </span>
                    <span className={`flex-shrink-0 ml-4 p-2 rounded-full transition-colors ${activeQuestion === faq.id ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                      {activeQuestion === faq.id ? <Minus size={20} /> : <Plus size={20} />}
                    </span>
                  </button>

                  <AnimatePresence>
                    {activeQuestion === faq.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        <div className="px-6 pb-6 text-gray-600 leading-relaxed border-t border-gray-50 pt-4">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))
            ) : (
              // Empty State
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="inline-block p-4 rounded-full bg-gray-50 mb-4">
                    <Search className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg">ไม่พบคำถามที่คุณค้นหา</p>
                <p className="text-gray-400 text-sm mt-1">ลองใช้คำค้นหาอื่น หรือเลือกหมวดหมู่ "ทั้งหมด"</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        
        {/* --- Footer Call to Action --- */}
        <div className="text-center mt-16 pt-10 border-t border-gray-100">
            <p className="text-gray-600 mb-4">ยังไม่พบคำตอบที่คุณต้องการ?</p>
            <a 
                href="mailto:siratee6775@gmail.com?cc=folk.sawit@gmail.com&subject=ติดต่อสอบถามทีมงาน%20Support"
                className="inline-block px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
                ติดต่อทีมงาน Support
            </a>
        </div>

      </div>
    </div>
  );
};

export default FaqPage;