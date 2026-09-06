import { io, Socket } from 'socket.io-client';
import { ApiService } from './api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:5000'
    : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'));

class SocketService {
  private socket: Socket | null = null;
  private offlineQueue: Array<{
    payload: any;
    resolve: (val: any) => void;
    reject: (err: any) => void;
  }> = [];

  public connect(): Socket {
    const token = ApiService.getToken();

    if (this.socket) {
      if (this.socket.connected) {
        return this.socket;
      }
      this.socket.disconnect();
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('⚡ Socket connected:', this.socket?.id);
      this.flushOfflineQueue();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.warn('⚠️ Socket connection error:', error.message);
    });

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public isConnected(): boolean {
    return !!this.socket?.connected;
  }

  public getOfflineQueueCount(): number {
    return this.offlineQueue.length;
  }

  /**
   * Sends a message with optimistic tempId and auto-retry queue if disconnected
   */
  public async sendMessage(payload: {
    conversationId: string;
    content?: string;
    mediaType?: string;
    mediaUrl?: string;
    tempId: string;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        console.log('Queueing message offline:', payload.tempId);
        this.offlineQueue.push({ payload, resolve, reject });
        return;
      }

      this.socket.emit('message:send', payload, (response: any) => {
        if (!response || !response.success) {
          reject(new Error(response?.message || 'Failed to send message'));
        } else {
          resolve(response);
        }
      });
    });
  }

  private flushOfflineQueue() {
    if (this.offlineQueue.length === 0 || !this.socket?.connected) return;

    console.log(`Flushing ${this.offlineQueue.length} offline queued messages...`);
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of queue) {
      this.socket.emit('message:send', item.payload, (response: any) => {
        if (!response || !response.success) {
          item.reject(new Error(response?.message || 'Failed to send offline message'));
        } else {
          item.resolve(response);
        }
      });
    }
  }
}

export const socketService = new SocketService();
