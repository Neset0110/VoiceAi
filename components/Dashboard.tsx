import React, { useState } from 'react';
import { 
  Phone, 
  Clock, 
  CheckCircle, 
  MoreHorizontal, 
  Search,
  ArrowUpRight
} from 'lucide-react';
import { MOCK_CALLS } from '../constants';
import { Call } from '../types';
import StatusBadge from './StatusBadge';
import CallModal from './CallModal';

const Dashboard: React.FC = () => {
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = (call: Call) => {
    setSelectedCall(call);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCall(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Voice Agent Overview</h1>
          <p className="text-slate-500 mt-1">Real-time monitoring and performance tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
            Updates Live
          </span>
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Calls */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Total Calls Today</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">124</h3>
            <div className="flex items-center mt-2 text-emerald-600 text-sm font-medium">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              <span>+12% vs yesterday</span>
            </div>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg">
            <Phone className="w-6 h-6 text-indigo-600" />
          </div>
        </div>

        {/* Avg Duration */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Avg. Duration</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">2m 45s</h3>
            <div className="flex items-center mt-2 text-emerald-600 text-sm font-medium">
              <CheckCircle className="w-4 h-4 mr-1" />
              <span>Within target (2-4m)</span>
            </div>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg">
            <Clock className="w-6 h-6 text-indigo-600" />
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Success Rate</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">92.4%</h3>
            <div className="flex items-center mt-2 text-emerald-600 text-sm font-medium">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              <span>+2.1% this week</span>
            </div>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg">
            <CheckCircle className="w-6 h-6 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Table Header / Toolbar */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-800">Recent Calls</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by phone..." 
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-64"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Customer Phone</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_CALLS.map((call) => (
                <tr key={call.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={call.status} />
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                    {call.customerPhone}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                    {call.startTime}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap font-mono">
                    {call.duration}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button 
                      onClick={() => handleOpenModal(call)}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      <CallModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        call={selectedCall}
      />

    </div>
  );
};

export default Dashboard;