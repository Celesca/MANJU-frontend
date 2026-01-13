import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FolderOpen,
    Mic,
    ChevronLeft,
    ChevronRight,
    LayoutDashboard
} from 'lucide-react';

interface NavItem {
    name: string;
    href: string;
    icon: React.ElementType;
    disabled?: boolean;
}

const navItems: NavItem[] = [
    { name: 'Projects', href: '/console/projects', icon: FolderOpen },
    { name: 'Voices', href: '/console/voices', icon: Mic },
];

export default function ConsoleSidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const location = useLocation();

    return (
        <motion.aside
            initial={false}
            animate={{ width: collapsed ? 64 : 240 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="h-[calc(100vh-4rem)] bg-slate-900 text-white flex flex-col border-r border-slate-800 relative sticky top-16"
        >
            {/* Header */}
            <div className="p-4 border-b border-slate-800">
                <Link to="/" className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-sky-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <LayoutDashboard className="w-4 h-4 text-white" />
                    </div>
                    <AnimatePresence>
                        {!collapsed && (
                            <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                className="font-bold text-lg whitespace-nowrap overflow-hidden"
                            >
                                Console
                            </motion.span>
                        )}
                    </AnimatePresence>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-2 space-y-1">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.href ||
                        (item.href !== '/console' && location.pathname.startsWith(item.href));
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.name}
                            to={item.disabled ? '#' : item.href}
                            className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                ${item.disabled
                                    ? 'opacity-50 cursor-not-allowed'
                                    : isActive
                                        ? 'bg-purple-600/20 text-purple-400'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }
              `}
                            onClick={(e) => item.disabled && e.preventDefault()}
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            <AnimatePresence>
                                {!collapsed && (
                                    <motion.span
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: 'auto' }}
                                        exit={{ opacity: 0, width: 0 }}
                                        className="whitespace-nowrap overflow-hidden text-sm font-medium"
                                    >
                                        {item.name}
                                        {item.disabled && (
                                            <span className="ml-2 text-xs text-slate-500">(Coming Soon)</span>
                                        )}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </Link>
                    );
                })}
            </nav>

            {/* Collapse Toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors z-10"
            >
                {collapsed ? (
                    <ChevronRight className="w-3 h-3" />
                ) : (
                    <ChevronLeft className="w-3 h-3" />
                )}
            </button>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800">
                <AnimatePresence>
                    {!collapsed && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-xs text-slate-500"
                        >
                            MANJU Platform
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        </motion.aside>
    );
}
