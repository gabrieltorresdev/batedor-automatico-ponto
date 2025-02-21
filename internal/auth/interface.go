package auth

import (
	"context"
	"fmt"
)

// Module defines the interface for authentication operations
type Module interface {
	// GetContext returns the browser context
	GetContext() context.Context

	// Login performs the authentication process
	Login(creds Credentials) error

	// Close releases resources used by the module
	Close()
}

// Config holds the configuration for the Auth module
type Config struct {
	// Headless determina se o navegador será executado em modo headless
	Headless bool

	// UseMock determina se será usado o mock ao invés do browser real
	UseMock bool

	// Context é o contexto a ser usado para a sessão
	Context context.Context
}

// NewModule creates a new instance of the Auth module
func NewModule(config Config) (Module, error) {
	if config.UseMock {
		return NewMockSession(), nil
	}

	session := NewAuthSession(config.Headless, config.Context)
	if session == nil {
		return nil, fmt.Errorf("failed to create auth session")
	}
	return session, nil
}
