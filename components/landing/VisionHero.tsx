import React from 'react';
import { SparklesIcon, VisionaryLogo, VisionaryIcon } from '../Icons';
import { useLandingHeroVideos, VideoSource } from '../../hooks/useLandingHeroVideos';

interface VisionHeroProps {
  onGetStarted: () => void;
  onWatchDemo?: () => void;
}

/**
 * HeroPlaceholder - Original vision board grid placeholder
 * Displayed when video is unavailable or loading
 */
const HeroPlaceholder: React.FC = () => (
  <div className="bg-charcoal-800 rounded-3xl shadow-2xl border border-gold-500/20 p-4 transform hover:scale-[1.02] transition-transform duration-500">
    <div className="aspect-[4/3] bg-gradient-to-br from-charcoal-900 via-navy-900 to-charcoal-800 rounded-2xl overflow-hidden relative">
      {/* Vision Board Grid Preview */}
      <div className="absolute inset-0 grid grid-cols-3 gap-2 p-4">
        <div className="bg-gradient-to-br from-gold-500/20 to-gold-600/20 rounded-xl border border-gold-500/10"></div>
        <div className="col-span-2 bg-gradient-to-br from-charcoal-700/50 to-charcoal-800/50 rounded-xl flex items-center justify-center border border-gold-500/10">
          <div className="text-center px-4">
            <span className="text-gold-400 font-serif text-2xl font-bold block">My Ascension</span>
            <span className="text-gray-400 text-sm">2025 Vision</span>
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-xl border border-emerald-500/10"></div>
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl border border-purple-500/10"></div>
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl border border-blue-500/10"></div>
      </div>

      {/* AI Generating Badge */}
      <div className="absolute bottom-4 left-4 bg-charcoal-900/95 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 shadow-lg border border-gold-500/20">
        <div className="w-2 h-2 bg-status-success rounded-full animate-pulse"></div>
        <span className="text-sm font-medium text-gold-400">AI Generating...</span>
      </div>
    </div>
  </div>
);

/**
 * HeroVideo - Autoplay hero video component
 * Supports multiple video formats via <source> tags
 * Includes mute/unmute toggle for user control
 */
const HeroVideo: React.FC<{ sources: VideoSource[] }> = ({ sources }) => {
  const [failed, setFailed] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(true);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  if (!sources?.length || failed) return null;

  return (
    <div className="bg-charcoal-800 rounded-3xl shadow-2xl border border-gold-500/20 p-3 overflow-hidden transform hover:scale-[1.02] transition-transform duration-500">
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          controls={false}
          onError={() => setFailed(true)}
        >
          {sources.map((s, i) => (
            <source key={i} src={s.url} type={s.type} />
          ))}
        </video>

        {/* Brand overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-tr from-navy-950/60 via-transparent to-charcoal-900/30 pointer-events-none" />

        {/* Mute/Unmute Button */}
        <button
          onClick={toggleMute}
          className="absolute top-4 right-4 p-2.5 bg-charcoal-900/80 backdrop-blur-sm rounded-full text-white hover:bg-charcoal-900 transition-colors border border-white/10 shadow-lg"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>

        {/* Badge */}
        <div className="absolute bottom-4 left-4 bg-charcoal-900/85 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 shadow-lg border border-gold-500/20">
          <div className="w-2 h-2 bg-status-success rounded-full animate-pulse" />
          <span className="text-sm font-medium text-gold-400">Visionary in action</span>
        </div>
      </div>
    </div>
  );
};

export const VisionHero: React.FC<VisionHeroProps> = ({ onGetStarted, onWatchDemo }) => {
  const { getSources, loading } = useLandingHeroVideos();
  const videoSources = getSources('default');

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-charcoal-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>

      {/* Decorative Gradient Blurs */}
      <div className="absolute top-20 -left-40 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 -right-40 w-96 h-96 bg-gold-600/10 rounded-full blur-3xl"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-center lg:text-left">
            <div className="animate-fade-up inline-flex items-center gap-2 bg-gold-500/10 border border-gold-500/30 rounded-full px-4 py-2 mb-6">
              <VisionaryIcon size={18} color="#C5A572" />
              <span className="text-sm font-medium text-gold-400">AI-Powered Vision Boarding</span>
            </div>

            <h1 className="animate-fade-up delay-100 text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-white leading-tight mb-6">
              Your Ascension
              <span className="block text-gold-500">Starts Here</span>
            </h1>

            <p className="animate-fade-up delay-200 text-xl text-gray-300 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Transform your dreams into stunning visual boards, build actionable roadmaps, and manifest your future with AI-powered coaching and premium print products.
            </p>

            <div className="animate-fade-up delay-300 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button
                onClick={onGetStarted}
                className="group bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 text-navy-900 text-lg font-semibold px-8 py-4 rounded-full shadow-xl hover:shadow-gold-500/25 hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center justify-center gap-3"
              >
                <SparklesIcon className="w-5 h-5 text-navy-900 group-hover:scale-110 transition-transform" />
                Begin My Ascension
              </button>

              {onWatchDemo && (
                <button
                  onClick={onWatchDemo}
                  className="group text-gold-400 text-lg font-semibold px-8 py-4 rounded-full border-2 border-gold-500/30 hover:border-gold-500 hover:bg-gold-500/10 transition-all duration-300 flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Watch Demo
                </button>
              )}
            </div>

            {/* Click Triggers - Reduce Anxiety */}
            <div className="animate-fade-up delay-400 mt-6 flex flex-wrap items-center gap-4 justify-center lg:justify-start text-sm text-gray-400">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-status-success" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Free to start</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-status-success" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>No credit card</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-status-success" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Ready in 2 min</span>
              </div>
            </div>

            {/* Social Proof Strip */}
            <div className="animate-fade-up delay-500 mt-8 flex items-center gap-4 justify-center lg:justify-start">
              <div className="flex -space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-navy-900 flex items-center justify-center text-white text-xs font-bold">JM</div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-navy-900 flex items-center justify-center text-white text-xs font-bold">SK</div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 border-2 border-navy-900 flex items-center justify-center text-white text-xs font-bold">AL</div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 border-2 border-navy-900 flex items-center justify-center text-navy-900 text-xs font-bold">RW</div>
                <div className="w-10 h-10 rounded-full bg-gold-500 border-2 border-navy-900 flex items-center justify-center text-navy-900 text-xs font-bold">+</div>
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-white">10,000+ Visionaries</div>
                <div className="flex items-center gap-1">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-gold-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">4.9/5 rating</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Hero Visual */}
          <div className="relative animate-slide-right delay-200">
            <div className="relative">
              {/* Main Vision Board Preview / Hero Video */}
              {!loading && videoSources?.length ? (
                <HeroVideo sources={videoSources} />
              ) : (
                <HeroPlaceholder />
              )}

              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 bg-gradient-to-r from-gold-400 to-gold-600 text-navy-900 px-4 py-2 rounded-full shadow-lg font-bold text-sm animate-bounce">
                Powered by AI
              </div>

              <div className="absolute -bottom-6 -left-6 bg-charcoal-800 rounded-2xl shadow-xl p-4 border border-gold-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-gold-400 to-gold-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-navy-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-white">Ascension Plan Ready</span>
                    <span className="text-xs text-gray-400">12 steps generated</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VisionHero;
