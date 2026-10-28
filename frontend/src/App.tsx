import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import UploadImage from './pages/UploadImage';
import Overview from './pages/Overview';
import Settings from './pages/Settings';
import LandingPage from './pages/LandingPage';
import AudioStudio from './pages/AudioStudio';
import AudioLibrary from './pages/AudioLibrary';
import BackupServer from './pages/BackupServer';
import SharingAsset from './pages/SharingAsset';
import { PollProvider } from './context/PollContext';
import { BulkUploadProvider, useBulkUpload } from './context/BulkUploadContext';
import DiscordCallback from './pages/DiscordCallback';
import { 
  LayoutDashboard, 
  Music, 
  Image as ImageIcon, 
  Settings as SettingsIcon, 
  LogOut, 
  ArrowLeft, 
  ChevronRight, 
  Sparkles, 
  ListMusic, 
  Loader2, 
  MessageSquare,
  Menu,
  X as CloseIcon,
  Database,
  Share2
} from 'lucide-react';

// --- Components ---

const Sidebar = ({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) => {
  const loc = useLocation();
  const { bulkQueue, isBulkProcessing } = useBulkUpload();
  const logout = () => {
    localStorage.removeItem('disperser_key');
    localStorage.removeItem('disperser_user_id');
    localStorage.removeItem('disperser_user');
    window.location.href = '/';
  };

  const menuItems = [
    { name: 'Overview', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { name: 'Audio Studio', path: '/dashboard/studio', icon: <Sparkles size={18} /> },
    { name: 'Audio Library', path: '/dashboard/library', icon: <ListMusic size={18} /> },
    { name: 'Sharing Asset', path: '/dashboard/sharing', icon: <Share2 size={18} /> },
    { name: 'Backup Server', path: '/dashboard/backup', icon: <Database size={18} /> },
    { name: 'Upload Image', path: '/dashboard/image', icon: <ImageIcon size={18} /> },
    { name: 'Settings', path: '/dashboard/settings', icon: <SettingsIcon size={18} /> },
  ];

  const user = JSON.parse(localStorage.getItem('disperser_user') || '{}');

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      {/* Brand Header */}
      <div className="logo flex items-center justify-between gap-3 px-1 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 opacity-60 blur-md group-hover:opacity-100 transition-opacity" />
            <div className="relative bg-slate-900 border border-white/10 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Music size={20} className="text-cyan-400" />
            </div>
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
              Disperser <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent font-bold">Studio</span>
            </span>
            <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest -mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              v2.5 Cloud
            </div>
          </div>
        </div>
        <button 
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl bg-white/5 border border-white/10"
          onClick={() => setOpen(false)}
        >
          <CloseIcon size={18} />
        </button>
      </div>

      {/* User Profile Card */}
      <div className="mb-5">
        <div className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] backdrop-blur-xl transition-all shadow-lg flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/15 flex items-center justify-center overflow-hidden">
              {user.avatar ? (
                <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <MessageSquare size={18} className="text-indigo-400" />
              )}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 shadow-sm shadow-emerald-500/50" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate leading-tight">{user.username || 'Creator'}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                {user.current_role || 'Pro Plan'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {menuItems.map((item) => {
          const isActive = loc.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className={`nav-link group relative flex items-center justify-between ${isActive ? 'active' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className={`p-1.5 rounded-lg transition-colors ${
                  isActive 
                    ? 'text-cyan-300 bg-cyan-400/15' 
                    : 'text-slate-400 group-hover:text-cyan-400 group-hover:bg-white/5'
                }`}>
                  {item.icon}
                </span>
                <span className="font-semibold text-sm tracking-tight">{item.name}</span>
              </div>
              {isActive && (
                <ChevronRight size={14} className="text-cyan-300 animate-in fade-in" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Bulk status & Logout */}
      <div className="pt-4 mt-auto border-t border-white/[0.08] space-y-3">
        {bulkQueue.length > 0 && (
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-cyan-500/20 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} />
                Bulk Queue
              </span>
              {isBulkProcessing && (
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {isBulkProcessing ? (
                <Loader2 size={13} className="text-cyan-400 animate-spin" />
              ) : (
                <Sparkles size={13} className="text-slate-400" />
              )}
              <span className="text-xs text-slate-300 font-medium">
                {bulkQueue.filter(i => i.status === 'success').length} / {bulkQueue.length} Ready
              </span>
            </div>
            <Link 
              to="/dashboard/studio" 
              onClick={() => setOpen(false)} 
              className="text-[10px] text-cyan-400 hover:text-cyan-300 mt-2 block font-extrabold uppercase tracking-wider transition-colors"
            >
              Buka Studio →
            </Link>
          </div>
        )}

        <button
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 text-xs font-bold transition-all cursor-pointer"
          onClick={logout}
        >
          <LogOut size={16} />
          <span>Keluar Akun</span>
        </button>
      </div>
    </aside>
  );
};

const Login = () => {
  const handleDiscordLogin = () => {
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
    const redirectUri = encodeURIComponent(window.location.origin + '/discord-callback');
    const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds.join`;
    window.location.href = url;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#06080c] text-white p-6 relative overflow-hidden">
      {/* Ambient Radial Mesh */}
      <div className="absolute -top-[20%] left-[20%] w-[500px] h-[500px] rounded-full bg-cyan-500/15 blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-[20%] right-[20%] w-[500px] h-[500px] rounded-full bg-indigo-500/15 blur-[160px] pointer-events-none" />
      
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="w-full max-w-md p-8 md:p-10 rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/80 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider mb-8 transition-colors">
          <ArrowLeft size={14} /> Kembali ke Beranda
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="relative group">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 opacity-70 blur-md" />
            <div className="relative bg-slate-950 border border-white/20 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg">
              <Music size={24} className="text-cyan-400" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">Disperser <span className="text-cyan-400">Studio</span></h1>
            <p className="text-xs text-slate-400">Roblox Audio & DataStore Migration Hub</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-white">Selamat Datang</h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              Masuk dengan akun Discord Anda untuk sinkronisasi otomatis role, akses studio, dan kuota upload.
            </p>
          </div>
          
          <button 
            className="w-full py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-2xl font-bold shadow-xl shadow-indigo-600/25 transition-all active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer" 
            onClick={handleDiscordLogin}
          >
            <MessageSquare size={20} />
            <span>Login dengan Discord</span>
          </button>

          <div className="pt-4 border-t border-white/[0.08] text-center">
            <p className="text-[11px] text-slate-500">
              Dengan masuk, Anda menyetujui Ketentuan Layanan Disperser Studio.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Home = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (localStorage.getItem('disperser_user')) {
      navigate('/dashboard');
    }
  }, [navigate]);

  return <LandingPage onLoginClick={() => window.location.href = '/login'} />;
};

const DashboardLayout = ({ userExists }: { userExists: boolean }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  if (!userExists) return <Navigate to="/login" />;

  return (
    <PollProvider>
      <BulkUploadProvider>
        <div className="layout relative min-h-screen bg-[#06080c] text-slate-100 overflow-hidden">
          {/* Ambient Lighting Orbs for Deep Glassmorphism across all Dashboard pages */}
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute -top-[15%] left-[10%] w-[600px] h-[600px] rounded-full bg-cyan-500/[0.07] blur-[160px]" />
            <div className="absolute top-[35%] right-[5%] w-[500px] h-[500px] rounded-full bg-indigo-500/[0.06] blur-[170px]" />
            <div className="absolute -bottom-[10%] left-[25%] w-[650px] h-[650px] rounded-full bg-blue-600/[0.07] blur-[180px]" />
            <div 
              className="absolute inset-0 opacity-[0.025]" 
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '36px 36px' }} 
            />
          </div>

          {/* Mobile Top Navigation */}
          <div className="mobile-nav">
            <div className="flex items-center gap-2.5">
              <div className="bg-gradient-to-br from-cyan-500 to-blue-600 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Music size={16} className="text-white" />
              </div>
              <span className="text-base font-black tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Disperser Studio
              </span>
            </div>
            <button 
              className="p-2 text-slate-400 hover:text-white transition-colors rounded-xl bg-white/5 border border-white/10"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Mobile Backdrop Overlay */}
          <div 
            className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />

          <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
          
          <main className="content relative z-10">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/studio" element={<AudioStudio />} />
              <Route path="/library" element={<AudioLibrary />} />
              <Route path="/sharing" element={<SharingAsset />} />
              <Route path="/backup" element={<BackupServer />} />
              <Route path="/image" element={<UploadImage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </BulkUploadProvider>
    </PollProvider>
  );
};

import { HelmetProvider } from 'react-helmet-async';

// --- Main App ---

export default function App() {
  const [user] = useState(localStorage.getItem('disperser_user'));

  return (
    <HelmetProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/discord-callback" element={<DiscordCallback />} />
          <Route path="/dashboard/*" element={<DashboardLayout userExists={!!user} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </HelmetProvider>
  );
}
