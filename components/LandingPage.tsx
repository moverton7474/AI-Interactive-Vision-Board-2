import React, { useState } from 'react';
import {
  SparklesIcon,
  ChartBarIcon,
  BrainIcon,
  CheckCircleIcon,
  PrinterIcon,
  MicIcon,
  MailIcon,
  ShieldCheckIcon,
  StarIcon,
  BankIcon,
  HeartIcon,
  RocketIcon,
  ClockIcon,
  MapIcon,
  EyeIcon,
} from './Icons';

// Play icon for video button
const PlayButtonIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className={className}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

// Watch icon
const WatchIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Phone/SMS icon
const PhoneIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
  </svg>
);

// Identity/User icon
const IdentityIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

// Notebook icon for habit pads
const NotebookIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

// Sticker icon
const StickerIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);

interface Props {
  onStartFree: () => void;
  onWatchDemo: () => void;
  onUpgrade: (tier: 'PRO' | 'ELITE') => void;
}

const LandingPage: React.FC<Props> = ({ onStartFree, onWatchDemo, onUpgrade }) => {
  const [showVideoModal, setShowVideoModal] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* ==================== HERO SECTION ==================== */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-gold-50">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-gold-200/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-navy-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-gold-100/20 to-navy-100/20 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-2 mb-8 shadow-sm">
            <SparklesIcon className="w-4 h-4 text-gold-500" />
            <span className="text-sm font-medium text-gray-600">The World's First Agentic Achievement System</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-navy-900 mb-6 tracking-tight leading-tight">
            See Your Future.
            <br />
            <span className="bg-gradient-to-r from-gold-500 to-gold-600 bg-clip-text text-transparent">
              Then Let AI Help You Achieve It.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
            Emotional visualization meets financial intelligence meets AI execution.
            <br className="hidden md:block" />
            Transform your dreams into reality with personalized coaching that adapts to you.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <button
              onClick={onStartFree}
              className="group bg-navy-900 text-white text-lg font-semibold px-10 py-4 rounded-full shadow-xl hover:bg-navy-800 hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-3"
            >
              <SparklesIcon className="w-6 h-6 text-gold-400 group-hover:rotate-12 transition-transform" />
              Start Free
            </button>
            <button
              onClick={() => setShowVideoModal(true)}
              className="group bg-white text-navy-900 text-lg font-semibold px-10 py-4 rounded-full shadow-lg border-2 border-gray-200 hover:border-gold-400 hover:shadow-xl transition-all duration-300 flex items-center gap-3"
            >
              <div className="w-8 h-8 bg-gold-100 rounded-full flex items-center justify-center group-hover:bg-gold-200 transition-colors">
                <PlayButtonIcon className="w-4 h-4 text-gold-600 ml-0.5" />
              </div>
              Watch 45s Demo
            </button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-8 items-center opacity-60">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ShieldCheckIcon className="w-5 h-5" />
              <span>Bank-level security</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <StarIcon className="w-5 h-5 text-gold-500" />
              <span>4.9/5 rating</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
              </svg>
              <span>Powered by Gemini</span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-gray-300 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-gray-400 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* ==================== QUICK VALUE PROPS ==================== */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="group bg-gradient-to-br from-gold-50 to-white p-8 rounded-3xl border border-gold-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
              <div className="w-14 h-14 bg-gold-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-gold-200 transition-colors">
                <EyeIcon className="w-7 h-7 text-gold-600" />
              </div>
              <h3 className="text-xl font-bold text-navy-900 mb-3">Visualize Your Future</h3>
              <p className="text-gray-600 leading-relaxed">
                AI-generated photorealistic vision boards that capture your dreams with stunning clarity. See yourself living your best life.
              </p>
            </div>

            {/* Card 2 */}
            <div className="group bg-gradient-to-br from-blue-50 to-white p-8 rounded-3xl border border-blue-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-200 transition-colors">
                <BankIcon className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-navy-900 mb-3">Connect to Reality</h3>
              <p className="text-gray-600 leading-relaxed">
                Plaid-powered financial insights show exactly where you stand and what it takes to reach your goals. No guesswork.
              </p>
            </div>

            {/* Card 3 */}
            <div className="group bg-gradient-to-br from-purple-50 to-white p-8 rounded-3xl border border-purple-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-200 transition-colors">
                <BrainIcon className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-navy-900 mb-3">Execute With AI Coaching</h3>
              <p className="text-gray-600 leading-relaxed">
                Daily accountability, smart reminders, and personalized guidance. Your AI Coach keeps you on track across every channel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== HOW IT WORKS ==================== */}
      <section className="py-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-navy-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Three simple steps to transform your dreams into actionable plans
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="relative text-center">
              <div className="absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-transparent via-gold-300 to-transparent hidden md:block" style={{ transform: 'translateX(50%)' }} />
              <div className="relative z-10 w-24 h-24 bg-white rounded-full shadow-xl flex items-center justify-center mx-auto mb-6 border-4 border-gold-100">
                <MicIcon className="w-10 h-10 text-navy-900" />
              </div>
              <div className="bg-gold-500 text-navy-900 text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center mx-auto -mt-14 mb-6 relative z-20">
                1
              </div>
              <h3 className="text-xl font-bold text-navy-900 mb-3">Speak Your Dream</h3>
              <p className="text-gray-600">
                Tell your AI Coach about your vision using voice or text. Describe your ideal future in your own words.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative text-center">
              <div className="absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-transparent via-gold-300 to-transparent hidden md:block" style={{ transform: 'translateX(50%)' }} />
              <div className="relative z-10 w-24 h-24 bg-white rounded-full shadow-xl flex items-center justify-center mx-auto mb-6 border-4 border-gold-100">
                <SparklesIcon className="w-10 h-10 text-gold-500" />
              </div>
              <div className="bg-gold-500 text-navy-900 text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center mx-auto -mt-14 mb-6 relative z-20">
                2
              </div>
              <h3 className="text-xl font-bold text-navy-900 mb-3">AI Generates Your Vision Board</h3>
              <p className="text-gray-600">
                Watch as AI transforms your words into stunning, personalized imagery that captures your aspirations.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative text-center">
              <div className="relative z-10 w-24 h-24 bg-white rounded-full shadow-xl flex items-center justify-center mx-auto mb-6 border-4 border-gold-100">
                <MapIcon className="w-10 h-10 text-purple-600" />
              </div>
              <div className="bg-gold-500 text-navy-900 text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center mx-auto -mt-14 mb-6 relative z-20">
                3
              </div>
              <h3 className="text-xl font-bold text-navy-900 mb-3">AI Coach Creates Your Roadmap</h3>
              <p className="text-gray-600">
                Receive a personalized action plan with daily tasks, habits, and check-ins to make your vision reality.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== UNIQUE DIFFERENTIATORS ==================== */}
      <section className="py-24 bg-navy-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4">
              Why Visionary AI is Different
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              The complete achievement system that combines emotion, intelligence, and action
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Differentiator 1 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-colors">
              <HeartIcon className="w-10 h-10 text-gold-400 mb-4" />
              <h3 className="text-lg font-bold mb-2">Emotional Visualization</h3>
              <p className="text-gray-400 text-sm">
                See yourself in your future. Our AI creates deeply personal imagery that connects with your emotions and motivates action.
              </p>
            </div>

            {/* Differentiator 2 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-colors">
              <ChartBarIcon className="w-10 h-10 text-blue-400 mb-4" />
              <h3 className="text-lg font-bold mb-2">Financial Intelligence</h3>
              <p className="text-gray-400 text-sm">
                Connect your accounts to see real progress. Know exactly how much to save and when you'll reach your goals.
              </p>
            </div>

            {/* Differentiator 3 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-colors">
              <RocketIcon className="w-10 h-10 text-purple-400 mb-4" />
              <h3 className="text-lg font-bold mb-2">Agentic AI Execution</h3>
              <p className="text-gray-400 text-sm">
                Your AI Coach doesn't just plan—it acts. Automatic reminders, proactive research, and real accountability.
              </p>
            </div>

            {/* Differentiator 4 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-colors">
              <PrinterIcon className="w-10 h-10 text-green-400 mb-4" />
              <h3 className="text-lg font-bold mb-2">Physical Reinforcement</h3>
              <p className="text-gray-400 text-sm">
                Print your visions on canvas, posters, and workbooks. Keep your dreams visible in your physical space every day.
              </p>
            </div>

            {/* Differentiator 5 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-colors">
              <IdentityIcon className="w-10 h-10 text-pink-400 mb-4" />
              <h3 className="text-lg font-bold mb-2">AMIE Identity Engine</h3>
              <p className="text-gray-400 text-sm">
                Personalized coaching that speaks your language—whether Christian, Executive, Fitness-focused, or custom to you.
              </p>
            </div>

            {/* Differentiator 6 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-colors">
              <BrainIcon className="w-10 h-10 text-yellow-400 mb-4" />
              <h3 className="text-lg font-bold mb-2">Context-Aware Memory</h3>
              <p className="text-gray-400 text-sm">
                Upload documents, journals, and plans. Your AI Coach remembers everything and uses it to guide you better.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== PRINT ECOSYSTEM ==================== */}
      <section className="py-24 bg-gradient-to-br from-cream-50 via-white to-gold-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-navy-900 mb-6">
                Make Your Vision <span className="text-gold-600">Tangible</span>
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Science shows that seeing your goals daily increases success rates by 42%. Print your vision boards and keep them where you'll see them every day.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="w-10 h-10 bg-navy-100 rounded-lg flex items-center justify-center">
                    <PrinterIcon className="w-5 h-5 text-navy-600" />
                  </div>
                  <span className="font-medium text-navy-900">Canvas Prints</span>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="w-10 h-10 bg-gold-100 rounded-lg flex items-center justify-center">
                    <MapIcon className="w-5 h-5 text-gold-600" />
                  </div>
                  <span className="font-medium text-navy-900">Posters</span>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <NotebookIcon className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className="font-medium text-navy-900">Workbooks</span>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                    <StickerIcon className="w-5 h-5 text-pink-600" />
                  </div>
                  <span className="font-medium text-navy-900">Sticker Sheets</span>
                </div>
              </div>
            </div>

            {/* Print product mockup */}
            <div className="relative">
              <div className="bg-white rounded-3xl shadow-2xl p-6 transform rotate-2 hover:rotate-0 transition-transform duration-500">
                <div className="aspect-[4/3] bg-gradient-to-br from-gold-100 to-navy-100 rounded-2xl flex items-center justify-center">
                  <div className="text-center">
                    <PrinterIcon className="w-16 h-16 text-navy-400 mx-auto mb-4" />
                    <p className="text-navy-600 font-medium">Your Vision Board</p>
                    <p className="text-navy-400 text-sm">Printed on premium canvas</p>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 bg-gold-500 text-navy-900 font-bold text-sm px-4 py-2 rounded-full shadow-lg">
                Ships in 3-5 days
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FINANCIAL DASHBOARD ==================== */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Dashboard mockup */}
            <div className="order-2 lg:order-1">
              <div className="bg-gradient-to-br from-slate-900 to-navy-900 rounded-3xl shadow-2xl p-8 text-white">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold">Financial Dashboard</h3>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">Connected via Plaid</span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-gray-400 text-sm">Net Worth</p>
                    <p className="text-2xl font-bold text-white">$127,450</p>
                    <p className="text-green-400 text-xs">+12.3% this year</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-gray-400 text-sm">Goal Progress</p>
                    <p className="text-2xl font-bold text-gold-400">68%</p>
                    <p className="text-gray-400 text-xs">of $250,000 goal</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="bg-white/5 rounded-xl p-4 mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Monthly Target</span>
                    <span className="text-white font-medium">$2,450/mo</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-gold-400 to-gold-600 rounded-full" style={{ width: '68%' }} />
                  </div>
                </div>

                {/* Projection */}
                <div className="bg-gradient-to-r from-gold-500/20 to-transparent rounded-xl p-4">
                  <p className="text-sm text-gray-300">At this rate, you'll reach your goal in</p>
                  <p className="text-xl font-bold text-gold-400">2 years, 4 months</p>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-navy-900 mb-6">
                See Your Real <span className="text-blue-600">Financial Path</span>
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Connect your bank accounts securely with Plaid. See your true net worth, track progress automatically, and know exactly what you need to save each month.
              </p>

              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircleIcon className="w-6 h-6 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-gray-600">Real-time net worth tracking across all accounts</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircleIcon className="w-6 h-6 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-gray-600">AI-calculated monthly savings targets</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircleIcon className="w-6 h-6 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-gray-600">Projection curves showing your path to success</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircleIcon className="w-6 h-6 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-gray-600">Bank-level encryption protects your data</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== AI COACH ==================== */}
      <section className="py-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-navy-900 mb-4">
              Your AI Coach, <span className="text-purple-600">Everywhere</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Cross-channel coaching that meets you where you are
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {/* Watch */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <WatchIcon className="w-8 h-8 text-gray-700" />
              </div>
              <h3 className="font-bold text-navy-900 mb-1">Apple Watch</h3>
              <p className="text-gray-500 text-sm">Micro-coaching on your wrist</p>
            </div>

            {/* SMS */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <PhoneIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-bold text-navy-900 mb-1">SMS</h3>
              <p className="text-gray-500 text-sm">Timely reminders & nudges</p>
            </div>

            {/* Email */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MailIcon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-navy-900 mb-1">Email</h3>
              <p className="text-gray-500 text-sm">Weekly summaries & insights</p>
            </div>

            {/* Voice */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MicIcon className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-navy-900 mb-1">Voice Calls</h3>
              <p className="text-gray-500 text-sm">Check-ins when you need them</p>
            </div>

            {/* Weekly Review */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center hover:shadow-xl transition-shadow col-span-2 md:col-span-1">
              <div className="w-16 h-16 bg-gold-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ClockIcon className="w-8 h-8 text-gold-600" />
              </div>
              <h3 className="font-bold text-navy-900 mb-1">Weekly Reviews</h3>
              <p className="text-gray-500 text-sm">Reflect, adjust, and grow</p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== TRUST & TESTIMONIALS ==================== */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-8 mb-16 pb-16 border-b border-gray-100">
            <div className="flex items-center gap-3 bg-gray-50 rounded-full px-6 py-3">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
              </svg>
              <span className="font-medium text-gray-700">Powered by Google Gemini</span>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 rounded-full px-6 py-3">
              <ShieldCheckIcon className="w-6 h-6 text-green-600" />
              <span className="font-medium text-gray-700">Secure via Plaid</span>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 rounded-full px-6 py-3">
              <LockIcon className="w-6 h-6 text-blue-600" />
              <span className="font-medium text-gray-700">256-bit Encryption</span>
            </div>
          </div>

          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-navy-900 mb-4">
              Loved by Visionaries
            </h2>
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-gold-50 to-white rounded-2xl p-8 border border-gold-100">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} className="w-5 h-5 text-gold-500" />
                ))}
              </div>
              <p className="text-gray-700 mb-6 italic">
                "For the first time, I can actually see my retirement. The vision board made it feel real, and the financial tracking keeps me honest. Down 15 lbs and up $12K in savings!"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-navy-200 rounded-full flex items-center justify-center">
                  <span className="text-navy-700 font-bold">MJ</span>
                </div>
                <div>
                  <p className="font-bold text-navy-900">Marcus J.</p>
                  <p className="text-gray-500 text-sm">Business Executive</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl p-8 border border-purple-100">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} className="w-5 h-5 text-gold-500" />
                ))}
              </div>
              <p className="text-gray-700 mb-6 italic">
                "The Christian coaching theme speaks directly to my values. It's like having a faith-based accountability partner available 24/7. My family is finally on the same financial page."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center">
                  <span className="text-purple-700 font-bold">SR</span>
                </div>
                <div>
                  <p className="font-bold text-navy-900">Sarah R.</p>
                  <p className="text-gray-500 text-sm">Mother of 3</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-8 border border-blue-100">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} className="w-5 h-5 text-gold-500" />
                ))}
              </div>
              <p className="text-gray-700 mb-6 italic">
                "I've tried every goal app out there. Visionary is the first one that actually changed my behavior. The SMS check-ins and printed vision board keep me accountable daily."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                  <span className="text-blue-700 font-bold">DK</span>
                </div>
                <div>
                  <p className="font-bold text-navy-900">David K.</p>
                  <p className="text-gray-500 text-sm">Fitness Coach</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== PRICING ==================== */}
      <section className="py-24 bg-slate-50" id="pricing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-navy-900 mb-4">
              Invest in Your Future
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose the plan that matches your ambition
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Tier */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8 flex flex-col hover:shadow-xl transition-shadow">
              <h3 className="text-xl font-bold text-navy-900 mb-2">Visionary Starter</h3>
              <p className="text-gray-500 text-sm mb-6">Perfect for exploring your vision</p>
              <div className="mb-6">
                <span className="text-5xl font-serif font-bold text-navy-900">Free</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3 text-sm text-gray-600">
                  <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <span>3 AI Vision Board Generations</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-600">
                  <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Basic Goal Tracking</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-600">
                  <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <span>AMIE Identity Selection</span>
                </li>
              </ul>
              <button className="w-full py-4 rounded-xl border-2 border-navy-900 text-navy-900 font-bold hover:bg-navy-50 transition-colors">
                Get Started
              </button>
            </div>

            {/* Pro Tier */}
            <div className="bg-navy-900 rounded-3xl shadow-2xl border border-navy-800 p-8 flex flex-col relative transform scale-105 z-10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gold-500 text-navy-900 text-xs font-bold px-4 py-2 rounded-full">
                MOST POPULAR
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Visionary Pro</h3>
              <p className="text-gray-400 text-sm mb-6">For serious achievers</p>
              <div className="mb-6">
                <span className="text-5xl font-serif font-bold text-white">$19.99</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircleIcon className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
                  <span>Unlimited AI Visualizations</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircleIcon className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
                  <span>Financial Dashboard (Plaid)</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircleIcon className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
                  <span>AI Action Plan Generator</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircleIcon className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
                  <span>SMS & Email Coaching</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircleIcon className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
                  <span>Print Discounts (20% off)</span>
                </li>
              </ul>
              <button
                onClick={() => onUpgrade('PRO')}
                className="w-full py-4 rounded-xl bg-gold-500 text-navy-900 font-bold hover:bg-gold-400 transition-colors shadow-lg"
              >
                Upgrade to Pro
              </button>
            </div>

            {/* Elite Tier */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8 flex flex-col hover:shadow-xl transition-shadow">
              <h3 className="text-xl font-bold text-navy-900 mb-2">Visionary Elite</h3>
              <p className="text-gray-500 text-sm mb-6">Full autonomy for high achievers</p>
              <div className="mb-6">
                <span className="text-5xl font-serif font-bold text-navy-900">$49.99</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3 text-sm text-gray-600">
                  <StarIcon className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-600">
                  <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Voice Call Check-ins</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-600">
                  <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <span>3-Year Strategic Roadmap</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-600">
                  <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Priority Support</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-gray-600">
                  <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <span>1 Free Print Monthly</span>
                </li>
              </ul>
              <button
                onClick={() => onUpgrade('ELITE')}
                className="w-full py-4 rounded-xl border-2 border-navy-900 text-navy-900 font-bold hover:bg-navy-900 hover:text-white transition-all"
              >
                Go Elite
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FINAL CTA ==================== */}
      <section className="py-24 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-6xl font-serif font-bold mb-6">
            Your Future is Waiting.
            <br />
            <span className="text-gold-400">Start Today.</span>
          </h2>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Join thousands of visionaries who are turning their dreams into reality with AI-powered achievement.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onStartFree}
              className="group bg-gold-500 text-navy-900 text-lg font-bold px-10 py-4 rounded-full shadow-xl hover:bg-gold-400 hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-3"
            >
              <SparklesIcon className="w-6 h-6 group-hover:rotate-12 transition-transform" />
              Start Free Now
            </button>
            <button
              onClick={() => setShowVideoModal(true)}
              className="group bg-white/10 backdrop-blur-sm text-white text-lg font-semibold px-10 py-4 rounded-full border border-white/20 hover:bg-white/20 transition-all duration-300 flex items-center justify-center gap-3"
            >
              <PlayButtonIcon className="w-5 h-5" />
              Watch Demo
            </button>
          </div>

          <p className="mt-8 text-gray-400 text-sm">
            No credit card required. 3 free vision boards included.
          </p>
        </div>
      </section>

      {/* Video Modal */}
      {showVideoModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowVideoModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="aspect-video bg-navy-900 flex items-center justify-center">
              <div className="text-center text-white">
                <PlayButtonIcon className="w-20 h-20 mx-auto mb-4 opacity-50" />
                <p className="text-xl font-medium">45-Second Demo Video</p>
                <p className="text-gray-400 text-sm mt-2">Video player placeholder</p>
              </div>
            </div>
            <div className="p-6 flex justify-between items-center">
              <div>
                <p className="font-bold text-navy-900">See Visionary AI in Action</p>
                <p className="text-gray-500 text-sm">From dream to reality in 45 seconds</p>
              </div>
              <button
                onClick={() => setShowVideoModal(false)}
                className="px-6 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Missing icon component
const LockIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

export default LandingPage;
