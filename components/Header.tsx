
import React from 'react';
import { Upload, History, LogOut, User as UserIcon, Bell } from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  onNewAnalysis?: () => void;
  onToggleHistory: () => void;
  onToggleNotifications?: () => void;
  user: UserProfile | null;
  onLogout: () => void;
}

const ADMIN_EMAIL = 'electrorescuehelp@gmail.com';

const ElectroRescueLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    {/* PCB Board Outline */}
    <rect x="3" y="3" width="18" height="18" rx="4" />
    
    {/* Circuit Traces */}
    <circle cx="8" cy="8" r="2" />
    <circle cx="16" cy="8" r="2" />
    <path d="M8 10V12L12 14" />
    <path d="M16 10V12L12 14" />
    <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
    
    {/* Lightning Bolt Overlay (Bottom Left) */}
    <path d="M3 14H8C9.1 14 10 14.9 10 16V21H7C4.8 21 3 19.2 3 17V14Z" fill="currentColor" stroke="none" />
    <path d="M5.5 19L6.5 16.5H5L7 14.5L6 17H7.5L5.5 19Z" fill="#020617" stroke="none" />
  </svg>
);

const Header: React.FC<HeaderProps> = ({ onNewAnalysis, onToggleHistory, onToggleNotifications, user, onLogout }) => {
  // Note: We rely on the parent (App.tsx) to pass onToggleNotifications ONLY if the user is an admin.
  // We do not re-check admin status here via 'user' prop because 'user' might be null in some layouts (like sidebar mode).

  return (
    <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={onNewAnalysis}>
          <div className="bg-slate-800 p-2 rounded-lg shadow-lg border border-slate-700 group-hover:border-emerald-500/50 transition-colors">
            <ElectroRescueLogo className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1">
              ElectroRescue<span className="text-emerald-400">AI</span>
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Don't Throw - Re-Grow</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden md:flex items-center gap-2 mr-2 px-3 py-1 bg-slate-800/50 rounded-full border border-slate-700/50">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <UserIcon className="w-3 h-3 text-blue-400" />
              </div>
              <span className="text-xs text-slate-300 font-medium">
                  {user.name} <span className="text-slate-500 mx-1">|</span> {user.role}
              </span>
            </div>
          )}

          <button
            onClick={onToggleHistory}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
            title="Scan History"
          >
            <History className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">History</span>
          </button>

          {/* Admin Notifications Button - Only shows if callback is provided */}
          {onToggleNotifications && (
             <button
              onClick={onToggleNotifications}
              className="p-2 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 relative"
              title="Help Requests"
            >
              <Bell className="w-5 h-5" />
              {/* Optional: We could add a red dot here if we tracked unread count via props */}
            </button>
          )}
          
          <div className="h-6 w-px bg-slate-700 mx-1"></div>
          
          <button 
            onClick={onNewAnalysis}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">New Analysis</span>
          </button>

          {user && (
             <button
                onClick={onLogout}
                className="ml-2 p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Sign Out"
             >
                <LogOut className="w-5 h-5" />
             </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
