package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"qix-server/internal/auth"
	"qix-server/internal/database"

	"go.mongodb.org/mongo-driver/mongo/options"
)

type DBMessage struct {
	ID         string    `bson:"_id"`
	RoomID     string    `bson:"roomId"`
	SenderID   string    `bson:"senderId"`
	Ciphertext string    `bson:"ciphertext"`
	IV         string    `bson:"iv"`
	Timestamp  time.Time `bson:"timestamp"`
}

type HistoryMessage struct {
	MessageID string `json:"message_id"`
	Content   string `json:"content"`
	IV        string `json:"iv"`
	Type      string `json:"type"`
	SenderID  string `json:"sender_id"`
	IsMine    bool   `json:"isMine"`
	Timestamp string `json:"timestamp"`
}

type Room struct {
	ID               string     `bson:"_id"`
	Name             string     `bson:"name"`
	Theme            string     `bson:"theme"`
	RoomType         string     `bson:"roomType"`
	MaxCapacity      int        `bson:"maxCapacity"`
	CurrentUsers     int        `bson:"currentUsers"`
	SchemaVersion    int        `bson:"schemaVersion"`
	CreatorSessionID string     `bson:"creatorSessionId"`
	CreatedAt        time.Time  `bson:"createdAt"`
	ExpiresAt        time.Time  `bson:"expiresAt"`
	LastActiveAt     time.Time  `bson:"lastActiveAt"`
	Terminated       bool       `bson:"terminated"`
	ReviewExpiresAt  *time.Time `bson:"reviewExpiresAt"`
	Flagged          bool       `bson:"flagged"`
	KeyVersion       int        `bson:"keyVersion"`
	Status           string     `bson:"status"`
}

func generateSecureID(length int) string {
	bytes := make([]byte, length)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func extractToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		return authHeader[7:]
	}
	return ""
}

func CreateRoomHandler(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 2048)

	var req struct {
		Name  string `json:"name"`
		Theme string `json:"theme"`
		Type  string `json:"type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	if len(req.Name) > 50 {
		req.Name = req.Name[:50]
	}
	if len(req.Theme) > 30 {
		req.Theme = req.Theme[:30]
	}

	if req.Name == "" {
		req.Name = "Secure Vault"
	}
	if req.Theme == "" {
		req.Theme = "aurora"
	}
	
	roomType := req.Type
	if roomType != "group" {
		roomType = "private"
	}

	maxCapacity := 2
	if roomType == "group" {
		maxCapacity = 50
	}

	roomID := "room_" + generateSecureID(8)
	creatorSessionID := "sess_" + generateSecureID(8)
	inviteID := "inv_" + generateSecureID(8)

	now := time.Now()
	expiresAt := now.Add(24 * time.Hour)

	newRoom := Room{
		ID:               roomID,
		Name:             req.Name,
		Theme:            req.Theme,
		RoomType:         roomType,
		MaxCapacity:      maxCapacity,
		CurrentUsers:     1,
		SchemaVersion:    1,
		CreatorSessionID: creatorSessionID,
		CreatedAt:        now,
		ExpiresAt:        expiresAt,
		LastActiveAt:     now,
		Terminated:       false,
		ReviewExpiresAt:  nil,
		Flagged:          false,
		KeyVersion:       1,
		Status:           "active",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := database.RoomsCollection.InsertOne(ctx, newRoom)
	if err != nil {
		log.Printf("Create Error (Mongo): %v", err)
		http.Error(w, "Failed to create room in database", http.StatusInternalServerError)
		return
	}

	creatorToken, err := auth.GenerateSessionToken(roomID, creatorSessionID, "creator", "1")
	if err != nil {
		log.Printf("Create Error (Creator Token): %v", err)
		http.Error(w, "Failed to generate creator token", http.StatusInternalServerError)
		return
	}

	guestInviteToken, err := auth.GenerateInviteToken(roomID, inviteID, "1")
	if err != nil {
		log.Printf("Create Error (Invite Token): %v", err)
		http.Error(w, "Failed to generate invite token", http.StatusInternalServerError)
		return
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}

	response := map[string]string{
		"room_id":     roomID,
		"room_name":   req.Name,
		"room_theme":  req.Theme,
		"invite_link": frontendURL + "/join?token=" + guestInviteToken,
		"session_id":  creatorSessionID,
		"auth_token":  creatorToken,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func JoinRoomHandler(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 2048)

	var requestBody struct {
		InviteToken string `json:"invite_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		log.Printf("Join Error (Body Decode): %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	claims, err := auth.ValidateToken(requestBody.InviteToken)
	if err != nil {
		log.Printf("Join Error (Token Validation): %v", err)
		http.Error(w, "Invalid or expired invite token", http.StatusUnauthorized)
		return
	}

	if claims.Role != "guest_invite" {
		log.Printf("Join Error (Role Mismatch): expected guest_invite, got %s", claims.Role)
		http.Error(w, "Invalid role", http.StatusUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := map[string]interface{}{
		"_id":        claims.RoomID,
		"terminated": false,
		"$expr": map[string]interface{}{
			"$lt": []interface{}{"$currentUsers", "$maxCapacity"},
		},
	}
	
	update := map[string]interface{}{
		"$inc": map[string]interface{}{"currentUsers": 1},
	}

	var room Room
	err = database.RoomsCollection.FindOneAndUpdate(ctx, filter, update).Decode(&room)
	if err != nil {
		log.Printf("Join Error/Capacity Reached for Room ID: %s", claims.RoomID)
		http.Error(w, "Room is full, expired, or does not exist.", http.StatusForbidden)
		return
	}

	guestSessionID := "sess_" + generateSecureID(8)

	guestToken, err := auth.GenerateSessionToken(room.ID, guestSessionID, "guest", "1")
	if err != nil {
		log.Printf("Join Error (Generate Guest Token): %v", err)
		http.Error(w, "Failed to generate session token", http.StatusInternalServerError)
		return
	}

	response := map[string]string{
		"room_id":    room.ID,
		"room_name":  room.Name,
		"room_theme": room.Theme,
		"session_id": guestSessionID,
		"auth_token": guestToken,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func GetMessagesHandler(w http.ResponseWriter, r *http.Request) {
	tokenStr := extractToken(r)
	if tokenStr == "" {
		log.Printf("Error: No authentication token provided")
		http.Error(w, "Missing token", http.StatusUnauthorized)
		return
	}

	claims, err := auth.ValidateToken(tokenStr)
	if err != nil {
		log.Printf("History Error: Token validation failed: %v", err)
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := map[string]interface{}{"roomId": claims.RoomID}
	opts := options.Find().SetSort(map[string]interface{}{"timestamp": 1})

	cursor, err := database.MessagesCollection.Find(ctx, filter, opts)
	if err != nil {
		log.Printf("History Error: MongoDB lookup failed: %v", err)
		http.Error(w, "Database lookup failed", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var encryptedMessages []DBMessage
	if err = cursor.All(ctx, &encryptedMessages); err != nil {
		log.Printf("History Error: Failed to decode BSON: %v", err)
		http.Error(w, "Failed to decode database records", http.StatusInternalServerError)
		return
	}

	history := make([]HistoryMessage, 0)
	for _, em := range encryptedMessages {
		history = append(history, HistoryMessage{
			MessageID: em.ID,
			Content:   em.Ciphertext,
			IV:        em.IV,
			Type:      "MESSAGE",
			SenderID:  em.SenderID,
			IsMine:    em.SenderID == claims.SessionID,
			Timestamp: em.Timestamp.Format(time.RFC3339),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(history)
}

func TerminateRoomHandler(w http.ResponseWriter, r *http.Request) {
	tokenStr := extractToken(r)
	if tokenStr == "" {
		log.Printf("Error: No authentication token provided")
		http.Error(w, "Missing token", http.StatusUnauthorized)
		return
	}

	claims, err := auth.ValidateToken(tokenStr)
	if err != nil {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := map[string]interface{}{"$set": map[string]interface{}{"terminated": true}}
	_, err = database.RoomsCollection.UpdateOne(ctx, map[string]interface{}{"_id": claims.RoomID}, update)

	if err != nil {
		http.Error(w, "Failed to terminate room", http.StatusInternalServerError)
		return
	}

	log.Printf("Room %s has been TERMINATED by user %s", claims.RoomID, claims.SessionID)
	w.WriteHeader(http.StatusOK)
}

func UpdateThemeHandler(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1024)

	tokenStr := extractToken(r)
	if tokenStr == "" {
		http.Error(w, "Missing token", http.StatusUnauthorized)
		return
	}

	claims, err := auth.ValidateToken(tokenStr)
	if err != nil {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	var req struct {
		Theme string `json:"theme"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if len(req.Theme) > 30 {
		req.Theme = req.Theme[:30]
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = database.RoomsCollection.UpdateOne(
		ctx,
		map[string]interface{}{"_id": claims.RoomID},
		map[string]interface{}{"$set": map[string]interface{}{"theme": req.Theme}},
	)
	if err != nil {
		http.Error(w, "Failed to update theme", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}