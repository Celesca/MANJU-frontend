import { Github, Linkedin, Mail, Trophy, Code2, Terminal } from 'lucide-react';

// --- IMPORT IMAGES ---
// นำรูปภาพที่คุณอัปโหลดไปใส่ใน folder assets แล้ว import เข้ามาครับ
import sawitImg from '../assets/folk.png';   // รูปคุณ Sawit (Folk)
import sirateeImg from '../assets/otwo.jpg'; // รูปคุณ Siratee (Oat)
import punchayaImg from '../assets/kaew.png'; // รูปคุณ Punchaya (Pang)
import Navbar from '../components/Navbar';

const AboutPage = () => {
  
  // ข้อมูลสมาชิกทีม (ดึงจากรูปภาพและเอกสารที่ส่งมา)
  const teamMembers = [
    {
      id: "sawit",
      name: "Sawit Koseeyaumporn",
      nickname: "Folk",
      role: "AI Engineer / System Architect",
      img: sawitImg,
      bio: "Computer Engineering Student @KMUTT. ปัจจุบันเป็น Machine Learning Engineer ที่ SCB และมีประสบการณ์ฝึกงานด้าน AI Engineer อย่างเข้มข้น มีความเชี่ยวชาญด้าน MLOps และ System Architecture",
      skills: ["Python", "Machine Learning", "DevOps", "Docker", "SCG", "SCB"],
      achievements: [
        "Gold Medal Super AI Engineer Season 5 (Track 2: AI Engineer)",
        "Winner GenAI Hackathon by Mitr Phol Group",
        "Winner BDI Hackathon AI & Data Innovation",
        "Beta Microsoft Learn Student Ambassador"
      ],
      socials: {
        github: "https://github.com/Celesca",
        email: "folk.sawit@gmail.com",
        linkedin: "#"
      },
      color: "from-blue-500 to-indigo-600"
    },
    {
      id: "siratee",
      name: "Siratee Saiprom",
      nickname: "Otwo",
      role: "Full-Stack Developer / UX/UI",
      img: sirateeImg,
      bio: "Web Full-Stack Developer และ Automate QA Tester ผู้หลงใหลในการสร้างสรรค์เว็บไซต์ที่มีประสิทธิภาพ มุ่งมั่นในการพัฒนาตนเองและประยุกต์ใช้ความรู้เพื่อส่งมอบผลงานที่มีคุณภาพสูงสุด",
      skills: ["TypeScript", "React", "Next.js", "Python", "Docker", "Figma", "Automate Test"],
      achievements: [
        "Full-Stack Development Specialist",
        "Experience in Automated QA Testing",
        "Exceptional Teamwork & Collaboration Skills"
      ],
      socials: {
        github: "https://github.com/SOtwoX1",
        email: "siratee6775@gmail.com",
        linkedin: "#"
      },
      color: "from-violet-500 to-purple-600"
    },
    {
      id: "punchaya",
      name: "Punchaya Chancharoen",
      nickname: "Kaewkloaw",
      role: "Creative Design / Documentation",
      img: punchayaImg,
      bio: "A blooming tech enthusiast who blends code with creativity. นักพัฒนาที่ผสมผสานโค้ดเข้ากับความคิดสร้างสรรค์ เชี่ยวชาญทั้งด้านการออกแบบ UX/UI และการเขียนโปรแกรมฝั่ง Frontend",
      skills: ["Vue.js", "React", "Figma", "Adobe XD", "Python", "C++", "Power Apps"],
      achievements: [
        "The Winner, GenAI Hackathon Powered by Mitr Phol Group 2025",
        "The 2nd Runner-Up, KBTG Showcase & Project Pitching Day 2025",
        "Top 9 Finalist, Axtra Mile Hackathon 2025",
        "Honorable Mention, SuperAI Innovator 2025"
      ],
      socials: {
        github: "https://github.com/Kaewkloaw",
        email: "punchaya.chan@gmail.com", // แก้ไขเป็นอีเมลจริงถ้ามี
        linkedin: "#"
      },
      color: "from-pink-500 to-rose-500"
    }
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      <Navbar />
      
      {/* --- HERO SECTION: TEAM OVERVIEW --- */}
      <div className="pt-24 pb-16 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <span className="text-violet-600 font-bold tracking-wider text-sm uppercase mb-2 block">
            The Creators
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6">
            Meet the <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">MANJU Team</span>
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg mb-16">
            เบื้องหลังนวัตกรรม AI ที่สร้างสรรค์เทคโนโลยีเพื่อยกระดับการสื่อสาร
          </p>

          {/* 3 Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {teamMembers.map((member) => (
              <a 
                href={`#${member.id}`} 
                key={member.id}
                className="group relative bg-white rounded-2xl p-6 border border-slate-200 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer"
              >
                <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${member.color} rounded-t-2xl`} />
                <div className="w-32 h-32 mx-auto mb-6 rounded-full p-1 bg-gradient-to-tr from-slate-200 to-white shadow-inner">
                  <img 
                    src={member.img} 
                    alt={member.name} 
                    className="w-full h-full object-cover rounded-full border-4 border-white shadow-sm group-hover:scale-105 transition-transform duration-500" 
                  />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">{member.name}</h3>
                <p className="text-violet-600 text-sm font-medium mb-2">{member.role}</p>
                <div className="flex justify-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                   <div className="w-8 h-1 rounded-full bg-slate-200 group-hover:bg-slate-300 transition-colors" />
                </div>
              </a>
            ))}
          </div>
          
          <div className="mt-16 animate-bounce text-slate-400">
            <svg className="w-6 h-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span className="text-xs">Scroll to know us better</span>
          </div>
        </div>
      </div>

      {/* --- DETAILED SECTIONS --- */}
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-24">
        {teamMembers.map((member, index) => (
          <div 
            key={member.id} 
            id={member.id} 
            className={`flex flex-col lg:flex-row gap-12 items-center ${index % 2 !== 0 ? 'lg:flex-row-reverse' : ''} scroll-mt-24`}
          >
            {/* Image Column */}
            <div className="w-full lg:w-1/3 relative group">
              <div className={`absolute inset-0 bg-gradient-to-tr ${member.color} rounded-[2rem] rotate-6 opacity-20 group-hover:rotate-3 transition-transform duration-500`}></div>
              <div className="relative rounded-[2rem] overflow-hidden border-8 border-white shadow-2xl">
                <img src={member.img} alt={member.name} className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105" />
              </div>
              
              {/* Floating Badge (Example) */}
              <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-xl shadow-xl border border-slate-100 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                 <div className={`p-2 rounded-lg bg-gradient-to-r ${member.color} text-white`}>
                    <Code2 size={20} />
                 </div>
                 <div>
                    <div className="text-xs text-slate-500 font-bold uppercase">Nickname</div>
                    <div className="text-sm font-bold text-slate-800">{member.nickname}</div>
                 </div>
              </div>
            </div>

            {/* Content Column */}
            <div className="w-full lg:w-2/3">
              <div className="mb-6">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">{member.name}</h2>
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${member.color}`}>
                  {member.role}
                </div>
              </div>

              <div className="prose prose-slate text-slate-600 mb-8 leading-relaxed text-lg">
                <p>{member.bio}</p>
              </div>

              {/* Skills Grid */}
              <div className="mb-8">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Terminal size={16} /> Skill
                </h4>
                <div className="flex flex-wrap gap-2">
                  {member.skills.map((skill, idx) => (
                    <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-600 text-sm font-medium rounded-md border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Achievements List */}
              <div className="mb-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Trophy size={16} className="text-yellow-500" /> Highlights & Achievements
                </h4>
                <ul className="space-y-3">
                  {member.achievements.map((achieve, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-slate-600 text-sm">
                      <div className={`mt-1.5 w-1.5 h-1.5 rounded-full bg-gradient-to-r ${member.color} flex-shrink-0`} />
                      {achieve}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Social Links */}
              <div className="flex gap-4">
                <a href={member.socials.github} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                  <Github size={24} />
                </a>
                <a href={`mailto:${member.socials.email}`} className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                  <Mail size={24} />
                </a>
                <a href={member.socials.linkedin} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Linkedin size={24} />
                </a>
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* --- FOOTER CTA --- */}
      <div className="py-20 text-center bg-slate-900 mt-12">
        <h2 className="text-3xl font-bold text-white mb-6">Want to work with us?</h2>
        <a href="mailto:folk.sawit@gmail.com" className="inline-block px-8 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-full font-medium transition-colors shadow-lg shadow-violet-500/30">
          Contact Our Team
        </a>
      </div>

    </div>
  );
};

export default AboutPage;