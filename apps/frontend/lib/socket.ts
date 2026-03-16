/**
 * Singleton socket.io-client instance for real-time notifications.
 * Connects to the backend WebSocket gateway at /events namespace.
 */
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    socket = io(`${backendUrl}/events`, {
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}
