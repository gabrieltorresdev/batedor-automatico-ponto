package auth

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
	"github.com/manifoldco/promptui"
)

const (
	configDirName = ".batedorponto"
	envFileName   = ".env"
)

// CarregarCredenciais loads credentials from environment or prompts the user
func CarregarCredenciais() (Credentials, error) {
	configDir := filepath.Join(os.Getenv("HOME"), configDirName)
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return Credentials{}, fmt.Errorf("erro ao criar diretório de configuração: %w", err)
	}

	envFile := filepath.Join(configDir, envFileName)
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

	fmt.Println("\nPor favor, insira suas credenciais:")

	// Prompt para usuário
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

	// Prompt para senha
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

	// Valida credenciais
	creds := Credentials{
		Username: username,
		Password: password,
	}
	if err := creds.validate(); err != nil {
		return Credentials{}, err
	}

	// Pergunta se deseja salvar
	confirmPrompt := promptui.Prompt{
		Label:     "Deseja salvar as credenciais? (Recomendado)",
		IsConfirm: true,
		Default:   "n",
	}

	resultado, err := confirmPrompt.Run()
	if err == nil && (resultado == "y" || resultado == "Y") {
		envContent := fmt.Sprintf("USERNAME_PONTO=%s\nPASSWORD_PONTO=%s\n", username, password)
		if err := os.WriteFile(envFile, []byte(envContent), 0600); err != nil {
			fmt.Printf("\n⚠️  Aviso: não foi possível salvar as credenciais: %v\n", err)
		} else {
			fmt.Println("\nCredenciais salvas com sucesso")
		}
	} else {
		fmt.Println("\nCredenciais não serão salvas. Você precisará inseri-las novamente na próxima execução.")
	}

	return creds, nil
}
