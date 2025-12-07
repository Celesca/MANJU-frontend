package request

import "manju/backend/repository"

// payloads
type CreateUserPayload struct {
	Email  string                 `json:"email"`
	Name   string                 `json:"name"`
	Info   map[string]interface{} `json:"info,omitempty"`
	Status repository.Status      `json:"status,omitempty"`
}
