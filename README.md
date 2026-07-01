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

If you prefer to run the codebase natively for Hot Module Replacement (HMR) without Docker:

### Prerequisites (Native Only)
- Node.js (v18+)
- Redis Server (if you want to test multi-server scaling locally)

### 1. Install Dependencies
Run the following command in the root directory to install dependencies for both the frontend and backend:
```bash
make install
```

### 2. Start Services
To start both the Node.js backend and the Vite React client concurrently, run:
```bash
make start-all
```
*Note: The backend defaults to port 3000. It will attempt to connect to Redis at `redis://localhost:6379`. If Redis is not running, it gracefully falls back to single-instance mode.*

Open the provided local URL (usually `http://localhost:5173`) in multiple browser windows to see real-time cursor broadcasting.

## 3. Load Testing
To simulate 100 concurrent users moving their cursors simultaneously, you can run the headless WebSocket clients via the Makefile:
```bash
make load-test
```
Alternatively, you can also trigger this by clicking the **"Start Load Test"** button in the web interface.

---

## Architecture & Multi-Server Deployment

This project is designed for **horizontal scalability**, allowing you to run multiple instances of the Node.js backend simultaneously. This ensures high availability and allows the system to handle thousands of concurrent users. 

To achieve this, we use **Redis Pub/Sub** via the `@socket.io/redis-adapter`. 

### Why is Redis necessary for Socket.IO?
By default, Socket.IO stores connected clients in the server's local memory. If Client A connects to Backend Node 1, and Client B connects to Backend Node 2, they cannot communicate directly. 

When a user moves their cursor, the event must be broadcast to *everyone* in the workspace, regardless of which backend node they are connected to. 
The **Redis Adapter** solves this. When Node 1 receives a cursor update from Client A, it publishes that event to Redis. Redis then instantly pushes the event to all other backend nodes (Node 2, Node 3, etc.), which then broadcast it to their respective connected clients.

### Infrastructure Requirements for Production
1. **Redis Server**: A centralized Redis instance (e.g., AWS ElastiCache) that all backend replicas connect to.
2. **Load Balancer**: A reverse proxy (e.g., Nginx, HAProxy, AWS ALB) to distribute incoming traffic across the backend replicas.

### Load Balancer Configuration (Sticky Sessions)
Socket.IO relies heavily on HTTP Long-Polling for the initial connection handshake before upgrading to a persistent WebSocket connection. 

Because of this multi-request handshake, your load balancer **must** be configured with **Sticky Sessions (Session Affinity)**. This ensures that all HTTP requests from a specific user during the handshake phase are routed to the exact same backend replica. Once the connection upgrades to WebSockets, it remains persistent.

**Example Nginx Configuration:**
```nginx
http {
    upstream io_nodes {
        # 'ip_hash' ensures requests from the same IP always hit the same server
        ip_hash; 
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

### Fault Tolerance & Reconnection
With this architecture, if a Node replica crashes or is terminated, its connected clients will disconnect. However, Socket.IO's client library will automatically attempt to reconnect. The Load Balancer will seamlessly route these reconnecting clients to a different, healthy replica. Upon reconnection, they will receive a new `workspace:sync` event to restore the shared state without losing functionality or causing visual glitches.

---

## Future Optimizations

### Decoupling State via Redis (Replacing `fetchSockets`)
Currently, when a new user joins, `fetchSockets()` is called. This triggers a Pub/Sub broadcast across the Redis adapter asking **every single Node replica** to report back with their connected clients. At scale, this "scatter-gather" query is slow and causes massive network congestion.

To resolve this, the **Connection Layer** should be decoupled from the **State Layer**:
1. When a user joins or moves, the Node server instantly writes their state to a Redis Hash: `HSET workspace:participants user_id "{x: 10, y: 20}"`.
2. When a new user joins, instead of asking all other servers who is online, the server simply makes one fast query to Redis: `HGETALL workspace:participants`.
3. When a user disconnects, the server removes them from the Redis Hash: `HDEL workspace:participants user_id`.

This makes the WebSocket servers completely stateless—acting as dumb pipes passing messages to and from Redis—allowing infinite scaling without losing track of active users.

### Client-Side Session Persistence (Reconnections)
Socket.IO handles reconnections automatically. However, currently when a server restarts, the client reconnects and is treated as a brand new user (assigned a new UUID, name, and color). 

To ensure identity persistence across server crashes in the future:
1. When the client first connects and receives its `workspace:sync` payload, it should save its assigned `participantId` to `sessionStorage`.
2. When initializing the WebSocket, the client should send this ID in the `auth` payload: `io({ auth: { sessionId: sessionStorage.getItem('sessionId') } })`.
3. The server should check the handshake payload and reuse the existing UUID and color if provided, rather than generating a new one.
