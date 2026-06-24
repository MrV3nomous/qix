<div align="center">

# Qix.
**Total Privacy. Zero Friction.**

[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat&logo=go)](https://golang.org/)
[![React Version](https://img.shields.io/badge/React-18.x-61DAFB?style=flat&logo=react)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat&logo=mongodb)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A zero-knowledge, end-to-end encrypted, web-native ephemeral communication platform.

[Live Demo](https://qix-six.vercel.app/) · [Report Bug](https://github.com/MrV3nomous/qix/issues) · [Request Feature](https://github.com/MrV3nomous/qix/issues)

</div>

---

## ⚡ Overview

**Qix** was engineered to solve a fundamental problem with modern digital privacy: it feels too heavy. Most secure messaging utilities require phone numbers, contact book access, app installations, or metadata logging. 

Qix operates differently. It is an instantaneous, 100% web-native, zero-knowledge communication node designed for absolute transactional conversations—delicate business arrangements, security key handoffs, or confidential exchanges—leaving **zero digital footprint**.


## Test Qix today:
> https://qix-six.vercel.app/

## 🚀 Core Features

*   **Zero-Knowledge Architecture:** Cryptographic keys are generated locally via the Web Crypto API. The server never receives, parses, or logs plaintext keys or payloads.
*   **True Ephemerality:** Rooms and messages are designed to self-destruct. Users can trigger a manual "End & Shred", or rely on the MongoDB TTL failsafe to automatically wipe inactive vaults after 48 hours.
*   **Frictionless Onboarding:** No accounts, no emails, no passwords. Users generate a secure URL and share it. 
*   **Private & Group Vaults:** Dynamically scale from 1-on-1 private tunnels to multi-user group chat vaults with automatically assigned agent aliases.
*   **Real-Time WebSockets:** Low-latency, bidirectional communication using a hardened Go WebSocket hub.
*   **Automated Garbage Collection:** A custom Python daemon (`shredder.py`) aggressively sweeps the database for orphaned packets, ensuring absolute data sanitation.

## 🧠 Cryptographic Threat Model

Qix routes obfuscated binary payloads. Here is how the encryption pipeline protects user data:

1.  **Key Generation:** When a creator initiates a vault, the browser natively generates a symmetric **AES-256-GCM** key.
2.  **Fragment Isolation:** The key is embedded into the invite link's fragment identifier (`#key=...`). By W3C web standards, URL fragments are *never* transmitted to the server via HTTP requests.
3.  **Local Encryption:** Before a message hits the WebSocket, the client-side React app encrypts the plaintext and generates a unique Initialization Vector (IV).
4.  **Blind Routing:** The Go backend receives only the `Ciphertext` and the `IV`. It buffers this binary blob and broadcasts it to connected peers.
5.  **Local Decryption:** The recipient's browser uses the hash key to decrypt the incoming ciphertext back into plaintext. 

If a link is lost, the data becomes mathematically unrecoverable. 

## 🛠️ Tech Stack

**Frontend**
*   **React (Vite):** Fast, component-driven UI.
*   **Tailwind CSS:** Glassmorphic, highly responsive styling and animations.
*   **React Router:** Client-side routing and protected dynamic room states.
*   **Web Crypto API:** Native, dependency-free browser encryption.

**Backend**
*   **Go (Golang):** High-performance, concurrent HTTP API and WebSocket router (`gorilla/websocket`).
*   **Chi Router:** Lightweight, idiomatic routing.
*   **JWT (JSON Web Tokens):** 48-hour stateless role-based authentication.
*   **Redis:** In-memory message buffering and pub/sub room states.

**Database & Infrastructure**
*   **MongoDB Atlas:** Persistent data store utilizing strict TTL (Time-To-Live) indexes for automated data shredding.
*   **Python:** Dedicated background daemon for orphaned data garbage collection.

## ⚙️ Local Development Setup

To run Qix locally, you will need Node.js, Go, and a MongoDB instance.

### 1. Clone the repository

```bash
git clone [https://github.com/your-username/qix.git](https://github.com/your-username/qix.git)
cd qix
```

2. Backend Setup (Go)
```bash
cd server
go mod tidy
```
Create a .env file in the server directory:

Code snippet:
```bash
PORT=8080
MONGO_URI=mongodb://localhost:27017/qix
JWT_SIGNING_KEY_V1=your_super_secret_random_string
FRONTEND_URL=http://localhost:5173
```

Start the Go server:
```bash
go run main.go
```

3. Frontend Setup (React)
```bash
cd client
npm install
```
Create a .env file in the client directory:

Code snippet:
```bash
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
```

Start the Vite development server:

```bash
npm run dev
```

4. Database Optimization
To enable the 48-hour automated shredder, run this command in your MongoDB shell:

```JavaScript
use qix
db.rooms.createIndex( { "lastActiveAt": 1 }, { expireAfterSeconds: 172800 } )
```

---


⚖️ Legal & Disclaimer

Qix is an open-source project created for educational and portfolio demonstration purposes. The operator explicitly disclaims all liability regarding data loss, cryptographic compromise, or misuse. By deploying or utilizing this software, you agree to the strict terms outlined in the Terms of Service.

---

👨‍💻 About the Developer

Built by Soumik Halder.
Portfolio: https://soumikhalder.vercel.app/
