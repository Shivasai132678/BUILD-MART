'use client';

/**
 * useRealtimeNotifications
 *
 * Connects to the backend WebSocket gateway, joins the authenticated user's room,
 * and invalidates notification queries whenever a "notification" event arrives.
 *
 * Usage: call once at the top of each role layout (buyer / vendor / admin).
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useUserStore } from '@/store/user.store';

export function useRealtimeNotifications() {
  const queryClient = useQueryClient();
  const user = useUserStore((s) => s.user);

  useEffect(() => {
    if (!user?.id) return;

    const socket = getSocket();

    function onConnect() {
      socket.emit('join', user!.id);
    }

    function onNotification(payload: {
      title?: string;
      message?: string;
      [key: string]: unknown;
    }) {
      // Refresh unread count + list
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });

      // Show a toast for live feedback
      if (payload.title) {
        toast(payload.title, {
          description: typeof payload.message === 'string' ? payload.message : undefined,
          duration: 5000,
        });
      }
    }

    function onConnectError(err: Error) {
      console.warn('[WS] connection error:', err.message);
    }

    socket.on('connect', onConnect);
    socket.on('notification', onNotification);
    socket.on('connect_error', onConnectError);

    if (!socket.connected) {
      socket.connect();
    } else {
      // Already connected from a previous render — re-join the room
      socket.emit('join', user.id);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('notification', onNotification);
      socket.off('connect_error', onConnectError);
      socket.emit('leave', user.id);
      disconnectSocket();
    };
  }, [user?.id, queryClient]);
}
