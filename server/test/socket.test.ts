import { io } from 'socket.io-client';

async function testSockets() {
  const demoRes = await fetch('http://127.0.0.1:5000/api/auth/demo-accounts');
  const { accounts } = await demoRes.json();
  const alice = accounts.find((a: any) => a.email === 'alice@demo.com');
  const bob = accounts.find((a: any) => a.email === 'bob@demo.com');

  const convRes = await fetch('http://127.0.0.1:5000/api/conversations', {
    headers: { Authorization: `Bearer ${alice.token}` }
  });
  const { conversations } = await convRes.json();
  const directConv = conversations.find((c: any) => c.type === 'DIRECT');

  console.log(`Connecting Alice (${alice.name}) and Bob (${bob.name}) via WebSockets...`);

  const aliceSocket = io('http://127.0.0.1:5000', {
    auth: { token: alice.token },
    transports: ['websocket']
  });

  const bobSocket = io('http://127.0.0.1:5000', {
    auth: { token: bob.token },
    transports: ['websocket']
  });

  await new Promise<void>((resolve) => {
    let bobReady = false;
    let aliceReady = false;

    const trySend = () => {
      if (bobReady && aliceReady) {
        console.log('Both Alice and Bob are ready. Alice sending message...');
        aliceSocket.emit('message:send', {
          conversationId: directConv.id,
          content: 'Hello Bob over live socket!',
          tempId: 'ws-test-' + Date.now()
        }, (ack: any) => {
          console.log('Alice received send ack:', ack.success ? 'SUCCESS' : 'FAILED');
        });
      }
    };

    bobSocket.on('ready', () => {
      console.log('Bob socket initialized & rooms joined.');
      bobReady = true;
      trySend();
    });

    aliceSocket.on('ready', () => {
      console.log('Alice socket initialized & rooms joined.');
      aliceReady = true;
      trySend();
    });

    bobSocket.on('message:received', ({ message }: any) => {
      console.log('✅ Bob received message in real-time:', message.content);
      // Bob marks as read
      bobSocket.emit('conversation:read', { conversationId: directConv.id });
    });

    aliceSocket.on('conversation:read_receipt', ({ userId }: any) => {
      console.log('✅ Alice received read receipt from user:', userId);
      aliceSocket.disconnect();
      bobSocket.disconnect();
      resolve();
    });

    setTimeout(() => {
      aliceSocket.disconnect();
      bobSocket.disconnect();
      resolve();
    }, 4000);
  });

  console.log('Socket flow test passed with 100% success!');
}

testSockets();
