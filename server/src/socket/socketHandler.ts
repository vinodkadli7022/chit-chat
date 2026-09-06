import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../db';
import { checkProfanity } from '../moderation/profanity';

interface SocketUser {
  id: string;
  email: string;
  name: string;
}

// Map of userId -> Set of active socket IDs (handles multi-tab presence)
const activeUserSockets = new Map<string, Set<string>>();

export function setupSocketIO(io: Server): void {
  // Authentication middleware for Socket.IO
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new Error('AUTHENTICATION_REQUIRED'));
      }

      const payload = jwt.verify(token, config.jwtSecret) as SocketUser;
      socket.data.user = payload;
      next();
    } catch (err) {
      next(new Error('INVALID_AUTHENTICATION_TOKEN'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    const userId = user.id;

    // Register active socket for user
    if (!activeUserSockets.has(userId)) {
      activeUserSockets.set(userId, new Set());
    }
    const userSockets = activeUserSockets.get(userId)!;
    const wasOffline = userSockets.size === 0;
    userSockets.add(socket.id);

    // Join personal room for multi-tab updates
    socket.join(`user:${userId}`);

    // If this is the user's first active tab, broadcast online presence
    if (wasOffline) {
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: true }
      }).catch(() => {});

      io.emit('presence:update', {
        userId,
        isOnline: true,
        lastSeenAt: new Date().toISOString()
      });
    }

    // Automatically join all conversations the user is a participant of
    const userConversations = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true }
    });

    userConversations.forEach(c => {
      socket.join(`conversation:${c.conversationId}`);
    });

    // Notify client that all conversation rooms are synchronized
    socket.emit('ready', {
      userId,
      rooms: userConversations.map(c => c.conversationId)
    });

    // -------------------------------------------------------------
    // Join a specific conversation room (e.g. newly created)
    // -------------------------------------------------------------
    socket.on('conversation:join', async ({ conversationId }: { conversationId: string }) => {
      const participant = await prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId
          }
        }
      });

      if (participant) {
        socket.join(`conversation:${conversationId}`);
      }
    });

    // -------------------------------------------------------------
    // Typing Indicators (with automatic timeout)
    // -------------------------------------------------------------
    socket.on('typing:start', ({ conversationId }: { conversationId: string }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        userId,
        userName: user.name,
        isTyping: true
      });
    });

    socket.on('typing:stop', ({ conversationId }: { conversationId: string }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        userId,
        userName: user.name,
        isTyping: false
      });
    });

    // -------------------------------------------------------------
    // Real-Time Message Sending with Deduplication & Moderation
    // -------------------------------------------------------------
    socket.on(
      'message:send',
      async (
        payload: {
          conversationId: string;
          content?: string;
          mediaType?: string;
          mediaUrl?: string;
          tempId?: string;
        },
        ack?: (response: any) => void
      ) => {
        try {
          const { conversationId, content, mediaType = 'TEXT', mediaUrl, tempId } = payload;

          // 1. Authorization check
          const participant = await prisma.conversationParticipant.findUnique({
            where: {
              conversationId_userId: {
                conversationId,
                userId
              }
            }
          });

          if (!participant) {
            ack?.({ success: false, error: 'FORBIDDEN', message: 'Not authorized for this conversation.' });
            return;
          }

          // 2. Server-side Profanity Moderation
          if (content) {
            const profanity = checkProfanity(content);
            if (!profanity.isClean) {
              ack?.({
                success: false,
                error: 'PROFANITY_DETECTED',
                message: profanity.reason,
                flaggedWords: profanity.flaggedWords
              });
              return;
            }
          }

          // 3. Idempotency check: if tempId exists, avoid duplicate insertion
          if (tempId) {
            const existing = await prisma.message.findUnique({
              where: {
                conversationId_tempId: {
                  conversationId,
                  tempId
                }
              },
              include: {
                sender: {
                  select: { id: true, name: true, avatar: true }
                }
              }
            });

            if (existing) {
              ack?.({ success: true, message: existing, deduplicated: true });
              return;
            }
          }

          // 4. Persist message to database
          const message = await prisma.message.create({
            data: {
              tempId: tempId || null,
              conversationId,
              senderId: userId,
              content: content || null,
              mediaType,
              mediaUrl: mediaUrl || null,
              status: 'SENT'
            },
            include: {
              sender: {
                select: { id: true, name: true, avatar: true }
              }
            }
          });

          // 5. Update conversation timestamp
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() }
          });

          // 6. Increment unread count for other members
          await prisma.conversationParticipant.updateMany({
            where: {
              conversationId,
              userId: { not: userId }
            },
            data: {
              unreadCount: { increment: 1 }
            }
          });

          // 7. Broadcast message to all active participants in the conversation room
          io.to(`conversation:${conversationId}`).emit('message:received', {
            message,
            conversationId
          });

          // 8. Positive acknowledgment to sender with temporary and permanent ID
          ack?.({
            success: true,
            message,
            tempId
          });
        } catch (err: any) {
          ack?.({ success: false, error: 'SERVER_ERROR', message: err.message });
        }
      }
    );

    // -------------------------------------------------------------
    // Delivery State Confirmation
    // -------------------------------------------------------------
    socket.on('message:delivered', async ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
      try {
        const msg = await prisma.message.findUnique({ where: { id: messageId } });
        if (msg && msg.status === 'SENT') {
          const updated = await prisma.message.update({
            where: { id: messageId },
            data: { status: 'DELIVERED' }
          });

          io.to(`conversation:${conversationId}`).emit('message:status_update', {
            messageId,
            conversationId,
            status: 'DELIVERED'
          });
        }
      } catch (e) {}
    });

    // -------------------------------------------------------------
    // Read Receipts & Unread Count Reset
    // -------------------------------------------------------------
    socket.on('conversation:read', async ({ conversationId }: { conversationId: string }) => {
      try {
        const latestMessage = await prisma.message.findFirst({
          where: { conversationId },
          orderBy: { createdAt: 'desc' },
          select: { id: true }
        });

        await prisma.conversationParticipant.update({
          where: {
            conversationId_userId: {
              conversationId,
              userId
            }
          },
          data: {
            unreadCount: 0,
            lastReadMessageId: latestMessage?.id || null
          }
        });

        // Mark messages sent by others in this conversation as READ
        await prisma.message.updateMany({
          where: {
            conversationId,
            senderId: { not: userId },
            status: { in: ['SENT', 'DELIVERED'] }
          },
          data: {
            status: 'READ'
          }
        });

        // Broadcast read receipt to the conversation room and multi-tab user room
        io.to(`conversation:${conversationId}`).emit('conversation:read_receipt', {
          conversationId,
          userId,
          lastReadMessageId: latestMessage?.id || null
        });

        io.to(`user:${userId}`).emit('conversation:unread_reset', {
          conversationId
        });
      } catch (e) {}
    });

    // -------------------------------------------------------------
    // Disconnect & Multi-Tab Presence Cleanup
    // -------------------------------------------------------------
    socket.on('disconnect', async () => {
      const userSockets = activeUserSockets.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);

        if (userSockets.size === 0) {
          activeUserSockets.delete(userId);

          const now = new Date();
          await prisma.user.update({
            where: { id: userId },
            data: {
              isOnline: false,
              lastSeenAt: now
            }
          }).catch(() => {});

          io.emit('presence:update', {
            userId,
            isOnline: false,
            lastSeenAt: now.toISOString()
          });
        }
      }
    });
  });
}
