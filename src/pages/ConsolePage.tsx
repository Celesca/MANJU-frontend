import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ConsoleSidebar from '../components/ConsoleSidebar';
import Navbar from '../components/Navbar';
import { Loader2 } from 'lucide-react';

export default function ConsolePage() {
    const { user, loading } = useAuth();
    const location = useLocation();

    // Show loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Redirect /console to /console/projects by default
    if (location.pathname === '/console') {
        return <Navigate to="/console/projects" replace />;
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            {/* Top Navbar */}
            <Navbar />

            {/* Main Content Area */}
            <div className="flex-1 flex pt-16">
                {/* Sidebar */}
                <ConsoleSidebar />

                {/* Content */}
                <main className="flex-1 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
