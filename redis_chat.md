# Chat Persistence with Redis

## Why Redis?

For an in-order chat between customer, merchant, and carrier, messages are only relevant while the order is active. Once the order is delivered, chat history usually has little value.

### Option A: Redis Only (Recommended)

* Fast and simple
* Messages survive page reloads
* Auto-cleanup with TTL
* Fits naturally into a Socket.IO + Redis architecture
* No additional database tables required

### Option B: Supabase

* Permanent storage
* Queryable history
* More complex than necessary for temporary order chats

For this use case, **Redis is the better choice**.

---

## Message Flow

```text
User sends message
    ↓
Socket.IO → Backend
    ↓
RPUSH chat:{orderId} {message}
EXPIRE chat:{orderId} 7 days
    ↓
PUBLISH to Redis Pub/Sub channel
    ↓
All Socket.IO instances emit to room
```

### Redis Commands

Store message:

```redis
RPUSH chat:123 "{message}"
```

Set expiration:

```redis
EXPIRE chat:123 604800
```

(7 days = 604,800 seconds)

Publish for horizontal scaling:

```redis
PUBLISH order-chat:123 "{message}"
```

---

## Reload / Reconnect Flow

When a client reconnects or refreshes:

```text
Client joins order room
    ↓
Backend fetches chat history
    ↓
LRANGE chat:{orderId} 0 -1
    ↓
Emit history to client
```

### Redis Command

```redis
LRANGE chat:123 0 -1
```

Returns all stored messages for the order.

---

## Benefits

* Survives hard refreshes
* Extremely low latency
* Supports multiple backend instances through Pub/Sub
* Automatic cleanup via TTL
* No database maintenance for temporary chats
* Demonstrates practical Redis usage beyond caching

## Suggested Key Structure

```text
chat:{orderId}
```

Examples:

```text
chat:123
chat:456
chat:789
```

Each key contains a Redis List of chat messages for that order.


## Overall Flow

```text
Page reload
    ↓
Client emits room:join
    ↓
Server joins socket to order room
    ↓
Server fetches Redis chat history
    ↓
Server emits chat:history to this user
    ↓
User sees previous messages
```

This is what gives you **chat persistence across refreshes** without storing anything in a database.

Why Redis for chat?

In-order chat is temporary — only relevant while the order is active. Redis with TTL auto-cleans after 7 days. No DB tables needed.
Message send flow:

Client emits chat:message → backend does RPUSH + LTRIM + EXPIRE → broadcasts to room via socket.to(room) (excludes sender to avoid duplicates) → sender adds message to local state directly.
Reload flow:

Client emits room:join → backend fetches LRANGE chat:{orderId} 0 -1 → emits chat:history to that socket only → frontend calls setMessages(history).
4 Redis commands:

RPUSH chat:{orderId} — store message
LTRIM chat:{orderId} -200 -1 — cap at 200
EXPIRE chat:{orderId} 604800 — 7 day TTL
LRANGE chat:{orderId} 0 -1 — fetch history on reconnect

What changed in frontend:

Removed localStorage read/write/clear. Added chat:history listener inside the socket useEffect on both customer and carrier pages.
Key structure: chat:{orderId} — one Redis List per order.