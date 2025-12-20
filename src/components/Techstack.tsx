
const TechStackSection = () => {
  const techs = [
    {
      name: "Go (Golang)",
      desc: "High-performance execution engine",
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 5H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2zm-1 10H5V8h14v7zM7 10h3v2H7zm5 0h2v2h-2zm3-5h2v2h-2z" /> 
          {/* Note: Simplified icon representation for code brevity */}
          <path d="M17 11v2h-2v-2h2z" fillOpacity="0.5"/>
        </svg>
      ),
      color: "text-blue-500",
      bg: "bg-blue-50"
    },
    {
      name: "React Flow",
      desc: "Interactive visual workflow builder",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
      color: "text-pink-500",
      bg: "bg-pink-50"
    },
    {
      name: "Docker",
      desc: "Containerized & scalable environments",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      color: "text-sky-600",
      bg: "bg-sky-50"
    },
    {
      name: "PostgreSQL",
      desc: "Reliable data & vector storage",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      ),
      color: "text-indigo-500",
      bg: "bg-indigo-50"
    },
    {
      name: "OpenAI & LLMs",
      desc: "Powered by state-of-the-art AI models",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: "text-green-600",
      bg: "bg-green-50"
    },
    {
      name: "Fiber",
      desc: "Blazing fast web framework",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: "text-orange-500",
      bg: "bg-orange-50"
    }
  ];

  return (
    <div className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            ขับเคลื่อนด้วย <span className="text-violet-600">เทคโนโลยีระดับโลก</span>
          </h2>
          <p className="text-slate-600 text-lg">
            เราเลือกใช้ Tech Stack ที่ทันสมัยที่สุด เพื่อให้มั่นใจว่า AI Agent ของคุณจะทำงานได้รวดเร็ว เสถียร และรองรับการขยายตัวในอนาคต
          </p>
        </div>

        {/* Tech Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {techs.map((tech, index) => (
            <div 
              key={index}
              className="group bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex items-start gap-5">
                {/* Icon Box */}
                <div className={`w-14 h-14 rounded-xl ${tech.bg} ${tech.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                  {tech.icon}
                </div>

                {/* Content */}
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-violet-600 transition-colors">
                    {tech.name}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {tech.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Optional: Bottom Trust Banner */}
        <div className="mt-20 pt-10 border-t border-slate-200 flex flex-col md:flex-row items-center justify-center gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
             <span className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Compatible With</span>
             <div className="flex gap-8 items-center">
                 {/* Placeholders for partner logos (Text version) */}
                 <span className="font-bold text-slate-800 text-xl">OpenAI</span>
                 <span className="font-bold text-slate-800 text-xl">Google Cloud</span>
                 <span className="font-bold text-slate-800 text-xl">AWS</span>
                 <span className="font-bold text-slate-800 text-xl">Vercel</span>
             </div>
        </div>

      </div>
    </div>
  );
};

export default TechStackSection;