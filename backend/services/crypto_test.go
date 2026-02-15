package services

import (
	"testing"
)

// ---------- EncryptAPIKey / DecryptAPIKey round-trip ----------

func TestEncryptDecryptRoundTrip(t *testing.T) {
	original := "sk-test-key-12345678"
	encrypted, err := EncryptAPIKey(original)
	if err != nil {
		t.Fatalf("EncryptAPIKey failed: %v", err)
	}
	if encrypted == "" {
		t.Fatal("EncryptAPIKey returned empty string")
	}
	if encrypted == original {
		t.Fatal("EncryptAPIKey returned the plaintext unchanged")
	}

	decrypted, err := DecryptAPIKey(encrypted)
	if err != nil {
		t.Fatalf("DecryptAPIKey failed: %v", err)
	}
	if decrypted != original {
		t.Errorf("DecryptAPIKey mismatch: got %q, want %q", decrypted, original)
	}
}

func TestEncryptEmptyString(t *testing.T) {
	encrypted, err := EncryptAPIKey("")
	if err != nil {
		t.Fatalf("EncryptAPIKey failed: %v", err)
	}
	if encrypted != "" {
		t.Errorf("Expected empty string, got %q", encrypted)
	}
}

func TestDecryptEmptyString(t *testing.T) {
	decrypted, err := DecryptAPIKey("")
	if err != nil {
		t.Fatalf("DecryptAPIKey failed: %v", err)
	}
	if decrypted != "" {
		t.Errorf("Expected empty string, got %q", decrypted)
	}
}

func TestDecryptInvalidHex(t *testing.T) {
	_, err := DecryptAPIKey("not-valid-hex!")
	if err == nil {
		t.Fatal("Expected error for invalid hex, got nil")
	}
}

func TestDecryptTooShort(t *testing.T) {
	_, err := DecryptAPIKey("abcd")
	if err == nil {
		t.Fatal("Expected error for too-short ciphertext, got nil")
	}
}

func TestDecryptTamperedCiphertext(t *testing.T) {
	encrypted, err := EncryptAPIKey("my-secret-key")
	if err != nil {
		t.Fatalf("EncryptAPIKey failed: %v", err)
	}

	// Flip the last hex character to tamper with it
	tampered := encrypted[:len(encrypted)-1] + "0"
	if tampered == encrypted {
		tampered = encrypted[:len(encrypted)-1] + "1"
	}

	_, err = DecryptAPIKey(tampered)
	if err == nil {
		t.Fatal("Expected error for tampered ciphertext, got nil")
	}
}

func TestEncryptProducesDifferentCiphertexts(t *testing.T) {
	// Two encryptions of the same plaintext should result in different ciphertexts
	// because a random nonce is used each time.
	plain := "same-key-value"
	enc1, err := EncryptAPIKey(plain)
	if err != nil {
		t.Fatalf("first EncryptAPIKey failed: %v", err)
	}
	enc2, err := EncryptAPIKey(plain)
	if err != nil {
		t.Fatalf("second EncryptAPIKey failed: %v", err)
	}
	if enc1 == enc2 {
		t.Error("Two encryptions of the same plaintext should differ (random nonce)")
	}
}

// ---------- MaskAPIKey ----------

func TestMaskAPIKey(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"sk-1234567890abcdef", "sk-...cdef"},
		{"short", "****"},
		{"12345678", "123...5678"},
		{"", "****"},
		{"abcdefg", "****"}, // length 7 < 8
	}

	for _, tc := range tests {
		got := MaskAPIKey(tc.input)
		if got != tc.expected {
			t.Errorf("MaskAPIKey(%q) = %q, want %q", tc.input, got, tc.expected)
		}
	}
}
