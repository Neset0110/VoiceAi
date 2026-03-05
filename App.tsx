import React from 'react';
import { Mic2, LayoutDashboard, Settings, Users, LogOut } from 'lucide-react';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Mic2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">VoiceAuto<span className="text-indigo-600">.ai</span></span>
          </div>

          {/* Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md transition-colors">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-md transition-colors">
              <Users className="w-4 h-4" />
              Agents
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-md transition-colors">
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </nav>

          {/* User Profile */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-900">Admin User</p>
                <p className="text-xs text-slate-500">Business Owner</p>
              </div>
              <div className="w-9 h-9 bg-slate-200 rounded-full border border-slate-300 overflow-hidden">
                <img 
                  src="https://picsum.photos/100/100" 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <button className="text-slate-400 hover:text-slate-600">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Dashboard />
      </main>

    </div>
  );
}

export default App;