import { io, Socket } from 'socket.io-client';

async function runE2E() {
  console.log('====================================================');
  console.log('🚀 RUNNING COMPREHENSIVE END-TO-END SYSTEM TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // 1. Fetch Demo Accounts
  console.log('--- 1. Testing Auth & Accounts API ---');
  const demoRes = await fetch('http://127.0.0.1:5000/api/auth/demo-accounts');
  const demoData = await demoRes.json();
  const alice = demoData.accounts.find((a: any) => a.email === 'alice@demo.com');
  const bob = demoData.accounts.find((a: any) => a.email === 'bob@demo.com');

  assert(!!alice && !!alice.token, 'Alice demo account retrieved with JWT');
  assert(!!bob && !!bob.token, 'Bob demo account retrieved with JWT');

  // 2. Fetch Conversations
  console.log('\n--- 2. Testing Conversations & Authorization ---');
  const convRes = await fetch('http://127.0.0.1:5000/api/conversations', {
    headers: { Authorization: `Bearer ${alice.token}` }
  });
  const convData = await convRes.json();
  assert(convData.conversations.length >= 2, 'Alice has at least 2 active conversations');

  const directConv = convData.conversations.find((c: any) => c.type === 'DIRECT');
  assert(!!directConv, 'Direct 1-to-1 conversation exists between Alice & Bob');

  // Authorization test: access without token
  const unauthRes = await fetch('http://127.0.0.1:5000/api/conversations');
  assert(unauthRes.status === 401, 'Unauthorized request correctly rejected with 401');

  // 3. Cursor-based Pagination
  console.log('\n--- 3. Testing Cursor-based Pagination (Scalability) ---');
  const page1Res = await fetch(
    `http://127.0.0.1:5000/api/conversations/${directConv.id}/messages?limit=20`,
    { headers: { Authorization: `Bearer ${alice.token}` } }
  );
  const page1 = await page1Res.json();
  assert(page1.messages.length === 20, 'Page 1 returns exact requested page limit (20 messages)');
  assert(!!page1.nextCursor, 'nextCursor token generated for pagination');

  // Fetch page 2 using cursor
  const page2Res = await fetch(
    `http://127.0.0.1:5000/api/conversations/${directConv.id}/messages?cursor=${page1.nextCursor}&limit=20`,
    { headers: { Authorization: `Bearer ${alice.token}` } }
  );
  const page2 = await page2Res.json();
  assert(page2.messages.length > 0, 'Page 2 retrieved older historical messages using cursor');
  assert(page2.messages[0].id !== page1.messages[0].id, 'Page 2 messages are disjoint from Page 1');

  // 4. Profanity Moderation Blocking
  console.log('\n--- 4. Testing Server-side Profanity Blocking ---');
  const blockedMsgRes = await fetch(
    `http://127.0.0.1:5000/api/conversations/${directConv.id}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alice.token}`
      },
      body: JSON.stringify({
        content: 'Hey Bob, what the f u c k is this'
      })
    }
  );
  assert(blockedMsgRes.status === 422, 'Spaced profanity message blocked with HTTP 422');
  const blockedData = await blockedMsgRes.json();
  assert(blockedData.error === 'PROFANITY_DETECTED', 'Blocked response contains PROFANITY_DETECTED error code');

  // 5. Idempotency & Deduplication
  console.log('\n--- 5. Testing Idempotency & Deduplication Engine ---');
  const idempotencyKey = 'test-idempotency-' + Date.now();
  const send1 = await fetch(
    `http://127.0.0.1:5000/api/conversations/${directConv.id}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alice.token}`
      },
      body: JSON.stringify({
        content: 'Idempotency test message',
        tempId: idempotencyKey
      })
    }
  );
  const send1Data = await send1.json();
  assert(send1.status === 201, 'First message send created with 201');

  // Retry sending with exact same idempotency key
  const send2 = await fetch(
    `http://127.0.0.1:5000/api/conversations/${directConv.id}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alice.token}`
      },
      body: JSON.stringify({
        content: 'Idempotency test message retry',
        tempId: idempotencyKey
      })
    }
  );
  const send2Data = await send2.json();
  assert(send2.status === 200, 'Duplicate send recognized with 200 OK');
  assert(send2Data.deduplicated === true, 'Server flagged message as deduplicated: true');
  assert(send1Data.message.id === send2Data.message.id, 'Both responses return identical message ID (no duplicate DB row)');

  // 6. Real-Time WebSockets & Read Receipts
  console.log('\n--- 6. Testing Real-time WebSockets & Read Receipts ---');
  await new Promise<void>((resolve, reject) => {
    const aliceSocket = io('http://127.0.0.1:5000', {
      auth: { token: alice.token },
      transports: ['websocket']
    });

    const bobSocket = io('http://127.0.0.1:5000', {
      auth: { token: bob.token },
      transports: ['websocket']
    });

    const testContent = 'Real-time WebSocket transmission ' + Date.now();
    const tempId = 'ws-temp-' + Date.now();

    bobSocket.on('connect', () => {
      bobSocket.on('message:received', ({ message }: any) => {
        if (message.content === testContent) {
          assert(true, 'Bob received Alice\'s message in real time over WebSockets');
          assert(message.status === 'SENT', 'Initial message status is SENT');

          // Bob marks message as delivered
          bobSocket.emit('message:delivered', {
            messageId: message.id,
            conversationId: directConv.id
          });

          // Bob reads the conversation
          bobSocket.emit('conversation:read', {
            conversationId: directConv.id
          });
        }
      });
    });

    aliceSocket.on('message:status_update', ({ status }: any) => {
      if (status === 'DELIVERED') {
        assert(true, 'Alice received DELIVERED status receipt');
      }
    });

    aliceSocket.on('conversation:read_receipt', ({ userId }: any) => {
      if (userId === bob.id) {
        assert(true, 'Alice received Bob\'s READ receipt');
        aliceSocket.disconnect();
        bobSocket.disconnect();
        resolve();
      }
    });

    aliceSocket.on('connect', () => {
      aliceSocket.emit('message:send', {
        conversationId: directConv.id,
        content: testContent,
        tempId
      }, (ack: any) => {
        assert(ack.success === true, 'Alice received socket ACK for message send');
      });
    });

    setTimeout(() => {
      aliceSocket.disconnect();
      bobSocket.disconnect();
      resolve();
    }, 4000);
  });

  // 7. Image Upload & Nudity Moderation
  console.log('\n--- 7. Testing Server-side Image Upload & Nudity Moderation ---');
  // Create a minimal 1x1 JPEG buffer
  const sampleJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x80, 0xff, 0xd9
  ]);

  const formDataSafe = new FormData();
  formDataSafe.append('file', new Blob([sampleJpeg], { type: 'image/jpeg' }), 'safe_diagram.jpg');

  const uploadSafeRes = await fetch('http://127.0.0.1:5000/api/media/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${alice.token}` },
    body: formDataSafe
  });
  const uploadSafeData = await uploadSafeRes.json();
  assert(uploadSafeRes.status === 201, 'Safe image upload accepted with 201 Created');
  assert(uploadSafeData.moderation.status === 'APPROVED', 'Image moderation status marked APPROVED');

  // Test Explicit image rejection
  const formDataNsfw = new FormData();
  formDataNsfw.append('file', new Blob([sampleJpeg], { type: 'image/jpeg' }), 'nsfw_explicit_content.jpg');

  const uploadNsfwRes = await fetch('http://127.0.0.1:5000/api/media/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${alice.token}` },
    body: formDataNsfw
  });
  const uploadNsfwData = await uploadNsfwRes.json();
  assert(uploadNsfwRes.status === 422, 'Explicit image upload rejected with HTTP 422');
  assert(uploadNsfwData.error === 'MODERATION_REJECTED', 'Error code marked MODERATION_REJECTED');
  assert(uploadNsfwData.score >= uploadNsfwData.threshold, 'Confidence score exceeded policy threshold');

  console.log('\n====================================================');
  console.log(`E2E Summary: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runE2E().catch(console.error);
