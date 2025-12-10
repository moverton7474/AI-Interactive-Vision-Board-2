import React, { useState } from 'react';

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
                className="bg-navy-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-navy-800 transition-all hover:shadow-lg"
              >
                Get Started Free
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
              Get Started Free
            </button>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default PublicLayout;
