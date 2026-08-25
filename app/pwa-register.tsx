'use client';

import { useEffect, useState } from 'react';

type OfflineState = 'preparing' | 'ready' | 'offline' | 'unsupported';

export default function PwaRegister() {
  const [state, setState] = useState<OfflineState>('preparing');

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setState('unsupported');
      return;
    }

    let active = true;
    const updateConnectionState = () => {
      if (!active) return;
      setState(navigator.onLine ? 'ready' : 'offline');
    };

    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then(() => navigator.serviceWorker.ready)
      .then(updateConnectionState)
      .catch(() => {
        if (active) setState('unsupported');
      });

    window.addEventListener('online', updateConnectionState);
    window.addEventListener('offline', updateConnectionState);
    return () => {
      active = false;
      window.removeEventListener('online', updateConnectionState);
      window.removeEventListener('offline', updateConnectionState);
    };
  }, []);

  if (state === 'unsupported') return null;

  return (
    <div className={`offline-status ${state}`} role="status" aria-live="polite">
      <span aria-hidden="true">{state === 'preparing' ? '◌' : '✓'}</span>
      {state === 'preparing' ? '正在準備離線版' : state === 'offline' ? '目前離線，可正常使用' : '離線版已準備完成'}
    </div>
  );
}

