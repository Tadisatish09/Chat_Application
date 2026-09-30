# WhatsApp Real-time Chat Application 💬⚡

A high-performance real-time chat application inspired by WhatsApp Web, powered by **WebSockets (Socket.IO)**, **Node.js Express**, **React (Vite)**, and a database named **`chat`** (with automatic MySQL and SQLite engine support).

---

## ✨ Key Features

1. **⚡ Real-time Bidirectional Messaging**:
   - Instant messaging over WebSockets with zero lag.
   - Message delivery states: Sent (`✓`), Delivered (`✓✓`), and Read Receipts (`✓✓` in blue).
   - Dynamic message timestamps and date separators.

2. **💬 Quote / Message Replies**:
   - Click **Reply** on any message to trigger the reply preview bar.
   - Quoted replies show the author, excerpt, and color-coded accent.
   - Clicking a quote box automatically scrolls to and highlights the original message.

3. **➡️ Instant Message Forwarding**:
   - Forward any message or media to one or multiple registered users simultaneously.
   - Displays a `↪ Forwarded` badge on forwarded messages.

4. **⌨️ Live Typing Indicators**:
   - Real-time animated typing indicator in both the chat header and the active conversation list.

5. **❤️ Emoji Reactions & Media Attachments**:
   - Hover over messages to react with quick emojis (`❤️`, `👍`, `😂`, `😮`, `😢`, `🙏`).
   - Share photos, documents, and voice notes.
   - Fullscreen media inspector with zoom and download.

6. **📁 Database (`chat`) Support**:
   - Pre-configured for database name **`chat`**.
   - Supports **MySQL** (auto-creates `chat` database when credentials are set in `.env`) and **SQLite** (`chat.db`) as zero-configuration fallback.
   - Full user registry, profiles, conversation history, and message states.

---

## 🚀 Getting Started

### 1. Start Both Backend & Frontend
Run the following command in the project root:
```bash
npm run dev
```

This starts:
- **Backend API & WebSocket Server**: [http://localhost:5000](http://localhost:5000)
- **Frontend WhatsApp Web UI**: [http://localhost:5173](http://localhost:5173)

---

## 👥 Testing Bidirectional Real-time Chat (Two Users)

To experience the real-time features (typing indicators, quote replies, and instant forwards):

1. Open **Browser Window 1**: Navigate to [http://localhost:5173](http://localhost:5173) and click **"Alex Turner"** (or create a new user).
2. Open **Browser Window 2** (Incognito or another browser): Navigate to [http://localhost:5173](http://localhost:5173) and click **"Sarah Connor"**.
3. Select each other's contact to start chatting.
4. Watch live **typing dots**, send **quote replies**, and test **multi-contact forwards**!

---

## ⚙️ Configuration & Database (`.env`)

You can customize database settings in [`.env`](file:///d:/Communication/.env):

```env
PORT=5000
DB_NAME=chat
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
USE_MYSQL=true
JWT_SECRET=super_secret_whatsapp_jwt_key_2026
```

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Lucide React, Web Audio API sound synthesis.
- **Backend**: Node.js, Express, Socket.IO, Multer, JWT, Bcrypt.
- **Database**: Database named `chat` with MySQL2 & SQLite3 drivers.
