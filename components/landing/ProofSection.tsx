import React from 'react';

interface TestimonialProps {
  quote: string;
  author: string;
  role: string;
  avatar?: string;
}

const Testimonial: React.FC<TestimonialProps> = ({ quote, author, role, avatar }) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
    <div className="flex gap-1 mb-4">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className="w-5 h-5 text-gold-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
    <p className="text-gray-700 mb-4 italic">"{quote}"</p>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gradient-to-br from-navy-900 to-navy-700 rounded-full flex items-center justify-center text-white font-bold">
        {avatar || author.charAt(0)}
      </div>
      <div>
        <span className="block text-sm font-bold text-navy-900">{author}</span>
        <span className="text-xs text-gray-500">{role}</span>
      </div>
    </div>
  </div>
);

interface ProofSectionProps {
  onGetStarted: () => void;
}

export const ProofSection: React.FC<ProofSectionProps> = ({ onGetStarted }) => {
  const testimonials: TestimonialProps[] = [
    {
      quote: "Visionary helped me turn my vague retirement dreams into a concrete 5-year plan. The AI coach keeps me accountable every week!",
      author: "Marcus T.",
      role: "Entrepreneur, 52"
    },
    {
      quote: "I've tried vision boards before but they just sat on my wall. This is different - it actually breaks down my goals into daily actions.",
      author: "Sarah K.",
      role: "Marketing Director, 38"
    },
    {
      quote: "The spiritual growth theme speaks to my soul. It's like having a coach who understands faith and finances together.",
      author: "James O.",
      role: "Pastor & Author, 45"
    }
  ];

  const stats = [
    { value: "10,000+", label: "Visionaries" },
    { value: "50,000+", label: "Visions Created" },
    { value: "94%", label: "Goal Progress Rate" },
    { value: "4.9", label: "App Store Rating" }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats Row */}
        <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 rounded-3xl p-8 md:p-12 mb-20">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-2">
              Join the Movement
            </h2>
            <p className="text-gray-400">
              Thousands of visionaries are already designing their future
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-serif font-bold text-gold-500 mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-navy-900 mb-4">
            Stories of Transformation
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See how Visionary is helping people turn their dreams into reality
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {testimonials.map((testimonial, index) => (
            <Testimonial key={index} {...testimonial} />
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 bg-gold-500 text-navy-900 font-bold px-8 py-4 rounded-full hover:bg-gold-400 transition-all shadow-lg hover:shadow-xl"
          >
            Join 10,000+ Visionaries
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
};

export default ProofSection;
