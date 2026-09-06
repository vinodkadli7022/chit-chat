export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  isOnline: boolean;
  lastSeenAt: string;
}

export type MessageStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export type MediaType = 'TEXT' | 'IMAGE' | 'GIF' | 'STICKER';

export interface Message {
  id: string;
  tempId?: string | null;
  conversationId: string;
  senderId: string;
  content: string | null;
  mediaType: MediaType;
  mediaUrl: string | null;
  status: MessageStatus;
  createdAt: string;
  updatedAt?: string;
  sender?: {
    id: string;
    name: string;
    avatar: string | null;
  };
  errorReason?: string;
}

export interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name: string;
  avatar: string | null;
  participants: User[];
  lastMessage: {
    id: string;
    content: string | null;
    mediaType: MediaType;
    mediaUrl: string | null;
    senderId: string;
    senderName: string;
    status: MessageStatus;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ModerationAlert {
  title: string;
  message: string;
  details?: string;
  score?: number;
}
