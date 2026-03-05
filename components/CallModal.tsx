import React from 'react';
import { X, Play, Pause, Bot, User } from 'lucide-react';
import { Call } from '../types';
import StatusBadge from './StatusBadge';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  call: Call | null;
}

const CallModal: React.FC<CallModalProps> = ({ isOpen, onClose, call }) => {
  if (!isOpen || !call) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-lg font-semibold text-slate-800">
                {call.customerPhone}
              </h3>
              <StatusBadge status={call.status} />
            </div>
            <p className="text-sm text-slate-500">
              {call.startTime} • Duration: {call.duration}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-6 transcript-scroll">
          
          {/* Audio Player Placeholder */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <button className="w-10 h-10 flex items-center justify-center bg-indigo-600 rounded-full text-white hover:bg-indigo-700 shadow-md transition-colors">
                <Play className="w-5 h-5 ml-1" />
              </button>
              <div className="flex-1">
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-indigo-500 rounded-full"></div>
                </div>
                <div className="flex justify-between mt-1.5 text-xs text-slate-500 font-medium">
                  <span>0:45</span>
                  <span>{call.duration}</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Summary */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2">AI Summary</h4>
            <p className="text-sm text-slate-700 leading-relaxed">
              {call.summary}
            </p>
          </div>

          {/* Transcript */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Transcript</h4>
            <div className="space-y-4">
              {call.transcript.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`flex max-w-[80%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar Icon */}
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                      msg.role === 'ai' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-100 text-indigo-600'
                    }`}>
                      {msg.role === 'ai' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    
                    {/* Bubble */}
                    <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.role === 'ai' 
                        ? 'bg-white border border-slate-200 text-slate-700 rounded-tl-none' 
                        : 'bg-indigo-600 text-white rounded-tr-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallModal;