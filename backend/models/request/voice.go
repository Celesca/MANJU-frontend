package request

// CreateVoicePayload represents the expected payload to create a voice
type CreateVoicePayload struct {
	VoiceName string `json:"voice_name"`
	VoiceURL  string `json:"voice_url"`
	RefText   string `json:"ref_text,omitempty"`
	UserID    string `json:"user_id"`
}
