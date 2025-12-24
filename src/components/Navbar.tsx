import { useState, useEffect } from "react";
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronRight, LogOut, User as ChevronDown } from "lucide-react";

interface UserData {
  id: string;
  name: string;
  email: string;
  picture: string;
  preference_language?: string;
  regist_source?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [user, setUser] = useState<UserData | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const location = useLocation();

  const whiteBgPages = ["/projects", "/profile", "/login", "/demo", "/features", "/pricing", "/about"];
  const isWhitePage = whiteBgPages.some(path => location.pathname.startsWith(path));

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return null;
  };

  useEffect(() => {
    const checkUserLogin = () => {
      const userCookie = getCookie("manju_user");
      console.log("Checking manju_user cookie (raw):", userCookie);
      if (userCookie) {
        try {
          // Decode from Base64
          const decodedValue = atob(decodeURIComponent(userCookie));
          console.log("Decoded user data string:", decodedValue);
          const userData = JSON.parse(decodedValue);
          console.log("Parsed user data object:", userData);
          setUser(userData);
        } catch (error) {
          console.error("Failed to parse user cookie", error);
          // Fallback: try parsing without atob in case it's not base64 yet
          try {
            const userData = JSON.parse(decodeURIComponent(userCookie));
            setUser(userData);
          } catch (e) {
            setUser(null);
          }
        }
      } else {
        console.log("No manju_user cookie found");
        setUser(null);
      }
    };
    checkUserLogin();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    console.log("Attempting logout...");
    try {
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: "GET",
        credentials: "include",
      });

      console.log("Logout response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("Logout successful:", data);
        setUser(null);
        setIsProfileOpen(false);
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.onerror = null;
    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=random&color=fff`;
  };

  const isDarkTheme = scrolled || isWhitePage;

  const textColor = isDarkTheme ? 'text-slate-800' : 'text-white';
  const hoverColor = isDarkTheme ? 'hover:text-purple-600' : 'hover:text-purple-300';
  const logoColor = isDarkTheme ? 'text-slate-800' : 'text-white';
  const buttonTextColor = isDarkTheme ? 'text-slate-700' : 'text-white';
  const mobileToggleColor = isDarkTheme ? 'text-slate-800' : 'text-white';
  const borderColor = isDarkTheme ? 'border-slate-200' : 'border-white/20';
  const hoverBgUser = isDarkTheme ? 'hover:bg-slate-100' : 'hover:bg-white/10';

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Projects", href: "/projects" },
    { name: "Features", href: "/features" },
    { name: "About", href: "/about" },
    { name: "Pricing", href: "/pricing" },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ease-in-out
        ${scrolled
            ? "bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm py-3"
            : "bg-transparent py-5"
          }`}
      >
        <nav className="max-w-7xl mx-auto flex items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 cursor-pointer group">
            <img
              src="https://www.vhv.rs/dpng/d/516-5169511_voice-ai-png-transparent-png.png"
              className={`w-8 h-8 rounded-md object-cover ${logoColor}`}
              alt="Logo"
            />
            <span className={`text-xl font-bold tracking-tight ${logoColor} group-hover:text-purple-600 transition-colors`}>
              MANJU
            </span>
          </Link>

          <ul className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.name}>
                <a
                  href={link.href}
                  className={`text-sm font-medium ${textColor} ${hoverColor} transition-colors relative group`}
                >
                  {link.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-purple-600 transition-all duration-300 group-hover:w-full"></span>
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden md:flex items-center gap-4 relative">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className={`flex items-center gap-3 p-1 pr-3 rounded-full transition-all border ${borderColor} ${hoverBgUser}`}
                >
                  <img
                    src={user.picture}
                    onError={handleImageError}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border border-white/50 shadow-sm object-cover"
                  />
                  <span className={`text-sm font-medium max-w-[100px] truncate ${textColor}`}>
                    {user.name}
                  </span>
                  <ChevronDown size={14} className={textColor} />
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden py-1 z-50"
                    >
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      </div>

                      {/* <Link to="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors">
                        <UserIcon size={16} />
                        Profile
                      </Link> */}

                      <div className="border-t border-slate-100 my-1"></div>

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={16} />
                        Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`text-sm font-medium ${buttonTextColor} ${hoverColor} px-4 py-2 transition-colors`}
                >
                  Log in
                </Link>
                <Link
                  to="/login"
                >
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg shadow-slate-900/20 hover:shadow-slate-900/40 flex items-center gap-2 transition-all"
                  >
                    Get Started
                    <ChevronRight size={16} />
                  </motion.button>
                </Link>
              </>
            )}
          </div>

          <div className="md:hidden flex items-center gap-4">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`p-2 ${mobileToggleColor} rounded-md hover:bg-white/20 transition-colors focus:outline-none`}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="fixed top-[60px] left-0 w-full bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-xl z-40 md:hidden overflow-hidden"
          >
            <div className="flex flex-col p-6 space-y-4">
              {user && (
                <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
                  <img
                    src={user.picture}
                    onError={handleImageError}
                    alt={user.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-800">{user.name}</span>
                    <span className="text-xs text-slate-500">{user.email}</span>
                  </div>
                </div>
              )}

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
                {user ? (
                  <button
                    onClick={handleLogout}
                    className="w-full py-3 flex items-center justify-center gap-2 text-red-600 font-medium bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <LogOut size={18} />
                    Sign out
                  </button>
                ) : (
                  <>
                    <Link to="/login" className="w-full">
                      <button className="w-full py-3 text-slate-700 font-medium hover:bg-slate-50 rounded-lg transition-colors">
                        Log in
                      </button>
                    </Link>
                    <button className="w-full py-3 bg-gradient-to-r from-purple-600 to-sky-500 text-white font-semibold rounded-lg shadow-md active:scale-95 transition-transform">
                      Get Started
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;