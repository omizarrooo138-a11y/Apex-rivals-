import React from 'react';
import {CheckCircle2, WifiOff} from 'lucide-react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';

export const OfflineBadge: React.FC = () => {
  const {isOnline, swReady} = useOnlineStatus();

  if (!isOnline) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-[#1c160d]/95 px-3 py-1.5 text-xs font-medium text-amber-200 whitespace-nowrap shrink-0">
        <WifiOff className="w-3.5 h-3.5 text-amber-400" />
        <span>Offline Mode — Playing Locally</span>
      </div>
    );
  }

  if (swReady) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-[#0d1915]/90 px-3 py-1.5 text-xs font-medium text-emerald-200 whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>Cached for Offline Play</span>
      </div>
    );
  }

  return null;
};
