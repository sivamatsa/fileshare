import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// Active signaling rooms: roomCode -> Set of WebSocket clients
interface PeerMeta {
  ws: WebSocket;
  id: string;
  joinedAt: number;
}
const rooms = new Map<string, Map<WebSocket, PeerMeta>>();

// Local Network Auto-Discovery Groups: networkKey -> Map of active devices
interface NetworkPeer {
  ws: WebSocket;
  peerId: string;
  device: any;
  code: string;
}
const networkGroups = new Map<string, Map<WebSocket, NetworkPeer>>();

function broadcastNetworkDevices(networkKey: string) {
  const group = networkGroups.get(networkKey);
  if (!group) return;

  for (const [targetWs] of group) {
    if (targetWs.readyState !== WebSocket.OPEN) continue;
    const others = Array.from(group.entries())
      .filter(([s]) => s !== targetWs && s.readyState === WebSocket.OPEN)
      .map(([, data]) => ({
        peerId: data.peerId,
        code: data.code,
        device: data.device,
        isSelf: false,
      }));

    targetWs.send(JSON.stringify({
      type: 'nearby-devices',
      networkGroup: networkKey,
      devices: others,
    }));
  }
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: rooms.size,
    timestamp: Date.now(),
  });
});

app.get('/api/room/:code', (req, res) => {
  const code = req.params.code?.toUpperCase().trim();
  const room = rooms.get(code);
  const count = room ? room.size : 0;
  res.json({
    room: code,
    peers: count,
    available: count < 2,
  });
});

// WebSocket Signaling Server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req: any) => {
  const forwarded = req.headers ? req.headers['x-forwarded-for'] : undefined;
  const rawIp = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket?.remoteAddress) || 'local';
  const networkKey = rawIp.replace(/^.*:/, '').trim() || 'local';

  let currentRoom: string | null = null;
  let peerId: string = Math.random().toString(36).substring(2, 9);
  let isAlive = true;

  (ws as any).isAlive = true;
  ws.on('pong', () => {
    (ws as any).isAlive = true;
  });

  ws.on('message', (raw: string | Buffer) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'heartbeat' || msg.type === 'ping') {
      (ws as any).isAlive = true;
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      return;
    }

    // Broadcast device presence to other devices on the same local network / IP
    if (msg.type === 'presence') {
      if (msg.peerId) peerId = msg.peerId;
      if (!networkGroups.has(networkKey)) {
        networkGroups.set(networkKey, new Map());
      }
      networkGroups.get(networkKey)!.set(ws, {
        ws,
        peerId,
        device: msg.device,
        code: msg.code || '',
      });
      broadcastNetworkDevices(networkKey);
      return;
    }

    // Direct 1-click connect invite between devices on the same network
    if (msg.type === 'direct-connect-invite') {
      const group = networkGroups.get(networkKey);
      if (group) {
        for (const [targetWs, meta] of group) {
          if (meta.peerId === msg.targetPeerId && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({
              type: 'incoming-connect-request',
              fromPeerId: peerId,
              fromDevice: msg.fromDevice,
              roomCode: msg.roomCode,
            }));
            break;
          }
        }
      }
      return;
    }

    if (msg.type === 'join') {
      const roomCode = (msg.room || '').toString().trim().toUpperCase().slice(0, 32);
      if (!roomCode || roomCode.length < 3) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room code must be at least 3 characters' }));
        return;
      }

      if (msg.peerId) {
        peerId = msg.peerId;
      }

      // If switching rooms, leave previous
      if (currentRoom && currentRoom !== roomCode && rooms.has(currentRoom)) {
        const oldRoom = rooms.get(currentRoom)!;
        oldRoom.delete(ws);
        for (const [otherWs] of oldRoom) {
          if (otherWs.readyState === WebSocket.OPEN) {
            otherWs.send(JSON.stringify({ type: 'peer-left', peerId }));
          }
        }
        if (oldRoom.size === 0) rooms.delete(currentRoom);
      }

      currentRoom = roomCode;
      if (!rooms.has(roomCode)) {
        rooms.set(roomCode, new Map());
      }
      const roomPeers = rooms.get(roomCode)!;

      // Check if this peerId already has an old/stale connection in this room (reconnection scenario)
      for (const [existingWs, meta] of roomPeers) {
        if (meta.id === peerId && existingWs !== ws) {
          roomPeers.delete(existingWs);
          try {
            existingWs.close();
          } catch {}
        }
      }

      if (roomPeers.size >= 2) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Room is full (max 2 devices per transfer session)',
        }));
        currentRoom = null;
        return;
      }

      roomPeers.set(ws, { ws, id: peerId, joinedAt: Date.now() });

      const isInitiator = roomPeers.size === 1;
      ws.send(JSON.stringify({
        type: 'joined',
        room: roomCode,
        peerId,
        isInitiator,
        peerCount: roomPeers.size,
      }));

      // Notify the other peer if already in room
      for (const [otherWs] of roomPeers) {
        if (otherWs !== ws && otherWs.readyState === WebSocket.OPEN) {
          otherWs.send(JSON.stringify({
            type: 'peer-joined',
            peerId,
            peerCount: roomPeers.size,
          }));
        }
      }
      return;
    }

    if (msg.type === 'leave') {
      if (currentRoom && rooms.has(currentRoom)) {
        const roomPeers = rooms.get(currentRoom)!;
        roomPeers.delete(ws);
        for (const [otherWs] of roomPeers) {
          if (otherWs.readyState === WebSocket.OPEN) {
            otherWs.send(JSON.stringify({ type: 'peer-left', peerId }));
          }
        }
        if (roomPeers.size === 0) rooms.delete(currentRoom);
        currentRoom = null;
      }
      return;
    }

    // Forward WebRTC signaling (offer, answer, candidate, etc.) to the other peer in the room
    if (!currentRoom || !rooms.has(currentRoom)) return;
    const roomPeers = rooms.get(currentRoom)!;
    for (const [otherWs] of roomPeers) {
      if (otherWs !== ws && otherWs.readyState === WebSocket.OPEN) {
        otherWs.send(raw.toString());
      }
    }
  });

  ws.on('close', () => {
    // Remove from local network discovery group
    if (networkGroups.has(networkKey)) {
      const group = networkGroups.get(networkKey)!;
      group.delete(ws);
      if (group.size === 0) {
        networkGroups.delete(networkKey);
      } else {
        broadcastNetworkDevices(networkKey);
      }
    }

    if (currentRoom && rooms.has(currentRoom)) {
      const roomPeers = rooms.get(currentRoom)!;
      roomPeers.delete(ws);

      // Grace period: allow 5 seconds for client to reconnect before declaring peer-left
      const targetRoom = currentRoom;
      const targetPeerId = peerId;
      setTimeout(() => {
        if (rooms.has(targetRoom)) {
          const currentPeers = rooms.get(targetRoom)!;
          // Check if peer reconnected with new socket
          let reconnected = false;
          for (const [, meta] of currentPeers) {
            if (meta.id === targetPeerId) {
              reconnected = true;
              break;
            }
          }

          if (!reconnected) {
            for (const [otherWs] of currentPeers) {
              if (otherWs.readyState === WebSocket.OPEN) {
                otherWs.send(JSON.stringify({ type: 'peer-left', peerId: targetPeerId }));
              }
            }
          }
          if (currentPeers.size === 0) rooms.delete(targetRoom);
        }
      }, 5000);
    }
  });

  ws.on('error', () => {
    // Handle socket errors gracefully
  });
});

// Periodic heartbeat to clean dead connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Vite / static file serving
async function initServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Direct P2P File Transfer server running on http://0.0.0.0:${PORT}`);
  });
}

initServer().catch((err) => {
  console.error('Failed to initialize server:', err);
});
