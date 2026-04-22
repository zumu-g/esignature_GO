import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { FileText, CreditCard, LogOut, PenTool, Menu, X } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDocumentsActive = location.pathname === '/' || location.pathname.startsWith('/documents');
  const isCreditsActive = location.pathname === '/credits';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navTo = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-dvh bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-blue-600">
            <PenTool className="h-6 w-6" />
            eSignatureGO
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className={`relative flex items-center gap-1.5 text-sm min-h-[44px] transition-colors duration-150 ${isDocumentsActive ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}>
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
            <Link to="/credits" className={`relative flex items-center gap-1.5 text-sm min-h-[44px] transition-colors duration-150 ${isCreditsActive ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}>
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
              <span className="text-sm text-gray-600 truncate max-w-[120px]">
                {user?.firstName} {user?.lastName}
              </span>
              <motion.button
                onClick={handleLogout}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2.5 text-gray-400 hover:text-gray-600 transition-colors duration-150 rounded-md min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </motion.button>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {user?.credits ?? 0}
            </span>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 text-gray-600 rounded-md min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden"
            >
              <div className="pt-3 pb-1 space-y-1 border-t border-gray-100 mt-3">
                <button
                  onClick={() => navTo('/')}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm min-h-[44px] ${isDocumentsActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}
                >
                  <FileText className="h-4 w-4" />
                  Documents
                </button>
                <button
                  onClick={() => navTo('/credits')}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm min-h-[44px] ${isCreditsActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}
                >
                  <CreditCard className="h-4 w-4" />
                  Credits
                </button>
                <div className="flex items-center justify-between px-3 py-3 border-t border-gray-100 mt-1">
                  <span className="text-sm text-gray-500 truncate">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <button
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-2 text-sm text-red-600 p-2 rounded-md min-h-[44px]"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
