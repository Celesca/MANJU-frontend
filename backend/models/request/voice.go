package request

// CreateVoicePayload represents the expected payload to create a voice
type CreateVoicePayload struct {
	VoiceName string `json:"voice_name"`
	VoiceURL  string `json:"voice_url"`
	RefText   string `json:"ref_text,omitempty"`
	Gender    string `json:"gender,omitempty"`    // "male" | "female"
	AgeRange  string `json:"age_range,omitempty"` // "child" | "youth" | "adult" | "middle-aged" | "older"
	Language  string `json:"language,omitempty"`  // e.g., "en", "th", "ja"
	UserID    string `json:"user_id"`
}
