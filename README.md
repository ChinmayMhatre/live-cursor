# Shared Workspace - Real-time Cursor Tracking

This project implements a backend and a React client for tracking and broadcasting user cursors in real-time across a shared workspace. It is designed to scale horizontally across multiple instances using Redis Pub/Sub.


## Quick Start (Production Simulation with Docker)

The easiest way to run the entire architecture (Frontend Nginx, Node Backend, and Redis) is using Docker Compose. This perfectly simulates a production deployment without requiring any manual configuration.

```bash
docker-compose up --build
```

Open `http://localhost:8080` in your browser. The frontend's Nginx reverse proxy will automatically route all `/socket.io/` requests to the horizontally scalable backend.

> [!NOTE]
> **A Note on Production Deployment:** We provide `docker-compose` here so reviewers can easily boot and test a full replica of the architecture locally with zero setup. In a true enterprise production environment, we would not use Docker Compose. The static React build would be deployed to a serverless CDN (like AWS CloudFront or Vercel), the Node backend would be deployed to an orchestration service (like AWS ECS or Kubernetes), and we would utilize a managed Redis instance (like ElastiCache).

---

## Local Native Setup (Development)

If you prefer to run the codebase natively for Hot Module Replacement (HMR):

### Prerequisites (Native Only)
- Node.js (v18+)
- Redis Server (if you want to test multi-server scaling locally)

### 1. Setup Backend
```bash
cd backend
npm install
npm start
```
*Note: The backend defaults to port 3000. It will attempt to connect to Redis at `redis://localhost:6379`. If Redis is not running, it gracefully falls back to single-instance mode.*

### 2. Setup Client
```bash
cd client
npm install
npm run dev
```
Open the provided local URL (usually `http://localhost:5173`) in multiple browser windows to see real-time cursor broadcasting.

## 3. Load Testing
To simulate 100 concurrent users moving their cursors simultaneously, simply click the **"Start Load Test"** button in the web interface. This triggers headless WebSocket clients in the backend to begin broadcasting.

---

## Architecture & Multi-Server Deployment

This backend is built with Node.js and Socket.IO. To satisfy the requirement of horizontal scaling and allowing replicas to be killed/restarted dynamically, we use **Redis Pub/Sub** via the `@socket.io/redis-adapter`.

### Infrastructure Requirements for Production
1. **Redis Cluster/Instance**: All Node.js backend replicas must connect to the same Redis instance.
2. **Load Balancer**: A load balancer (like Nginx, HAProxy, or AWS ALB) is required to distribute incoming WebSocket connections across the replicas.

### Load Balancer Configuration (Sticky Sessions)
While WebSocket connections are persistent, the initial handshake uses HTTP polling before upgrading. Therefore, **Sticky Sessions (Session Affinity)** are highly recommended so the initial polling requests hit the same server instance before upgrading to WebSocket.

**Example Nginx Configuration:**
```nginx
http {
    upstream io_nodes {
        ip_hash; # Enables sticky sessions based on client IP
        server 127.0.0.1:3000;
        server 127.0.0.1:3001;
        server 127.0.0.1:3002;
    }

    server {
        listen 80;

        location / {
            proxy_pass http://io_nodes;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
}
```

With this setup, if a Node replica goes down, Socket.IO clients will automatically attempt to reconnect. The Load Balancer will route them to a healthy instance, and they will seamlessly receive a new `workspace:sync` event to restore the shared state without losing functionality.

---

## Future Optimizations

### Server-side Event Batching (Tick Rate)
Currently, the server broadcasts every `cursor:moved` event the instant it receives it. With 100 users moving their mouse 20 times a second, this results in **2,000 WebSocket packets per second** being pushed to the client, which can cause network/CPU choppiness as the browser struggles to parse the headers.

To resolve this at extreme scale, implement a **30Hz Tick Rate**:
1. Instead of calling `socket.broadcast.emit` instantly, the server stores the latest `{x, y}` coordinates in a temporary dictionary.
2. A server-side `setInterval` runs every 33ms (30 times a second).
3. Every 33ms, the server broadcasts the entire dictionary of pending moves as one single payload, and clears the dictionary.

This reduces the network overhead from thousands of tiny packets a second to just 30 slightly larger packets a second, maintaining visual fluidity while drastically lowering the computational cost on the client's networking thread.

### Client-Side Session Persistence (Reconnections)
Socket.IO handles reconnections automatically. However, currently when a server restarts, the client reconnects and is treated as a brand new user (assigned a new UUID, name, and color). 

To ensure identity persistence across server crashes in the future:
1. When the client first connects and receives its `workspace:sync` payload, it should save its assigned `participantId` to `sessionStorage`.
2. When initializing the WebSocket, the client should send this ID in the `auth` payload: `io({ auth: { sessionId: sessionStorage.getItem('sessionId') } })`.
3. The server should check the handshake payload and reuse the existing UUID and color if provided, rather than generating a new one.
