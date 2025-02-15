package slack

import (
	"context"
	"fmt"
)

// Module defines the interface for Slack operations
type Module interface {
	// SendMessage sends a message to Slack
	SendMessage(msg string) error

	// ValidateSession validates the current session
	ValidateSession() error

	// SaveCookies saves the session cookies to a file
	SaveCookies(dir string) error

	// LoadCookies loads the session cookies from a file
	LoadCookies(dir string) error

	// PrepararMensagem prepares a message to be sent based on the type
	PrepararMensagem(tipoMensagem string) (bool, string, error)

	// Close releases resources used by the module
	Close()
}

// Config holds the configuration for the Slack module
type Config struct {
	ConfigDir string
}

// NewModule creates a new instance of the Slack module
func NewModule(ctx context.Context, config Config) (Module, error) {
	session := NewSlackSession(ctx)
	if session == nil {
		return nil, fmt.Errorf("failed to create slack session")
	}

	// Try to load existing cookies
	if err := session.LoadCookies(config.ConfigDir); err != nil {
		// If loading fails, we'll need to authenticate again, but that's not a fatal error
		// Just log it and continue
		fmt.Printf("\n⚠️  Aviso: %v\n", err)
	}

	return session, nil
}
