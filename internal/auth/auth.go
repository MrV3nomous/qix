package auth

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type QixClaims struct {
	RoomID    string `json:"room_id"`
	SessionID string `json:"session_id"`
	Role      string `json:"role"`
	jwt.RegisteredClaims
}

func GetSigningKey(kid string) ([]byte, error) {
	var envVar string
	switch kid {
	case "1":
		envVar = "JWT_SIGNING_KEY_V1"
	case "2":
		envVar = "JWT_SIGNING_KEY_V2"
	default:
		return nil, fmt.Errorf("unknown key ID: %s", kid)
	}

	key := os.Getenv(envVar)
	if key == "" {
		return nil, fmt.Errorf("signing key %s is not configured in environment", envVar)
	}
	return []byte(key), nil
}

func GenerateSessionToken(roomID, sessionID, role, kid string) (string, error) {
	signingKey, err := GetSigningKey(kid)
	if err != nil {
		return "", err
	}

	claims := QixClaims{
		RoomID:    roomID,
		SessionID: sessionID,
		Role:      role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(48 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["kid"] = kid

	return token.SignedString(signingKey)
}

func GenerateInviteToken(roomID, inviteID, kid string) (string, error) {
	signingKey, err := GetSigningKey(kid)
	if err != nil {
		return "", err
	}

	claims := QixClaims{
		RoomID: roomID,
		Role:   "guest_invite",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        inviteID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(48 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["kid"] = kid

	return token.SignedString(signingKey)
}

func ValidateToken(tokenStr string) (*QixClaims, error) {
	parsedToken, err := jwt.ParseWithClaims(tokenStr, &QixClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}

		kid, ok := token.Header["kid"].(string)
		if !ok || kid == "" {
			return nil, errors.New("missing key ID (kid) in token header")
		}

		return GetSigningKey(kid)
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := parsedToken.Claims.(*QixClaims); ok && parsedToken.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token payload")
}