import React from 'react';

export type CallStatus = 'live' | 'completed' | 'handed-off';

export interface TranscriptMessage {
  role: 'ai' | 'user';
  text: string;
}

export interface Call {
  id: string;
  customerPhone: string;
  status: CallStatus;
  startTime: string; // e.g., "14:30"
  duration: string; // e.g., "2m 15s"
  summary: string;
  recordingUrl?: string;
  transcript: TranscriptMessage[];
}

export interface KPI {
  label: string;
  value: string;
  trend?: string; // e.g. "+5% vs yesterday"
  icon: React.ComponentType<any>;
}