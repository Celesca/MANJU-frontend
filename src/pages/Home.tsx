import CardSwap, { Card } from "../components/ContentCard";
import ContentInputPage from "../components/Contenthome";
import GradientText from "../components/GradientText";
import Navbar from "../components/Navbar";
import TextWelcome from "../components/TextType";
// 1. IMPORT Aurora component
import Aurora from "../components/Backgound";
import UserCardSwap from "../components/UserCardSwap";

export default function Home() {
  return (
    // 1. CONTAINER: Ensure it has relative positioning
    <div
      className="w-full min-h-screen bg-white text-gray-900 relative overflow-hidden"
    >

      {/* 2. AURORA EFFECT: Placed absolutely and given a z-index of 1 for background effect */}
      <div className="absolute top-0 left-0 right-0 h-96 z-10 pointer-events-none">
        <Aurora
          // Customize colors for a light/pastel theme
          colorStops={["#40ffaa", "#4079ff", "#40ffaa", "#4079ff", "#40ffaa"]}
          amplitude={0.5}
          blend={0.3}
          speed={0.7}
        />
      </div>

      {/* 3. MAIN CONTENT WRAPPER: Needs a higher z-index (z-20) to sit above Aurora (z-10) */}
      <div className="relative z-20">

        {/* Navbar - (สมมติว่า Navbar ถูกออกแบบมาให้เข้ากับพื้นหลังสีอ่อน) */}
        <Navbar />

        {/* HERO SECTION */}
        <section className="pt-28 pb-20 max-w-7xl mx-auto text-center px-6">

          <div className="flex flex-col items-center mb-20 mt-20">
            {/* HEADLINE: GradientText ยังคงสีเดิมเพื่อให้โดดเด่น */}
            <GradientText
              colors={["#40ffaa", "#4079ff", "#40ffaa", "#4079ff", "#40ffaa"]}
              animationSpeed={6}
              showBorder={false}
            >
              <TextWelcome
                className="text-6xl sm:text-7xl lg:text-8xl font-extrabold mb-6 tracking-tight"
                text="Welcome to MANJU!"
              />
            </GradientText>

            {/* SUBHEAD/DESCRIPTION: ใช้สีเทาเข้ม (text-gray-600) เพื่อให้ตัดกับพื้นหลังสีขาวได้ดี */}
            <p className="text-gray-600 text-lg md:text-xl max-w-3xl mx-auto mb-12">
              Your all-in-one platform for managing projects, collaborating with
              teams, and **boosting productivity** with cutting-edge tools.
            </p>
          </div>

          {/* CARD SWAP SECTION */}
          <div className="mb-20">
            {/* หัวข้อ: ใช้สีดำ (text-gray-900) */}
            <h2 className="text-4xl font-bold mb-10 text-gray-900 text-center">Features at a Glance</h2>

            {/* 1. CONTAINER: ใช้ Flexbox เพื่อแบ่งเป็นสองคอลัมน์ */}
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:space-x-12 px-4">

              {/* 2. คอลัมน์ซ้าย: ข้อความ/คำอธิบาย */}
              <div className="md:w-1/2 mb-10 md:mb-0 md:pt-10 text-left">
                <h3 className="text-3xl font-semibold mb-4 text-gray-800">Why Choose MANJU?</h3>
                <p className="text-lg text-gray-600 mb-6">
                  MANJU คือเครื่องมือครบวงจรที่ออกแบบมาเพื่อเพิ่มประสิทธิภาพการทำงาน
                  ของคุณและทีม ไม่ว่าจะเป็นการจัดการโปรเจกต์ขนาดเล็กหรือองค์กรขนาดใหญ่
                  เรามีฟีเจอร์ที่ช่วยให้คุณบรรลุเป้าหมายได้ง่ายขึ้น
                </p>
                <ul className="list-disc list-inside space-y-3 text-gray-700">
                  <li><strong className="font-medium">Intuitive Design:</strong> ใช้งานง่าย ไม่ต้องเรียนรู้ใหม่</li>
                  <li><strong className="font-medium">Real-Time Sync:</strong> อัปเดตข้อมูลทันที ไม่พลาดทุกความเคลื่อนไหว</li>
                  <li><strong className="font-medium">Scalable Solution:</strong> รองรับการเติบโตของทีมคุณได้ทุกระดับ</li>
                </ul>
              </div>

              {/* 3. คอลัมน์ขวา: CardSwap Component */}
              <div className="md:w-1/2 flex justify-center">
                <div style={{ height: '550px', position: 'relative' }} className="w-full max-w-sm">
                  <CardSwap
                    cardDistance={50}
                    verticalDistance={80}
                    delay={4000}
                    pauseOnHover={true}
                  >
                    {/* CARD CONTENT */}
                    <Card>
                      <h3 className="text-2xl font-semibold mb-2 text-gray-800">Project Management</h3>
                      <p className="text-gray-600">Organize tasks, set deadlines, and track progress effortlessly with our intuitive boards.</p>
                    </Card>
                    <Card>
                      <h3 className="text-2xl font-semibold mb-2 text-gray-800">Team Collaboration</h3>
                      <p className="text-gray-600">Real-time chat, file sharing, and integrated tools to keep your team in sync.</p>
                    </Card>
                    <Card>
                      <h3 className="text-2xl font-semibold mb-2 text-gray-800">Productivity Boost</h3>
                      <p className="text-gray-600">Automate repetitive tasks and get deep insights with powerful analytics.</p>
                    </Card>
                  </CardSwap>
                </div>
              </div>
            </div> {/* End of two-column flex container */}
          </div> {/* End of CARD SWAP SECTION mb-20 */}

          {/* USER SHOWCASE SECTION */}
          <div className="my-20 pt-10 mt-20">
            <div className="max-w-6xl mx-auto px-6">

              {/* CONTAINER: ใช้ Flexbox สำหรับการแบ่ง 2 คอลัมน์บนจอขนาดกลางขึ้นไป */}
              <div className="flex flex-col md:flex-row items-center md:space-x-12">

                {/* 1. คอลัมน์ซ้าย: UserCardSwap */}
                {/* กำหนดให้กว้าง 50% และจัดให้องค์ประกอบอยู่ตรงกลางคอลัมน์ */}
                <div className="md:w-1/2 flex justify-center mb-10 md:mb-0">
                  <UserCardSwap />
                </div>

                {/* 2. คอลัมน์ขวา: ข้อความ/คำอธิบาย */}
                {/* กำหนดให้กว้าง 50% และจัดข้อความชิดซ้าย */}
                <div className="md:w-1/2 text-left">
                  <h2 className="text-4xl font-extrabold mb-4 text-gray-900">
                    <span className="text-purple-600">พบปะ</span> ผู้ใช้งาน
                    และ <span className="text-purple-600">พันธมิตร</span> ของเรา
                  </h2>
                  <p className="text-lg text-gray-600 mb-6">
                    MANJU ไม่ได้เป็นเพียงแค่เครื่องมือ แต่เป็น Ecosystem ที่เชื่อมโยงผู้คน
                    จากหลากหลายอาชีพเข้าด้วยกัน ไม่ว่าคุณจะเป็นนักธุรกิจที่ต้องการขยายตลาด,
                    ครูที่ต้องการนวัตกรรมในการสอน, หรือนักพัฒนาที่กำลังมองหาโซลูชั่น AI
                    เรามีสิ่งที่ตอบโจทย์ทุกความต้องการ
                  </p>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-purple-500 mr-2 mt-1">✓</span>
                      <strong>ขยายเครือข่าย:</strong> เชื่อมต่อกับผู้สร้างและผู้ประกอบการในอุตสาหกรรมเดียวกัน
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-500 mr-2 mt-1">✓</span>
                      <strong>แรงบันดาลใจใหม่ๆ:</strong> เรียนรู้ว่าผู้อื่นใช้แพลตฟอร์มของเราในการแก้ปัญหาอย่างไร
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-500 mr-2 mt-1">✓</span>
                      <strong>สร้างความร่วมมือ:</strong> ค้นหาผู้เชี่ยวชาญเพื่อเริ่มต้นโปรเจกต์ใหม่ร่วมกัน
                    </li>
                  </ul>
                </div>

              </div>
            </div>
          </div>


          {/* CONTENT INPUT PAGE */}
          <div className="flex flex-col items-center mb-20 mt-75">

            <h2 className="text-3xl font-bold mb-4 text-gray-800">
              Start Your Project Today
            </h2>

            <p className="text-lg text-gray-600 mb-8 max-w-xl text-center">
              ป้อนข้อมูลหรือคำสั่งของคุณด้านล่าง เพื่อเริ่มต้นการจัดการงานใน MANJU
            </p>

            <ContentInputPage />
          </div>

        </section> {/* End of HERO SECTION */}
      </div> {/* End of relative z-20 (Main content) */}
    </div> // End of w-full min-h-screen
  );
}