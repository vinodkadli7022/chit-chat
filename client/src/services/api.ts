import { User, Conversation, Message } from '../types';

const API_BASE = 'http://localhost:5000/api';

export class ApiService {
  private static token: string | null = localStorage.getItem('token');

  public static setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  public static getToken(): string | null {
    return this.token || localStorage.getItem('token');
  }

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      const error: any = new Error(data.message || data.error || 'Request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  // Auth
  public static async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  public static async register(email: string, password: string, name: string): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    this.setToken(res.token);
    return res;
  }

  public static async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  public static async getDemoAccounts(): Promise<{ accounts: (User & { token: string })[] }> {
    return this.request<{ accounts: (User & { token: string })[] }>('/auth/demo-accounts');
  }

  public static async getAllUsers(): Promise<{ users: User[] }> {
    return this.request<{ users: User[] }>('/auth/users');
  }

  // Conversations
  public static async getConversations(): Promise<{ conversations: Conversation[] }> {
    return this.request<{ conversations: Conversation[] }>('/conversations');
  }

  public static async createDirectConversation(targetUserId: string): Promise<{ conversation: Conversation }> {
    return this.request<{ conversation: Conversation }>('/conversations/direct', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  }

  public static async createGroupConversation(name: string, memberIds: string[]): Promise<{ conversation: Conversation }> {
    return this.request<{ conversation: Conversation }>('/conversations/group', {
      method: 'POST',
      body: JSON.stringify({ name, memberIds }),
    });
  }

  public static async markAsRead(conversationId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/conversations/${conversationId}/read`, {
      method: 'POST',
    });
  }

  // Messages
  public static async getMessages(
    conversationId: string,
    cursor?: string,
    limit: number = 30
  ): Promise<{ messages: Message[]; nextCursor: string | null }> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);
    return this.request<{ messages: Message[]; nextCursor: string | null }>(
      `/conversations/${conversationId}/messages?${params.toString()}`
    );
  }

  // Media Upload (with server-side nudity moderation)
  public static async uploadMedia(file: File): Promise<{
    url: string;
    filename: string;
    size: number;
    moderation: { status: string; score: number; model: string; latencyMs: number };
  }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request('/media/upload', {
      method: 'POST',
      body: formData,
    });
  }
}
