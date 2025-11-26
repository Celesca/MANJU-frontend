import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 1. ข้อมูลตัวอย่าง (User Data) ---
const users = [
  {
    id: 1,
    role: "นักธุรกิจ",
    name: "Thomas S.",
    description: "เพิ่มประสิทธิภาพการสื่อสารในองค์กรและการตลาดด้วยเสียง AI",
    imageUrl: "https://i.ibb.co/6W7cQzY/handsome-man.jpg", // รูปผู้ชาย
    bgColor: "bg-blue-600",
  },
  {
    id: 2,
    role: "ครู/อาจารย์",
    name: "Sarah C.",
    description: "สร้างสื่อการเรียนรู้ที่น่าสนใจและเป็นกันเองด้วยเสียงที่หลากหลาย",
    imageUrl: "https://i.ibb.co/fQ5Vn71/beautiful-woman.jpg", // รูปผู้หญิง
    bgColor: "bg-pink-600",
  },
  {
    id: 3,
    role: "นักพัฒนา",
    name: "Alex R.",
    description: "ผสานเสียง AI เข้ากับแอปพลิเคชันและบริการใหม่ๆ ได้อย่างรวดเร็ว",
    imageUrl: "https://i.ibb.co/BqW6V69/developer-man.jpg", 
    bgColor: "bg-green-600",
  },
];

// --- 2. Component หลัก: UserCardSwap ---
const UserCardSwap = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-switch logic
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex(prevIndex => (prevIndex + 1) % users.length);
    }, 5000); // สลับทุก 5 วินาที

    return () => clearInterval(timer);
  }, []);

  const activeUser = users[activeIndex];

  // Logic สำหรับการ์ดรอง (Stacked Cards)
  const getStackedCardData = () => {
    const nextIndex = (activeIndex + 1) % users.length;
    const thirdIndex = (activeIndex + 2) % users.length;

    return [
      { id: users[nextIndex].id, role: users[nextIndex].role },
      { id: users[thirdIndex].id, role: users[thirdIndex].role },
    ];
  };

  const stackedCards = getStackedCardData();

  return (
    <div className="bg-white py-16">
      <div className="max-w-7xl mx-auto text-center px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
          ค้นพบ <span className="text-purple-600">ผู้ใช้</span>
        </h2>
        <p className="text-gray-600 mb-12 text-lg">
          ของผู้สร้างของเรา
        </p>

        {/* --- Card Display Area --- */}
        <div className="relative h-[450px] flex justify-center items-center">
          
          {/* 3. การ์ดรอง (Stacked Cards - ด้านขวา) */}
          {stackedCards.map((card, index) => (
            <motion.div
              key={`stacked-${card.id}`}
              className="absolute h-full w-[200px] bg-gray-100 rounded-2xl shadow-lg flex items-end p-4 text-gray-400 font-semibold cursor-pointer"
              // Animation: ค่อยๆ เลื่อนเข้ามาทางขวาและจางหายไป
              initial={{ x: 100 + index * 40, opacity: 0.5, zIndex: 3 - index }}
              animate={{ x: 100 + index * 40, opacity: 0.5, zIndex: 3 - index }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              style={{
                top: 0 + index * 10,
                transformOrigin: 'center right'
              }}
            >
              <span className="transform rotate-90 absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-fit">{card.role}</span>
            </motion.div>
          ))}
          
          {/* 4. การ์ด Active หลัก (ด้านซ้าย) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeUser.id}
              className="absolute h-full w-[280px] rounded-2xl shadow-2xl overflow-hidden cursor-pointer"
              // Animation: เลื่อนเข้ามาจากซ้าย
              initial={{ x: -200, opacity: 0 }}
              animate={{ x: 0, opacity: 1, zIndex: 10 }}
              exit={{ x: 200, opacity: 0, transition: { duration: 0.3 } }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <div className="relative h-full">
                {/* Image */}
                <img
                  src={activeUser.imageUrl}
                  alt={activeUser.name}
                  className="w-full h-2/3 object-cover"
                />
                {/* Content */}
                <div className={`h-1/3 p-4 ${activeUser.bgColor} text-white flex flex-col justify-center`}>
                  <h3 className="text-lg font-bold">{activeUser.role}</h3>
                  <p className="text-sm mt-1">{activeUser.description}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* 5. การ์ดรอง (Stacked Cards - ด้านซ้าย/ว่างเปล่า) */}
          <motion.div
            key={`placeholder-1`}
            className="absolute h-full w-[200px] bg-gray-100 rounded-2xl shadow-lg flex items-end p-4 text-gray-400 font-semibold"
            initial={{ x: -260, opacity: 0.5, zIndex: 3 }}
            animate={{ x: -260, opacity: 0.5, zIndex: 3 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            style={{ top: 10 }}
          >
            <span className="transform rotate-90 absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-fit">ผู้สร้าง</span>
          </motion.div>
          
          <motion.div
            key={`placeholder-2`}
            className="absolute h-full w-[200px] bg-gray-100 rounded-2xl shadow-lg flex items-end p-4 text-gray-400 font-semibold"
            initial={{ x: -300, opacity: 0.3, zIndex: 2 }}
            animate={{ x: -300, opacity: 0.3, zIndex: 2 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            style={{ top: 20 }}
          >
            <span className="transform rotate-90 absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-fit">ผู้เรียน</span>
          </motion.div>

          {/* 6. ปุ่มควบคุมการสลับ (Optional: ถ้าต้องการควบคุมด้วยมือ) */}
          <div className="absolute bottom-[-50px] flex space-x-2">
            {users.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === activeIndex ? 'bg-purple-600' : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Show user ${index + 1}`}
              />
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default UserCardSwap;