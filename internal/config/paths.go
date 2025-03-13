package config

import (
	"fmt"
	"os"
	"path/filepath"
)

const (
	ConfigDirName = ".batedorponto"

	EnvFileName = ".env"

	CookiesFileName = "slackcookies.json"

	PunchRecordsFileName = "marcacoes"
)

func GetConfigDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("erro ao obter diretório home: %w", err)
	}

	configDir := filepath.Join(homeDir, ConfigDirName)
	return configDir, nil
}

func EnsureConfigDir() (string, error) {
	configDir, err := GetConfigDir()
	if err != nil {
		return "", err
	}

	if err := os.MkdirAll(configDir, 0700); err != nil {
		return "", fmt.Errorf("erro ao criar diretório de configuração: %w", err)
	}

	return configDir, nil
}

func GetEnvFilePath() (string, error) {
	configDir, err := GetConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(configDir, EnvFileName), nil
}

func GetCookiesFilePath() (string, error) {
	configDir, err := GetConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(configDir, CookiesFileName), nil
}

func GetPunchRecordsFilePath() (string, error) {
	configDir, err := GetConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(configDir, PunchRecordsFileName), nil
}
