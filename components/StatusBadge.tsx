import React from 'react';
import { CallStatus } from '../types';
import { Radio, CheckCircle2, PhoneForwarded } from 'lucide-react';

interface StatusBadgeProps {
  status: CallStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'live':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
          <span className="relative flex h-2 w-2 mr-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Live
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <CheckCircle2 className="w-3 h-3 mr-1.5" />
          Completed
        </span>
      );
    case 'handed-off':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <PhoneForwarded className="w-3 h-3 mr-1.5" />
          Handed Off
        </span>
      );
    default:
      return null;
  }
};

export default StatusBadge;