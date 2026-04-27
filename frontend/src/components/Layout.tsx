import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { FileText, CreditCard, LogOut, Menu, X } from 'lucide-react';

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
    <div className="min-h-dvh bg-[#F5F5F7]">
      {/* Nav bar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E8E8ED]">
        <div className="max-w-7xl mx-auto px-4 sm:px-10 flex items-center justify-between h-11 md:h-12">

          {/* Logo — clean wordmark, no icon background */}
          <Link
            to="/"
            className="text-[#1D1D1F] no-underline hover:no-underline"
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif",
              fontSize: '17px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              lineHeight: 1,
            }}
          >
            eSignatureGO
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {/* Documents */}
            <Link
              to="/"
              className={[
                'relative flex items-center gap-1.5 px-3 h-11 md:h-12 text-[15px] transition-colors duration-150 no-underline hover:no-underline',
                isDocumentsActive
                  ? 'text-[#0071E3] font-medium'
                  : 'text-[#1D1D1F] hover:text-[#0071E3]',
              ].join(' ')}
            >
              <FileText className="h-[15px] w-[15px]" />
              Documents
              {isDocumentsActive && (
                <motion.div
                  layoutId="nav-underline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0071E3]"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </Link>

            {/* Credits */}
            <Link
              to="/credits"
              className={[
                'relative flex items-center gap-1.5 px-3 h-11 md:h-12 text-[15px] transition-colors duration-150 no-underline hover:no-underline',
                isCreditsActive
                  ? 'text-[#0071E3] font-medium'
                  : 'text-[#1D1D1F] hover:text-[#0071E3]',
              ].join(' ')}
            >
              <CreditCard className="h-[15px] w-[15px]" />
              Credits
              {/* Credit count pill */}
              <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#F5F5F7] border border-[#E8E8ED] text-[#1D1D1F]">
                {user?.credits ?? 0}
              </span>
              {isCreditsActive && (
                <motion.div
                  layoutId="nav-underline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0071E3]"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </Link>

            {/* Divider + user info + sign out */}
            <div className="flex items-center gap-3 pl-4 ml-2 border-l border-[#E8E8ED]">
              <span className="text-[13px] text-[#6E6E73] truncate max-w-[120px]">
                {user?.firstName} {user?.lastName}
              </span>
              <motion.button
                onClick={handleLogout}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 text-[15px] text-[#0071E3] hover:underline min-h-[44px] px-1 transition-colors duration-150 bg-transparent border-none cursor-pointer"
                aria-label="Sign out"
              >
                <LogOut className="h-[15px] w-[15px]" />
                Sign out
              </motion.button>
            </div>
          </div>

          {/* Mobile: credit pill + hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#F5F5F7] border border-[#E8E8ED] text-[#1D1D1F]">
              {user?.credits ?? 0}
            </span>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center justify-center w-11 h-11 text-[#1D1D1F] rounded-md transition-colors duration-150 hover:bg-[#F5F5F7]"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="md:hidden overflow-hidden bg-white border-t border-[#E8E8ED]"
            >
              <div className="px-4 py-2 space-y-0.5">
                <button
                  onClick={() => navTo('/')}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-4 rounded-lg text-[15px] min-h-[44px] transition-colors duration-150 text-left',
                    isDocumentsActive
                      ? 'bg-[#F5F5F7] text-[#0071E3] font-medium'
                      : 'text-[#1D1D1F] hover:bg-[#F5F5F7]',
                  ].join(' ')}
                >
                  <FileText className="h-[15px] w-[15px] shrink-0" />
                  Documents
                </button>

                <button
                  onClick={() => navTo('/credits')}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-4 rounded-lg text-[15px] min-h-[44px] transition-colors duration-150 text-left',
                    isCreditsActive
                      ? 'bg-[#F5F5F7] text-[#0071E3] font-medium'
                      : 'text-[#1D1D1F] hover:bg-[#F5F5F7]',
                  ].join(' ')}
                >
                  <CreditCard className="h-[15px] w-[15px] shrink-0" />
                  Credits
                </button>

                {/* Divider + sign out row */}
                <div className="pt-2 mt-2 border-t border-[#E8E8ED] flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-[#6E6E73] truncate">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <button
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-2 text-[15px] text-[#0071E3] min-h-[44px] px-1 bg-transparent border-none cursor-pointer hover:underline transition-colors duration-150"
                  >
                    <LogOut className="h-[15px] w-[15px]" />
                    Sign out
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-10 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
