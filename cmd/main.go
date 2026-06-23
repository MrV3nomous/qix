package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"qix-server/internal/api"
	"qix-server/internal/chat"
	"qix-server/internal/database"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/joho/godotenv"
)

func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		next.ServeHTTP(w, r)
	})
}

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: No .env file found.")
	}

	if err := database.Connect(); err != nil {
		log.Fatalf("Database Connection Failed: %v", err)
	}
	defer database.Disconnect()

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(SecurityHeaders)

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "https://qix-six.vercel.app"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	limitMiddleware := httprate.LimitByIP(5, 1*time.Minute)

	r.With(limitMiddleware).Post("/room", api.CreateRoomHandler)
	r.With(limitMiddleware).Post("/join", api.JoinRoomHandler)
	r.With(httprate.LimitByIP(30, 1*time.Minute)).Get("/messages", api.GetMessagesHandler)
	r.With(httprate.LimitByIP(5, 1*time.Minute)).Post("/terminate", api.TerminateRoomHandler)

	r.With(httprate.LimitByIP(15, 1*time.Minute)).Post("/theme", api.UpdateThemeHandler)

	r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Alive"))
	})

	r.HandleFunc("/ws", chat.ServeWS)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Starting hardened Qix server on port %s...\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}