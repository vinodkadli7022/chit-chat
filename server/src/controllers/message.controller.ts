import { Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest, checkConversationAccess } from '../middleware/auth';
import { checkProfanity } from '../moderation/profanity';

export async function getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;
    const { cursor, limit = '30' } = req.query;

    const hasAccess = await checkConversationAccess(conversationId, userId);
    if (!hasAccess) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this conversation.' });
      return;
    }

    const pageSize = Math.min(Math.max(parseInt(limit as string, 10) || 30, 1), 100);

    let messages;
    if (cursor) {
      // Fetch older messages using cursor-based pagination
      messages = await prisma.message.findMany({
        take: pageSize,
        skip: 1, // Skip the cursor itself
        cursor: {
          id: cursor as string
        },
        where: { conversationId },
        orderBy: { createdAt: 'desc' }, // Most recent first for indexing efficiency
        include: {
          sender: {
            select: { id: true, name: true, avatar: true }
          }
        }
      });
    } else {
      // First page (most recent messages)
      messages = await prisma.message.findMany({
        take: pageSize,
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: { id: true, name: true, avatar: true }
          }
        }
      });
    }

    const nextCursor = messages.length === pageSize ? messages[messages.length - 1].id : null;

    // Return in chronological order (oldest to newest) for straightforward client rendering
    res.json({
      messages: messages.reverse(),
      nextCursor
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
  }
}

export async function sendMessageRest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;
    const { content, mediaType = 'TEXT', mediaUrl, tempId } = req.body;

    const hasAccess = await checkConversationAccess(conversationId, userId);
    if (!hasAccess) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this conversation.' });
      return;
    }

    // Moderation check on text content
    if (content) {
      const profanityCheck = checkProfanity(content);
      if (!profanityCheck.isClean) {
        res.status(422).json({
          error: 'PROFANITY_DETECTED',
          message: profanityCheck.reason,
          flaggedWords: profanityCheck.flaggedWords
        });
        return;
      }
    }

    // Idempotency check: if tempId already exists for this conversation, return existing message
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
        res.status(200).json({ message: existing, deduplicated: true });
        return;
      }
    }

    // Create the message
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

    // Update conversation's updatedAt timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    // Increment unread count for other participants
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId: { not: userId }
      },
      data: {
        unreadCount: { increment: 1 }
      }
    });

    res.status(201).json({ message });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
}
