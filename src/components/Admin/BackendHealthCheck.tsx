import { useState, useEffect } from 'react';
import { supabaseUrl, publicAnonKey } from '../../utils/supabase/info';

export function BackendHealthCheck() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setStatus('checking');
    setError(null);

    const healthUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/make-server-b0f1e6d5/health`;
    
    try {
      console.log('BackendHealthCheck: Testing connection to:', healthUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(healthUrl, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('BackendHealthCheck: Server is online!', data);
      
      setStatus('online');
      setDetails(data);
    } catch (err: any) {
      console.error('BackendHealthCheck: Server is offline or unreachable:', err);
      
      setStatus('offline');
      
      if (err.name === 'AbortError') {
        setError('Connection timeout - server is not responding');
      } else if (err.message?.includes('Failed to fetch')) {
        setError('Cannot connect to server - Edge Function may not be deployed yet');
      } else {
        setError(err.message);
      }
    }
  };

  useEffect(() => {
    checkHealth();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-red-500';
      case 'checking':
        return 'bg-yellow-500 animate-pulse';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'online':
        return 'Backend Online';
      case 'offline':
        return 'Backend Offline';
      case 'checking':
        return 'Checking...';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg p-4 min-w-[300px] shadow-lg">
        {/* Status indicator */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
          <div>
            <div className="text-sm">{getStatusText()}</div>
            {status === 'online' && details?.service && (
              <div className="text-xs opacity-60">{details.service}</div>
            )}
          </div>
        </div>

        {/* Details */}
        {status === 'online' && details && (
          <div className="text-xs space-y-1 opacity-60 border-t border-white/10 pt-2 mt-2">
            <div>Version: {details.version}</div>
            <div>Time: {new Date(details.timestamp).toLocaleTimeString()}</div>
          </div>
        )}

        {/* Error message */}
        {status === 'offline' && error && (
          <div className="text-xs text-red-400 mt-2 border-t border-white/10 pt-2">
            <div className="mb-1">Error:</div>
            <div className="opacity-80">{error}</div>
          </div>
        )}

        {/* Connection info */}
        <div className="text-xs opacity-40 mt-2 border-t border-white/10 pt-2">
          <div className="truncate">
            Endpoint: {supabaseUrl}
          </div>
        </div>

        {/* Manual refresh button */}
        <button
          onClick={checkHealth}
          disabled={status === 'checking'}
          className="w-full mt-3 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
        >
          {status === 'checking' ? 'Checking...' : 'Refresh Status'}
        </button>

        {/* Deployment hint */}
        {status === 'offline' && (
          <div className="mt-3 text-xs opacity-60 border-t border-yellow-500/20 pt-2">
            <div className="text-yellow-400 mb-1">💡 Deployment Required</div>
            <div>
              The Supabase Edge Function needs to be deployed. In Figma Make, this should happen automatically.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
