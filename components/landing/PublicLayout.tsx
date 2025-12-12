import React, { useState, useEffect } from 'react';
import { VisionaryLogo, VisionaryIcon } from '../Icons';

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
  const [scrolled, setScrolled] = useState(false);

  // Show sticky CTA after scrolling past hero section
  useEffect(() => {
    const handleScroll = () => {
      const heroHeight = window.innerHeight * 0.6; // 60% of viewport
      setShowMobileStickyCTA(window.scrollY > heroHeight);
      setScrolled(window.scrollY > 50);
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
    <div className="min-h-screen bg-navy-950 flex flex-col">
      {/* Public Navigation */}
      <nav className={`${scrolled ? 'bg-navy-900/95 backdrop-blur-sm shadow-lg' : 'bg-transparent'} border-b border-gold-500/10 sticky top-0 z-50 transition-all duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <VisionaryLogo variant="full" size="md" theme="light" />
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <button
                onClick={() => scrollToSection('features')}
                className="text-sm font-medium text-gray-300 hover:text-gold-400 transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="text-sm font-medium text-gray-300 hover:text-gold-400 transition-colors"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollToSection('pricing')}
                className="text-sm font-medium text-gray-300 hover:text-gold-400 transition-colors"
              >
                Pricing
              </button>

              <div className="h-6 w-px bg-gold-500/20"></div>

              <button
                onClick={onLoginClick}
                className="text-sm font-semibold text-gold-400 hover:text-gold-300 transition-colors"
              >
                Log In
              </button>
              <button
                onClick={onGetStartedClick}
                className="bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 text-navy-900 text-sm font-semibold px-5 py-2.5 rounded-full hover:shadow-gold-500/25 hover:shadow-lg hover:scale-105 transition-all"
              >
                Start Free
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden items-center gap-3">
              <button
                onClick={onLoginClick}
                className="text-sm font-semibold text-gold-400"
              >
                Log In
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-navy-800"
              >
                <svg className="w-6 h-6 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="md:hidden bg-navy-900 border-t border-gold-500/10 py-4 px-4 space-y-3">
            <button
              onClick={() => scrollToSection('features')}
              className="block w-full text-left py-2 text-gray-300 hover:text-gold-400"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="block w-full text-left py-2 text-gray-300 hover:text-gold-400"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="block w-full text-left py-2 text-gray-300 hover:text-gold-400"
            >
              Pricing
            </button>
            <button
              onClick={onGetStartedClick}
              className="w-full bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 text-navy-900 font-semibold py-3 rounded-xl mt-2"
            >
              Begin My Ascension
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
        className={`fixed bottom-0 left-0 right-0 md:hidden bg-navy-900/95 backdrop-blur-sm border-t border-gold-500/20 p-4 z-50 transition-transform duration-300 ${
          showMobileStickyCTA ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <button
          onClick={onGetStartedClick}
          className="w-full bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 text-navy-900 font-bold py-4 rounded-full shadow-lg hover:shadow-gold-500/25 transition-all flex items-center justify-center gap-2"
        >
          <VisionaryIcon size={20} color="#1A1A2E" />
          Begin My Ascension - Free
        </button>
      </div>
    </div>
  );
};

export default PublicLayout;
