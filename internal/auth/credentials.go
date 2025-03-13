package auth

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/gabrieltorresdev/batedor-automatico-ponto/internal/config"
	"github.com/joho/godotenv"
	"github.com/manifoldco/promptui"
)

const (
	configDirName = ".batedorponto"
	envFileName   = ".env"
)

var ErrCredenciaisNaoEncontradas = fmt.Errorf("credenciais não encontradas")

func CarregarCredenciais() (Credentials, error) {
	configDir, err := config.EnsureConfigDir()
	if err != nil {
		return Credentials{}, err
	}

	envFile := filepath.Join(configDir, config.EnvFileName)
	if err := godotenv.Load(envFile); err == nil {
		username := os.Getenv("USERNAME_PONTO")
		password := os.Getenv("PASSWORD_PONTO")

		if username != "" && password != "" {
			return Credentials{
				Username: username,
				Password: password,
			}, nil
		}
	}

	return Credentials{}, ErrCredenciaisNaoEncontradas
}

func SolicitarCredenciais() (Credentials, error) {
	fmt.Println("\nPor favor, insira suas credenciais:")

	usernamePrompt := promptui.Prompt{
		Label: "Usuário",
		Validate: func(input string) error {
			if len(input) < 3 {
				return fmt.Errorf("usuário deve ter pelo menos 3 caracteres")
			}
			return nil
		},
	}

	username, err := usernamePrompt.Run()
	if err != nil {
		return Credentials{}, fmt.Errorf("erro ao ler usuário: %w", err)
	}

	passwordPrompt := promptui.Prompt{
		Label: "Senha",
		Mask:  '*',
		Validate: func(input string) error {
			if len(input) < 4 {
				return fmt.Errorf("senha deve ter pelo menos 4 caracteres")
			}
			return nil
		},
	}

	password, err := passwordPrompt.Run()
	if err != nil {
		return Credentials{}, fmt.Errorf("erro ao ler senha: %w", err)
	}

	creds := Credentials{
		Username: username,
		Password: password,
	}
	if err := creds.validate(); err != nil {
		return Credentials{}, err
	}

	return creds, nil
}

func SalvarCredenciais(creds Credentials) error {
	configDir, err := config.EnsureConfigDir()
	if err != nil {
		return err
	}

	envContent := fmt.Sprintf("USERNAME_PONTO=%s\nPASSWORD_PONTO=%s\n", creds.Username, creds.Password)
	envFile := filepath.Join(configDir, config.EnvFileName)
	if err := os.WriteFile(envFile, []byte(envContent), 0600); err != nil {
		return fmt.Errorf("erro ao salvar credenciais: %w", err)
	}

	return nil
}

func ConfirmarSalvamentoCredenciais(creds Credentials) (bool, error) {
	confirmPrompt := promptui.Prompt{
		Label:     "Deseja salvar as credenciais? (Recomendado)",
		IsConfirm: true,
		Default:   "n",
	}

	resultado, err := confirmPrompt.Run()
	if err != nil {
		if err == promptui.ErrAbort {
			fmt.Println("\nCredenciais não serão salvas. Você precisará inseri-las novamente na próxima execução.")
			return false, nil
		}
		return false, fmt.Errorf("erro na confirmação: %w", err)
	}

	return resultado == "y" || resultado == "Y", nil
}
