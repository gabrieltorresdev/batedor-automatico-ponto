package auth

import (
	"context"
	"fmt"
)

type Module interface {
	GetContext() context.Context
	Login(creds Credentials) error
	Close()
}

type Config struct {
	Headless bool
	UseMock  bool
	Context  context.Context
}

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
