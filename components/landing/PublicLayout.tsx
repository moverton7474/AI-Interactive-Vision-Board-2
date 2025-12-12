import React, { useState, useEffect } from 'react';

interface PublicLayoutProps {
  children: React.ReactNode;
  onLoginClick: () => void;
  onGetStartedClick: () => void;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({
  children,
  onLoginClick,
  onGetStartedClick
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showMobileStickyCTA, setShowMobileStickyCTA] = useState(false);

  // Show sticky CTA after scrolling past hero section
  useEffect(() => {
    const handleScroll = () => {
      const heroHeight = window.innerHeight * 0.6; // 60% of viewport
      setShowMobileStickyCTA(window.scrollY > heroHeight);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Public Navigation */}
      <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="w-10 h-10 bg-navy-900 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                <span className="text-gold-500 font-serif font-bold text-2xl">V</span>
              </div>
              <span className="text-2xl font-serif font-bold text-navy-900">Visionary</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <button
                onClick={() => scrollToSection('features')}
                className="text-sm font-medium text-gray-600 hover:text-navy-900 transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="text-sm font-medium text-gray-600 hover:text-navy-900 transition-colors"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollToSection('pricing')}
                className="text-sm font-medium text-gray-600 hover:text-navy-900 transition-colors"
              >
                Pricing
              </button>

              <div className="h-6 w-px bg-gray-200"></div>

              <button
                onClick={onLoginClick}
                className="text-sm font-semibold text-navy-900 hover:text-gold-600 transition-colors"
              >
                Log In
              </button>
              <button
                onClick={onGetStartedClick}
                className="bg-navy-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-navy-800 hover:scale-105 transition-all hover:shadow-lg"
              >
                Start Free
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden items-center gap-3">
              <button
                onClick={onLoginClick}
                className="text-sm font-semibold text-navy-900"
              >
                Log In
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6 text-navy-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-4 px-4 space-y-3">
            <button
              onClick={() => scrollToSection('features')}
              className="block w-full text-left py-2 text-gray-600 hover:text-navy-900"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="block w-full text-left py-2 text-gray-600 hover:text-navy-900"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="block w-full text-left py-2 text-gray-600 hover:text-navy-900"
            >
              Pricing
            </button>
            <button
              onClick={onGetStartedClick}
              className="w-full bg-navy-900 text-white font-semibold py-3 rounded-xl mt-2"
            >
              Start My Vision Board
            </button>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile Sticky CTA */}
      <div
        className={`fixed bottom-0 left-0 right-0 md:hidden bg-white/95 backdrop-blur-sm border-t border-gray-200 p-4 z-50 transition-transform duration-300 ${
          showMobileStickyCTA ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <button
          onClick={onGetStartedClick}
          className="w-full bg-navy-900 text-white font-bold py-4 rounded-full shadow-lg hover:bg-navy-800 transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5 text-gold-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          Start My Vision Board - Free
        </button>
      </div>
    </div>
  );
};

export default PublicLayout;
