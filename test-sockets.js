const { io } = require('socket.io-client');

async function testSocketFlow() {
  console.log('Testing WebSocket Bidirectional Message & Typing Flow...');

  const socketAlex = io('http://localhost:5000');
  const socketSarah = io('http://localhost:5000');

  await new Promise((resolve) => {
    let connectedCount = 0;
    socketAlex.on('connect', () => {
      console.log('Socket Alex connected:', socketAlex.id);
      socketAlex.emit('register_user', 'user_alex');
      if (++connectedCount === 2) resolve();
    });
    socketSarah.on('connect', () => {
      console.log('Socket Sarah connected:', socketSarah.id);
      socketSarah.emit('register_user', 'user_sarah');
      if (++connectedCount === 2) resolve();
    });
  });

  // Test 1: Typing event
  const typingReceivedPromise = new Promise((resolve) => {
    socketSarah.on('user_typing_start', (data) => {
      console.log('✅ Sarah received live typing indicator from Alex:', data);
      resolve();
    });
  });

  console.log('Alex starts typing to Sarah...');
  socketAlex.emit('typing_start', { sender_id: 'user_alex', receiver_id: 'user_sarah' });
  await typingReceivedPromise;

  // Test 2: Instant message
  const msgReceivedPromise = new Promise((resolve) => {
    socketSarah.on('new_message', (msg) => {
      console.log('✅ Sarah received instant message from Alex:', msg.text);
      resolve();
    });
  });

  console.log('Alex sends instant message to Sarah...');
  socketAlex.emit('send_message', {
    sender_id: 'user_alex',
    receiver_id: 'user_sarah',
    text: 'Hello Sarah! Realtime sockets are 100% working! ⚡',
    reply_to_id: null
  });

  await msgReceivedPromise;

  console.log('All socket tests passed successfully!');
  socketAlex.disconnect();
  socketSarah.disconnect();
}

testSocketFlow().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
