import Navbar from '../components/Navbar';
import Aurora from '../components/Backgound';
import { motion } from 'framer-motion';
import { Server, ShieldCheck } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080';
const BACKEND_LOGIN = `${API_BASE}/auth/login/google`;

export default function Login() {
  return (
    <div className="w-full min-h-screen bg-white text-slate-900 relative overflow-hidden font-sans">

      {/* 1. Navbar */}
      <div className="relative z-50">
        <Navbar />
      </div>

      {/* 2. Aurora Background with Custom Colors */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-80">
        <Aurora
          colorStops={["#0F172A", "#8B5CF6", "#3B82F6", "#F1F5F9"]} // สีตามที่คุณระบุ
          amplitude={1.0}
          blend={0.5}
          speed={0.5}
        />
      </div>

      {/* 3. Main Content */}
      <div className="relative z-20 flex flex-col justify-center items-center min-h-[calc(100vh-80px)] px-4 py-12">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-3xl"
        >
          {/* Card Container */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 p-8 md:p-12 text-center">
            
            {/* Header Section */}
            <div className="mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-50 text-violet-600 mb-6 shadow-sm ring-1 ring-violet-100">
                <ShieldCheck size={32} />
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
                Sign in with <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600">Google</span>
              </h1>
              <p className="text-lg text-slate-500 max-w-xl mx-auto">
                This app uses the backend to handle the OAuth flow securely.
                <br className="hidden md:block"/> Click the button below to continue.
              </p>
            </div>

            {/* Button Section */}
            <div className="flex justify-center mb-12">
              <a href={BACKEND_LOGIN} className="group relative inline-flex items-center justify-center">
                {/* Glow Effect behind button */}
                <div className="absolute transition-all duration-200 rounded-full -inset-1 bg-gradient-to-r from-violet-600 to-blue-600 opacity-30 blur group-hover:opacity-50 group-hover:duration-200 animate-tilt"></div>
                
                {/* Violet Button */}
                <button className="relative inline-flex items-center justify-center bg-violet-600 hover:bg-violet-700 text-white text-lg font-semibold py-4 px-10 rounded-xl shadow-xl transition-all duration-200 transform hover:-translate-y-1">
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                     <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z"></path>
                  </svg>
                  Sign in with Google
                </button>
              </a>
            </div>

            {/* Technical Notes Section */}
            <div className="text-left bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <div className="flex items-center gap-2 mb-4 text-slate-700 font-semibold border-b border-slate-200 pb-2">
                <Server size={18} className="text-slate-400"/>
                <span>Developer Notes:</span>
              </div>
              
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                  <span>
                    Ensure your Google OAuth client has redirect URI: 
                    <code className="bg-white border border-slate-200 px-2 py-0.5 rounded text-violet-600 font-mono ml-1 break-all">
                      http://localhost:8080/api/auth/callback/google
                    </code>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                  <span>
                    Server is expected to perform the exchange and set session/cookie or redirect back to the frontend home page.
                  </span>
                </li>
              </ul>
            </div>

          </div>
        </motion.div>
      </div>

    </div>
  );
}