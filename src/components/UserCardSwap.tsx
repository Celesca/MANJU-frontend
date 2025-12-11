import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 1. ข้อมูลตัวอย่าง (User Data - คงเดิม) ---
const users = [
  // --- ของเดิม (ใส่ชื่อให้ครบ) ---
  {
    id: 1,
    role: "นักธุรกิจ",
    name: "",
    description: "เพิ่มประสิทธิภาพการสื่อสารในองค์กรและการตลาดด้วยเสียง AI ช่วยลดต้นทุนการจ้างพากย์",
    imageUrl: "https://img.freepik.com/premium-photo/successful-asian-businessman-office-ai-generated_145713-9811.jpg",
    bgColor: "bg-blue-600",
  },
  {
    id: 2,
    role: "ครู/อาจารย์",
    name: "",
    description: "สร้างสื่อการเรียนรู้ที่น่าสนใจและเป็นกันเองด้วยเสียงที่หลากหลาย ดึงดูดผู้เรียนได้ดียิ่งขึ้น",
    imageUrl: "/src/assets/teacher.png", 
    bgColor: "bg-pink-600",
  },
  {
    id: 3,
    role: "นักพัฒนา",
    name: "",
    description: "ผสาน API เสียง AI เข้ากับแอปพลิเคชันและเว็บไซต์ เพื่อสร้างประสบการณ์ User Interface แบบใหม่",
    imageUrl: "https://img.freepik.com/premium-photo/software-developer-work_161362-90403.jpg",
    bgColor: "bg-green-600",
  },
  
  // --- เพิ่มใหม่สำหรับ Project Manju ---
  {
    id: 4,
    role: "Content Creator",
    name: "",
    description: "สร้างเสียงพากย์สำหรับคลิป TikTok และ YouTube Shorts ได้ทันทีโดยไม่ต้องใช้อุปกรณ์อัดเสียงราคาแพง",
    imageUrl: "https://img.freepik.com/free-photo/young-woman-recording-video-camera_23-2148812683.jpg", // รูปคนถือกล้อง/ทำคอนเทนต์
    bgColor: "bg-purple-600", // สีม่วงสื่อถึงความครีเอทีฟ/โซเชียล
  },
  {
    id: 5,
    role: "นักเขียน/Storyteller",
    name: "",
    description: "เปลี่ยนนิยายและบทความให้เป็น Audiobook ที่มีชีวิตชีวา ด้วยน้ำเสียงที่สื่ออารมณ์และเล่าเรื่องได้สมจริง",
    imageUrl: "https://img.freepik.com/free-photo/woman-reading-book-cafe_1303-16281.jpg", // รูปคนอ่าน/เขียนหนังสือ
    bgColor: "bg-teal-600", // สีเขียวอมฟ้า ดูสงบและลึกซึ้ง
  },
  {
    id: 6,
    role: "Customer Support",
    name: "",
    description: "ยกระดับระบบตอบรับอัตโนมัติ (IVR) ให้ดูเป็นมิตรและเป็นธรรมชาติ สร้างความประทับใจแรกให้ลูกค้า",
    imageUrl: "https://img.freepik.com/free-photo/customer-service-agent-working_23-2148849503.jpg", // รูป Call center
    bgColor: "bg-orange-500", // สีส้มสื่อถึงการบริการและความกระตือรือร้น
  },
];

// --- 2. Component หลัก: UserCardSwap ---
const UserCardSwap = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false); // เพิ่มฟีเจอร์หยุดเมื่อเอาเมาส์ชี้

  // Auto-switch logic (Reset timer when activeIndex changes manually)
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % users.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [activeIndex, isPaused]);

  // คำนวณ Index เพื่อการแสดงผลแบบ Loop
  const getDisplayIndex = (index: number) => {
    // หาความต่างของ index กับ activeIndex เพื่อกำหนดตำแหน่ง
    const diff = (index - activeIndex + users.length) % users.length;
    return diff;
  };

  return (
    <div className="bg-white py-20 min-h-[700px] flex flex-col justify-center overflow-hidden">
      <div className="max-w-7xl mx-auto text-center px-6 mb-10 z-20 relative">
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
        >
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
            ค้นพบ <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">ผู้ใช้</span>
            </h2>
            <p className="text-gray-500 text-xl font-light">
            เรื่องราวความสำเร็จของผู้สร้างของเรา
            </p>
        </motion.div>
      </div>

      {/* --- Card Display Area --- */}
      <div 
        className="relative h-[450px] w-full max-w-4xl mx-auto flex justify-center items-center perspective-1000"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <AnimatePresence mode='popLayout'>
          {users.map((user, index) => {
            const position = getDisplayIndex(index); 
            // position 0 = Active
            // position 1 = Next
            // position 2 = Last (ในกรณีมี 3 คน) หรือ Next Next
            
            // กำหนด Style ตามตำแหน่ง
            let zIndex = 0;
            let x = 0;
            let scale = 1;
            let opacity = 1;
            let rotate = 0;

            if (position === 0) {
                // Active Card
                zIndex = 30;
                x = 0;
                scale = 1;
                opacity = 1;
                rotate = 0;
            } else if (position === 1) {
                // Right Card 1
                zIndex = 20;
                x = 140; // ขยับไปขวา
                scale = 0.9;
                opacity = 0.7;
                rotate = 5;
            } else {
                // Right Card 2 (Stack Behind)
                zIndex = 10;
                x = 260; // ขยับไปขวาอีก
                scale = 0.8;
                opacity = 0.4;
                rotate = 10;
            }

            return (
              <motion.div
                key={user.id}
                layout
                className={`absolute w-[300px] md:w-[340px] h-[480px] rounded-3xl shadow-2xl overflow-hidden cursor-pointer bg-white border border-gray-100`}
                initial={false}
                animate={{
                  x,
                  scale,
                  opacity,
                  zIndex,
                  rotate,
                  filter: position === 0 ? 'blur(0px)' : 'blur(1px)', // เบลอการ์ดที่ไม่ได้เลือก
                }}
                transition={{
                  type: "spring",
                  stiffness: 150,
                  damping: 18,
                  mass: 1
                }}
                onClick={() => setActiveIndex(index)}
                style={{
                    boxShadow: position === 0 
                        ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
                        : '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
              >
                {/* Image Section */}
                <div className="relative h-[65%] w-full overflow-hidden">
                    <motion.img
                        src={user.imageUrl}
                        alt={user.name}
                        className="w-full h-full object-cover"
                        // Parallax effect เล็กน้อยเมื่อเปลี่ยนการ์ด
                        animate={{ scale: position === 0 ? 1.1 : 1 }}
                        transition={{ duration: 0.8 }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                    
                    {/* Role Badge */}
                    <div className="absolute top-4 left-4">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-lg uppercase tracking-wider ${user.bgColor}`}>
                            {user.role}
                        </span>
                    </div>
                </div>

                {/* Content Section */}
                <div className="h-[35%] p-6 flex flex-col justify-between bg-white relative z-10">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">{user.name}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed line-clamp-3">
                      {user.description}
                    </p>
                  </div>
                  
                  {/* Progress Indicator (เฉพาะ Active Card) */}
                  {position === 0 && !isPaused && (
                      <div className="w-full h-1 bg-gray-100 rounded-full mt-4 overflow-hidden">
                          <motion.div 
                            className={`h-full ${user.bgColor}`}
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 5, ease: "linear" }}
                          />
                      </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Navigation Dots */}
      <div className="flex justify-center space-x-3 mt-8">
        {users.map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className={`transition-all duration-300 rounded-full ${
              index === activeIndex 
                ? 'w-8 h-2 bg-gray-800' 
                : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default UserCardSwap;