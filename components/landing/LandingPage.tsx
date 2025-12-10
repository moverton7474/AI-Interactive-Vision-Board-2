import React, { useState } from 'react';
import { PublicLayout } from './PublicLayout';
import { VisionHero } from './VisionHero';
import { PathCards } from './PathCards';
import { FeaturesSection } from './FeaturesSection';
import { ProofSection } from './ProofSection';
import { LandingFooter } from './LandingFooter';
import Pricing from '../Pricing';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  // No-op for pricing upgrade on landing page (user needs to sign up first)
  const handlePricingUpgrade = () => {
    onGetStarted();
  };

  return (
    <PublicLayout onLoginClick={onLogin} onGetStartedClick={onGetStarted}>
      {/* Hero Section */}
      <VisionHero onGetStarted={onGetStarted} />

      {/* Path Cards - Feature highlights */}
      <PathCards onGetStarted={onGetStarted} />

      {/* How It Works Section */}
      <FeaturesSection />

      {/* Social Proof / Testimonials */}
      <ProofSection onGetStarted={onGetStarted} />

      {/* Pricing Section */}
      <div id="pricing">
        <Pricing onUpgrade={handlePricingUpgrade} />
      </div>

      {/* Footer */}
      <LandingFooter onLoginClick={onLogin} onGetStartedClick={onGetStarted} />
    </PublicLayout>
  );
};

export default LandingPage;
