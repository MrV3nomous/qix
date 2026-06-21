package chat

import (
	"sync"
)

type Hub struct {
	sync.Mutex
	Rooms map[string]map[string]*Client
}

var GlobalHub = &Hub{
	Rooms: make(map[string]map[string]*Client),
}

func (h *Hub) Register(client *Client) {
	h.Lock()
	defer h.Unlock()

	if h.Rooms[client.Claims.RoomID] == nil {
		h.Rooms[client.Claims.RoomID] = make(map[string]*Client)
	}
	h.Rooms[client.Claims.RoomID][client.Claims.SessionID] = client
}

func (h *Hub) Unregister(client *Client) {
	h.Lock()
	defer h.Unlock()

	if room, ok := h.Rooms[client.Claims.RoomID]; ok {
		if currentClient, exists := room[client.Claims.SessionID]; exists && currentClient == client {
			delete(room, client.Claims.SessionID)
			if len(room) == 0 {
				delete(h.Rooms, client.Claims.RoomID)
			}
		}
	}
}

func (h *Hub) BroadcastToRoom(roomID string, senderSessionID string, message []byte) {
	h.Lock()
	defer h.Unlock()

	if room, ok := h.Rooms[roomID]; ok {
		for sessionID, client := range room {
			if sessionID != senderSessionID {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(room, sessionID)
				}
			}
		}
	}
}
