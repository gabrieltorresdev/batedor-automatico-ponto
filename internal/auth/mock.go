package auth

import (
	"context"
	"fmt"
	"time"
)

// MockSession implements the Module interface for testing and development
type MockSession struct {
	ctx    context.Context
	cancel context.CancelFunc
}

// NewMockSession creates a new mock authentication session
func NewMockSession() Module {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	return &MockSession{
		ctx:    ctx,
		cancel: cancel,
	}
}

// GetContext returns the mock context
func (m *MockSession) GetContext() context.Context {
	return m.ctx
}

// Login simulates the authentication process
func (m *MockSession) Login(creds Credentials) error {
	if err := creds.validate(); err != nil {
		return err
	}

	// Simula credenciais inválidas para um usuário específico
	if creds.Username == "invalid" {
		return ErrInvalidCredentials
	}

	// Simula um delay para parecer mais realista
	time.Sleep(1 * time.Second)

	// Simula erro de timeout aleatoriamente (10% de chance)
	if time.Now().UnixNano()%10 == 0 {
		return &LoginError{
			Type:    "timeout",
			Message: "timeout: falha ao carregar página de login",
			Cause:   context.DeadlineExceeded,
		}
	}

	fmt.Printf("\n🔐 Mock: Login bem sucedido para usuário %s\n", creds.Username)
	return nil
}

// Close releases mock resources
func (m *MockSession) Close() {
	if m.cancel != nil {
		m.cancel()
	}
}
