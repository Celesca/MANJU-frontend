import { useState, useEffect } from "react";
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronRight } from "lucide-react";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      // ตรวจสอบว่าเลื่อนเกิน 20px หรือไม่
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ใช้ตัวแปรเพื่อกำหนดสีตามสถานะ scrolled
  const textColor = scrolled ? 'text-slate-800' : 'text-white';
  const hoverColor = scrolled ? 'hover:text-purple-600' : 'hover:text-purple-300';
  const logoColor = scrolled ? 'text-slate-800' : 'text-white';
  const buttonTextColor = scrolled ? 'text-slate-700' : 'text-white';
  const mobileToggleColor = scrolled ? 'text-slate-800' : 'text-white';

  const navLinks = [
    { name: "Overview", href: "/voice" },
    { name: "Features", href: "#" },
    { name: "About", href: "#" },
    { name: "Pricing", href: "#" },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ease-in-out
        ${
          scrolled
            ? "bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm py-3"
            : "bg-transparent py-5"
        }`}
      >
        <nav className="max-w-7xl mx-auto flex items-center justify-between px-6">
          {/* --- Logo --- */}
          <div className="flex items-center gap-2 cursor-pointer group">
              <img
                src="https://www.vhv.rs/dpng/d/516-5169511_voice-ai-png-transparent-png.png"
                className={`w-4 h-4 mr-2 rounded-sm ${logoColor}`} // สามารถกำหนดสีไอคอน/รูปภาพได้
                alt="Flag"
              />
            {/* ปรับสี Logo ตามสถานะ scrolled */}
            <span className={`text-xl font-bold tracking-tight ${logoColor} group-hover:text-black transition-colors`}>
              MANJU
            </span>
          </div>

          {/* --- Desktop Menu --- */}
          <ul className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.name}>
                <a
                  href={link.href}
                  // ปรับสี Text และ Hover Color
                  className={`text-sm font-medium ${textColor} ${hoverColor} transition-colors relative group`}
                >
                  {link.name}
                  {/* Hover Underline Animation */}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-purple-600 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </li>
            ))}
          </ul>

          {/* --- Right Actions --- */}
          <div className="hidden md:flex items-center gap-4">
            {/* ปรับสี Text ของ Log in */}
            <Link
              to="/login"
              className={`text-sm font-medium ${buttonTextColor} ${hoverColor} px-4 py-2 transition-colors`}
            >
              Log in
            </Link>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg shadow-slate-900/20 hover:shadow-slate-900/40 flex items-center gap-2 transition-all"
            >
              Get Started
              <ChevronRight size={16} />
            </motion.button>
          </div>

          {/* --- Mobile Menu Toggle --- */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              // ปรับสีไอคอน Mobile Toggle
              className={`p-2 ${mobileToggleColor} rounded-md hover:bg-slate-100 transition-colors focus:outline-none`}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </nav>
      </header>
      
      {/* ... Mobile Dropdown (AnimatePresence) - ไม่ต้องแก้ไขเนื่องจากมีพื้นหลังสีขาวอยู่แล้ว ... */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="fixed top-[60px] left-0 w-full bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-xl z-40 md:hidden overflow-hidden"
          >
            <div className="flex flex-col p-6 space-y-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-lg font-medium text-slate-700 hover:text-purple-600 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                </a>
              ))}
              <hr className="border-slate-200 my-2" />
              <div className="flex flex-col gap-3">
                <Link to="/login" className="w-full">
                  <button className="w-full py-3 text-slate-700 font-medium hover:bg-slate-50 rounded-lg transition-colors">
                    Log in
                  </button>
                </Link>
                <button className="w-full py-3 bg-gradient-to-r from-purple-600 to-sky-500 text-white font-semibold rounded-lg shadow-md active:scale-95 transition-transform">
                  Get Started
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;