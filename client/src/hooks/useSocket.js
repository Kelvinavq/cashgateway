import { useEffect } from 'react';
import socket from '../lib/socket';

export function useSocket(events = {}) {
  useEffect(() => {
    if (!socket.connected) socket.connect();
    Object.entries(events).forEach(([event, handler]) => socket.on(event, handler));
    return () => {
      Object.entries(events).forEach(([event, handler]) => socket.off(event, handler));
    };
  }, []);
}
