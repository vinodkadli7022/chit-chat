import { Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    const participants = await prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatar: true,
                    isOnline: true,
                    lastSeenAt: true
                  }
                }
              }
            },
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              include: {
                sender: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        }
      },
      orderBy: { conversation: { updatedAt: 'desc' } }
    });

    const conversations = participants.map(p => {
      const conv = p.conversation;
      const otherParticipants = conv.participants
        .filter(part => part.userId !== userId)
        .map(part => part.user);

      const lastMessage = conv.messages[0] || null;

      let title = conv.name;
      let avatar = conv.avatar;

      if (conv.type === 'DIRECT') {
        const partner = otherParticipants[0];
        title = partner ? partner.name : 'Direct Chat';
        avatar = partner ? partner.avatar : null;
      }

      return {
        id: conv.id,
        type: conv.type,
        name: title,
        avatar,
        participants: conv.participants.map(part => part.user),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              mediaType: lastMessage.mediaType,
              mediaUrl: lastMessage.mediaUrl,
              senderId: lastMessage.senderId,
              senderName: lastMessage.sender.name,
              status: lastMessage.status,
              createdAt: lastMessage.createdAt
            }
          : null,
        unreadCount: p.unreadCount,
        updatedAt: conv.updatedAt
      };
    });

    res.json({ conversations });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch conversations', details: error.message });
  }
}

export async function createOrGetDirectConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!.id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      res.status(400).json({ error: 'Target user ID is required.' });
      return;
    }

    if (targetUserId === currentUserId) {
      res.status(400).json({ error: 'Cannot start conversation with yourself.' });
      return;
    }

    // Check if 1-on-1 conversation already exists between these two users
    const existing = await prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { participants: { some: { userId: currentUserId } } },
          { participants: { some: { userId: targetUserId } } }
        ]
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true, isOnline: true, lastSeenAt: true }
            }
          }
        }
      }
    });

    if (existing) {
      const partner = existing.participants.find(p => p.userId !== currentUserId)?.user;
      res.json({
        conversation: {
          id: existing.id,
          type: existing.type,
          name: partner?.name || 'Direct Chat',
          avatar: partner?.avatar || null,
          participants: existing.participants.map(p => p.user),
          unreadCount: 0,
          updatedAt: existing.updatedAt
        }
      });
      return;
    }

    // Create new conversation
    const newConv = await prisma.conversation.create({
      data: {
        type: 'DIRECT',
        participants: {
          create: [
            { userId: currentUserId, role: 'MEMBER' },
            { userId: targetUserId, role: 'MEMBER' }
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true, isOnline: true, lastSeenAt: true }
            }
          }
        }
      }
    });

    const partner = newConv.participants.find(p => p.userId !== currentUserId)?.user;

    res.status(201).json({
      conversation: {
        id: newConv.id,
        type: newConv.type,
        name: partner?.name || 'Direct Chat',
        avatar: partner?.avatar || null,
        participants: newConv.participants.map(p => p.user),
        unreadCount: 0,
        updatedAt: newConv.updatedAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create conversation', details: error.message });
  }
}

export async function createGroupConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!.id;
    const { name, memberIds } = req.body;

    if (!name || !memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      res.status(400).json({ error: 'Group name and at least one member are required.' });
      return;
    }

    const uniqueMemberIds = Array.from(new Set([currentUserId, ...memberIds]));

    const group = await prisma.conversation.create({
      data: {
        type: 'GROUP',
        name,
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`,
        participants: {
          create: uniqueMemberIds.map(id => ({
            userId: id,
            role: id === currentUserId ? 'ADMIN' : 'MEMBER'
          }))
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true, isOnline: true, lastSeenAt: true }
            }
          }
        }
      }
    });

    res.status(201).json({
      conversation: {
        id: group.id,
        type: group.type,
        name: group.name,
        avatar: group.avatar,
        participants: group.participants.map(p => p.user),
        unreadCount: 0,
        updatedAt: group.updatedAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create group', details: error.message });
  }
}

export async function markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;

    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId
        }
      }
    });

    if (!participant) {
      res.status(403).json({ error: 'Not a member of this conversation.' });
      return;
    }

    // Find the latest message id
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

    // Mark messages sent by others as READ
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

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to mark as read', details: error.message });
  }
}
