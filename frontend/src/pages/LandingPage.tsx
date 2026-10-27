import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Music, Zap, Shield, Youtube, Disc, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onLoginClick: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick }) => {
  return (
    <div className="min-h-screen bg-[#06080e] text-white selection:bg-cyan-500/30 relative overflow-hidden">
      <Helmet>
        <title>Disperser Studio | Professional Roblox Audio Uploader & Management</title>
        <meta name="description" content="The ultimate solution for Roblox creators. Upload, manage, and edit audio assets with professional tools, bulk import, and real-time moderation tracking." />
        <meta name="keywords" content="Roblox, Audio Uploader, Disperser Studio, Roblox Open Cloud, Audio Management, Bulk Upload, YouTube to Roblox" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Disperser Studio | Professional Roblox Audio Management" />
        <meta property="og:description" content="Automate your Roblox audio workflow. Bulk imports, YouTube extraction, and real-time moderation logs." />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:title" content="Disperser Studio | Roblox Audio Uploader" />
        <meta property="twitter:description" content="Professional audio management for Roblox creators. Upload and edit with ease." />
      </Helmet>

      {/* Dynamic Background Glows - Ambient Mesh */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/15 blur-[160px] rounded-full" />
        <div className="absolute top-[20%] right-[-10%] w-[45%] h-[45%] bg-indigo-500/12 blur-[170px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[20%] w-[45%] h-[45%] bg-blue-600/12 blur-[160px] rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-50" />
      </div>

      {/* Navigation - Floating Glass Header */}
      <header className="sticky top-4 z-50 px-4 max-w-7xl mx-auto">
        <nav className="glass-dock rounded-2xl px-6 py-3.5 flex items-center justify-between border border-white/[0.08] shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 border border-cyan-400/30">
              <Music size={20} className="text-white drop-shadow-md" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              Disperser <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Studio</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a 
              href="#features" 
              className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 transition-colors hidden sm:inline-block"
            >
              Features
            </a>
            <a 
              href="#pricing" 
              className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 transition-colors hidden sm:inline-block"
            >
              Pricing
            </a>
            <button
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white flex items-center gap-2 text-xs font-bold transition-all shadow-lg shadow-cyan-500/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              onClick={onLoginClick}
            >
              <Disc size={16} />
              Login with Discord
            </button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-36 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-bold uppercase tracking-wider mb-8 shadow-sm">
            <Zap size={14} className="text-cyan-400" />
            <span>Fast, Seamless & Roblox-Optimized</span>
          </div>
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tighter mb-8 leading-[0.95] text-white">
            Simplify <br />
            <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-300 bg-clip-text text-transparent">Uploading Audio</span> <br />
            With One All Package.
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 mb-12 max-w-2xl mx-auto font-normal leading-relaxed">
            Import from YouTube, fine-tune waveform in-browser, and bulk-upload assets to Roblox Open Cloud effortlessly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-10 h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-xl shadow-cyan-500/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              onClick={onLoginClick}
            >
              Get Started Free
              <ArrowRight size={18} />
            </button>
            <a
              href="#features"
              className="w-full sm:w-auto glass-panel-elevated hover:bg-white/[0.08] border border-white/[0.1] h-14 px-8 rounded-2xl text-slate-300 hover:text-white font-bold text-base flex items-center justify-center transition-all cursor-pointer"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="px-6 py-28 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-3">
              Capabilities
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3">Everything you need to ship assets</h2>
            <p className="text-slate-400 max-w-lg mx-auto text-sm sm:text-base leading-relaxed">Built for Roblox developers who value workflow speed and audio perfection.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Youtube className="text-red-400" size={24} />,
                bg: "bg-red-500/10 border-red-500/20",
                title: "Convert from YouTube",
                desc: "Import audio streams directly via YouTube URL. Zero shady popup converters, pure 320kbps audio clarity."
              },
              {
                icon: <Zap className="text-cyan-400" size={24} />,
                bg: "bg-cyan-500/10 border-cyan-500/20",
                title: "In-Browser Waveform Studio",
                desc: "Trim, pitch shift, speed up, and normalize loudness in real-time with visual interactive waveforms."
              },
              {
                icon: <Shield className="text-indigo-400" size={24} />,
                bg: "bg-indigo-500/10 border-indigo-500/20",
                title: "Smart Queue & Moderation",
                desc: "Real-time Roblox moderation checks and instant status tracking. Never guess if an asset passed or was rejected."
              }
            ].map((f, i) => (
              <div 
                key={i} 
                className="glass-card-interactive glass-panel rounded-3xl p-8 sm:p-10 border border-white/[0.08] hover:border-cyan-500/40 transition-all backdrop-blur-2xl shadow-xl flex flex-col justify-between group"
              >
                <div>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border ${f.bg} shadow-md group-hover:scale-110 transition-transform`}>
                    {f.icon}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 tracking-tight">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-6 py-28 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-3">
              Pricing
            </div>
            <h2 className="text-3xl sm:text-5xl font-black mb-3 tracking-tight text-white">Simple, Transparent Pricing</h2>
            <p className="text-slate-400 text-sm sm:text-base">Choose the plan that fits your studio's creative volume.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* Free Plan */}
            <div className="glass-panel rounded-3xl p-8 sm:p-10 border border-white/[0.08] backdrop-blur-2xl relative flex flex-col justify-between shadow-xl">
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-300 mb-1">Free Plan</h3>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-white">Rp 0</span>
                    <span className="text-slate-400 font-medium text-sm">/ forever</span>
                  </div>
                </div>

                <div className="space-y-3.5 mb-8">
                  {[
                    "Realtime Update Status Asset",
                    "Single Import (YouTube & Local)",
                    "Optimized Audio Enhanced",
                    "Audio Editor Tool",
                    "Single Upload to Open Cloud",
                    "Daily Limit: 3 Uploads"
                  ].map((benefit, i) => (
                    <div key={i} className="flex items-center gap-3 text-slate-300 text-sm">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                        <Zap size={11} className="text-cyan-400" />
                      </div>
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={onLoginClick}
                className="w-full py-3.5 rounded-xl glass-panel-elevated hover:bg-white/[0.08] text-white font-bold text-sm transition-all border border-white/[0.1] active:scale-95 cursor-pointer"
              >
                Get Started Free
              </button>
            </div>

            {/* Pro Plan */}
            <div className="glass-panel bg-gradient-to-b from-cyan-950/20 to-slate-900/60 rounded-3xl p-8 sm:p-10 border-2 border-cyan-500/30 backdrop-blur-2xl relative flex flex-col justify-between shadow-2xl shadow-cyan-950/40">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-lg shadow-cyan-500/30">
                Most Popular
              </div>

              <div>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-cyan-300">Pro Plan</h3>
                    <div className="bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded text-[10px] font-bold text-cyan-300 uppercase">Best Value</div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white">Rp 249.000</span>
                    <span className="text-slate-400 font-medium text-sm">/ month</span>
                    <span className="text-slate-500 line-through text-xs ml-auto">Rp 499.000</span>
                  </div>
                  <p className="text-cyan-400 text-xs font-semibold mt-1">Limited launch offer: Save 50%</p>
                </div>

                <div className="space-y-3 mb-8">
                  {[
                    "Realtime update status asset",
                    "Optimized Audio Enhanced",
                    "Single Import (YouTube & Local files)",
                    "Bulk Imports (YouTube & Local files)",
                    "Interactive Waveform Studio",
                    "Bulk Multi-track Audio Editor",
                    "Bulk Automated Uploads",
                    "Unlimited Audio Uploads",
                    "High-priority download queue",
                    "DataStore Backup Server & Inspect"
                  ].map((benefit, i) => (
                    <div key={i} className="flex items-center gap-3 text-white text-sm font-medium">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                        <Zap size={11} className="text-cyan-300" />
                      </div>
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={onLoginClick}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-28 relative z-10">
        <div className="max-w-5xl mx-auto rounded-3xl glass-panel bg-slate-950/70 border border-white/[0.1] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl backdrop-blur-2xl">
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
          <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-white">Ready to speed up your workflow?</h2>
          <p className="text-slate-400 text-base md:text-lg mb-10 max-w-xl mx-auto font-normal leading-relaxed">
            Join hundreds of Roblox developers using Disperser Studio to automate and streamline their asset pipeline.
          </p>
          <button
            className="bg-white hover:bg-slate-100 text-slate-950 px-10 h-14 rounded-2xl font-black text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/10 cursor-pointer"
            onClick={onLoginClick}
          >
            Start Creating Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-14 border-t border-white/[0.06] text-center relative z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Music size={16} className="text-cyan-400" />
          </div>
          <span className="text-base font-black tracking-tight text-slate-300">Disperser Studio</span>
        </div>
        <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest">© 2026 DISPERSER STUDIO. INDEPENDENT ROBLOX PLATFORM.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
