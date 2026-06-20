package chat

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"qix-server/internal/auth"
	"qix-server/internal/database"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  8192,
	WriteBufferSize: 8192,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

const (
	pongWait       = 60 * time.Second
	pingPeriod     = 20 * time.Second
	maxMessageSize = 2048
)

type Client struct {
	Conn   *websocket.Conn
	Claims *auth.QixClaims
	Send   chan []byte
}

type IncomingMessage struct {
	Type      string `json:"type"`
	Content   string `json:"content"`
	IV        string `json:"iv"`
	MessageID string `json:"message_id"`
	SenderID  string `json:"sender_id,omitempty"`
}

type DBMessage struct {
	ID         string    `bson:"_id"`
	RoomID     string    `bson:"roomId"`
	SenderID   string    `bson:"senderId"`
	Ciphertext string    `bson:"ciphertext"`
	IV         string    `bson:"iv"`
	Timestamp  time.Time `bson:"timestamp"`
}

func ServeWS(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("qix_token")
	if err != nil {
		http.Error(w, "Missing authentication cookie", http.StatusUnauthorized)
		return
	}
	tokenStr := cookie.Value

	claims, err := auth.ValidateToken(tokenStr)
	if err != nil {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade WebSocket: %v", err)
		return
	}

	client := &Client{
		Conn:   conn,
		Claims: claims,
		Send:   make(chan []byte, 256),
	}

	GlobalHub.Register(client)
	log.Printf("User %s joined room %s", claims.SessionID, claims.RoomID)

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		unacked, err := database.RedisClient.HGetAll(ctx, "buffer:"+claims.RoomID).Result()
		if err == nil && len(unacked) > 0 {
			for _, payloadStr := range unacked {
				client.Send <- []byte(payloadStr)
			}
		}
	}()

	go client.writePump()
	go client.readPump()
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) readPump() {
	defer func() {
		GlobalHub.Unregister(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, payload, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Socket Error/Overflow Attempt from %s: %v", c.Claims.SessionID, err)
			}
			break
		}
		c.handleIncomingMessage(payload)
	}
}

func (c *Client) handleIncomingMessage(payload []byte) {
	var msg IncomingMessage
	if err := json.Unmarshal(payload, &msg); err != nil {
		log.Printf("Malformed message payload unmarshal failure")
		return
	}

	if msg.Type == "ACK" {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		database.RedisClient.HDel(ctx, "buffer:"+c.Claims.RoomID, msg.MessageID)
		GlobalHub.BroadcastToRoom(c.Claims.RoomID, c.Claims.SessionID, payload)
		return
	}

	if msg.Type == "TERMINATE" {
		ctxMongo, cancelMongo := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancelMongo()

		database.RoomsCollection.UpdateOne(
			ctxMongo,
			map[string]interface{}{"_id": c.Claims.RoomID},
			map[string]interface{}{"$set": map[string]interface{}{"terminated": true}},
		)

		GlobalHub.BroadcastToRoom(c.Claims.RoomID, c.Claims.SessionID, payload)
		return
	}

	if msg.Type == "MESSAGE" {
		dbMsg := DBMessage{
			ID:         msg.MessageID,
			RoomID:     c.Claims.RoomID,
			SenderID:   c.Claims.SessionID,
			Ciphertext: msg.Content,
			IV:         msg.IV,
			Timestamp:  time.Now(),
		}

		ctxMongo, cancelMongo := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancelMongo()
		if _, err := database.MessagesCollection.InsertOne(ctxMongo, dbMsg); err != nil {
			return
		}

		database.RoomsCollection.UpdateOne(
			ctxMongo,
			map[string]interface{}{"_id": c.Claims.RoomID},
			map[string]interface{}{"$set": map[string]interface{}{"lastActiveAt": time.Now()}},
		)

		msg.SenderID = c.Claims.SessionID

		enrichedPayload, _ := json.Marshal(msg)

		ctxRedis, cancelRedis := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancelRedis()

		database.RedisClient.HSet(ctxRedis, "buffer:"+c.Claims.RoomID, msg.MessageID, enrichedPayload)

		GlobalHub.BroadcastToRoom(c.Claims.RoomID, c.Claims.SessionID, enrichedPayload)
	}
}
