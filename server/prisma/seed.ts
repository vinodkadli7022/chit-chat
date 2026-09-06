import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding messaging database...');

  // Clear existing records
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Demo Users
  const alice = await prisma.user.create({
    data: {
      name: 'Alice Smith',
      email: 'alice@demo.com',
      passwordHash,
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      isOnline: true
    }
  });

  const bob = await prisma.user.create({
    data: {
      name: 'Bob Jones',
      email: 'bob@demo.com',
      passwordHash,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      isOnline: true
    }
  });

  const charlie = await prisma.user.create({
    data: {
      name: 'Charlie Brown',
      email: 'charlie@demo.com',
      passwordHash,
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      isOnline: false,
      lastSeenAt: new Date(Date.now() - 3600000)
    }
  });

  const dana = await prisma.user.create({
    data: {
      name: 'Dana Scully',
      email: 'dana@demo.com',
      passwordHash,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isOnline: false,
      lastSeenAt: new Date(Date.now() - 86400000)
    }
  });

  console.log('Created 4 demo accounts (Alice, Bob, Charlie, Dana).');

  // 2. Create 1-to-1 Conversation between Alice & Bob
  const aliceBobConv = await prisma.conversation.create({
    data: {
      type: 'DIRECT',
      participants: {
        create: [
          { userId: alice.id, role: 'MEMBER' },
          { userId: bob.id, role: 'MEMBER' }
        ]
      }
    }
  });

  // Seed 45 messages to demonstrate cursor-based pagination
  const sampleMessages = [
    { sender: alice, text: 'Hey Bob! How is the real-time messaging assignment coming along?' },
    { sender: bob, text: 'Hey Alice! Working on the architecture right now. Testing WebSockets!' },
    { sender: alice, text: 'Awesome! Did you implement cursor-based pagination for message history?' },
    { sender: bob, text: 'Yes! Indexed by conversationId and createdAt descending for sub-millisecond lookups.' },
    { sender: alice, text: 'How about the moderation pipeline? Both images and profanity?' },
    { sender: bob, text: 'Both are fully server-side! The profanity filter handles leetspeak and delimiters.' },
    { sender: alice, text: 'And image moderation?' },
    { sender: bob, text: 'Server-side explicit content detection before images ever get saved or sent.' },
    { sender: alice, text: 'That is great. What about GIFs and stickers?' },
    { sender: bob, text: 'Added a responsive GIF picker and custom sticker packs too! 🚀' },
    { sender: alice, text: 'Let me test sending some reactions!' },
    { sender: bob, text: 'Sure thing, check this out:' },
    { sender: bob, text: 'Everything updates in real-time with delivery and read receipts.', mediaType: 'STICKER', mediaUrl: 'https://cdn-icons-png.flaticon.com/512/742/742751.png' },
    { sender: alice, text: 'Whoa that sticker loaded smoothly! ✨' }
  ];

  // Generate 35 older historical messages to test scrolling up
  const baseTime = Date.now() - (50 * 60 * 1000);
  for (let i = 0; i < 35; i++) {
    const isAlice = i % 2 === 0;
    await prisma.message.create({
      data: {
        conversationId: aliceBobConv.id,
        senderId: isAlice ? alice.id : bob.id,
        content: `Archive message #${i + 1}: Testing high volume message history cursor pagination.`,
        status: 'READ',
        createdAt: new Date(baseTime + (i * 60 * 1000))
      }
    });
  }

  // Insert recent sample messages
  for (let i = 0; i < sampleMessages.length; i++) {
    const msg = sampleMessages[i];
    await prisma.message.create({
      data: {
        conversationId: aliceBobConv.id,
        senderId: msg.sender.id,
        content: msg.text,
        mediaType: msg.mediaType || 'TEXT',
        mediaUrl: msg.mediaUrl || null,
        status: i < sampleMessages.length - 2 ? 'READ' : 'DELIVERED',
        createdAt: new Date(Date.now() - ((sampleMessages.length - i) * 15000))
      }
    });
  }

  // 3. Create Group Conversation: Engineering Team
  const groupConv = await prisma.conversation.create({
    data: {
      type: 'GROUP',
      name: 'Engineering Team',
      avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
      participants: {
        create: [
          { userId: alice.id, role: 'ADMIN' },
          { userId: bob.id, role: 'MEMBER' },
          { userId: charlie.id, role: 'MEMBER' },
          { userId: dana.id, role: 'MEMBER' }
        ]
      }
    }
  });

  await prisma.message.create({
    data: {
      conversationId: groupConv.id,
      senderId: alice.id,
      content: 'Welcome to the Engineering team chat! Please review the latest PR.',
      status: 'DELIVERED',
      createdAt: new Date(Date.now() - 300000)
    }
  });

  await prisma.message.create({
    data: {
      conversationId: groupConv.id,
      senderId: charlie.id,
      content: 'Taking a look now. The moderation pipeline looks solid.',
      status: 'SENT',
      createdAt: new Date(Date.now() - 120000)
    }
  });

  console.log('Database seeded successfully with users, conversations, and paginated message history.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
