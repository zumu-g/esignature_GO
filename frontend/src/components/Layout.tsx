import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { FileText, CreditCard, LogOut, PenTool } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isDocumentsActive = location.pathname === '/' || location.pathname.startsWith('/documents');
  const isCreditsActive = location.pathname === '/credits';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-blue-600">
            <PenTool className="h-6 w-6" />
            eSignatureGO
          </Link>

          <div className="flex items-center gap-6">
            <Link to="/" className={`relative flex items-center gap-1.5 text-sm transition-colors duration-150 ${isDocumentsActive ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}>
              <FileText className="h-4 w-4" />
              Documents
              {isDocumentsActive && (
                <motion.div
                  layoutId="nav-underline"
                  className="absolute -bottom-3 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </Link>
            <Link to="/credits" className={`relative flex items-center gap-1.5 text-sm transition-colors duration-150 ${isCreditsActive ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}>
              <CreditCard className="h-4 w-4" />
              Credits
              <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {user?.credits ?? 0}
              </span>
              {isCreditsActive && (
                <motion.div
                  layoutId="nav-underline"
                  className="absolute -bottom-3 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </Link>

            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <span className="text-sm text-gray-600">
                {user?.firstName} {user?.lastName}
              </span>
              <motion.button
                onClick={handleLogout}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors duration-150 rounded-md"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
