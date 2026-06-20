package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	MongoClient *mongo.Client
	RedisClient *redis.Client

	RoomsCollection    *mongo.Collection
	MessagesCollection *mongo.Collection
)

func Connect() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		return fmt.Errorf("MONGODB_URI is not set in .env")
	}

	clientOptions := options.Client().ApplyURI(mongoURI)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return fmt.Errorf("failed to connect to MongoDB: %v", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		return fmt.Errorf("failed to ping MongoDB: %v", err)
	}

	MongoClient = client

	db := MongoClient.Database("qix")
	RoomsCollection = db.Collection("rooms")
	MessagesCollection = db.Collection("messages")

	log.Println("Successfully connected to MongoDB")

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		return fmt.Errorf("REDIS_URL is not set in .env")
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return fmt.Errorf("failed to parse REDIS_URL: %v", err)
	}

	RedisClient = redis.NewClient(opts)

	if err := RedisClient.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to connect to Redis: %v", err)
	}

	log.Println("Successfully connected to Redis")

	return nil
}

func Disconnect() {
	if MongoClient != nil {
		if err := MongoClient.Disconnect(context.Background()); err != nil {
			log.Printf("Error disconnecting MongoDB: %v\n", err)
		}
	}
	if RedisClient != nil {
		if err := RedisClient.Close(); err != nil {
			log.Printf("Error disconnecting Redis: %v\n", err)
		}
	}
}
