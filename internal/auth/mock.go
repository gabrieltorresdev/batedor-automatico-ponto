package auth

import (
	"context"
	"fmt"
	"time"
)

type MockSession struct {
	ctx    context.Context
	cancel context.CancelFunc
}

func NewMockSession() Module {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	return &MockSession{
		ctx:    ctx,
		cancel: cancel,
	}
}

func (m *MockSession) GetContext() context.Context {
	return m.ctx
}

func (m *MockSession) Login(creds Credentials) error {
	if err := creds.validate(); err != nil {
		return err
	}

	if creds.Username == "invalid" {
		return ErrInvalidCredentials
	}

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

func (m *MockSession) Close() {
	if m.cancel != nil {
		m.cancel()
	}
}
