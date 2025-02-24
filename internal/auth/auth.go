package auth

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/chromedp/chromedp"
)

type LoginError struct {
	Type    string
	Message string
	Cause   error
}

func (e *LoginError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Cause)
	}
	return e.Message
}

var (
	ErrEmptyCredentials   = &LoginError{Type: "validation", Message: "usuário e senha são obrigatórios"}
	ErrInvalidCredentials = &LoginError{Type: "auth", Message: "credenciais inválidas"}
	ErrUserBlocked        = &LoginError{Type: "blocked", Message: "usuário temporariamente bloqueado"}
)

const (
	baseURL             = "https://oliveiratrust.softtrade.com.br"
	defaultTimeout      = 15 * time.Minute
	browserWindowWidth  = 200
	browserWindowHeight = 200
)

type loginStep struct {
	actions []chromedp.Action
	errMsg  string
}

type Credentials struct {
	Username string
	Password string
}

func (c Credentials) validate() error {
	if c.Username == "" || c.Password == "" {
		return ErrEmptyCredentials
	}
	return nil
}

type BrowserSession interface {
	GetContext() context.Context
	Close()
	Login(creds Credentials) error
}

type AuthSession struct {
	ctx    context.Context
	cancel context.CancelFunc
}

// NewAuthSession creates a new authentication session
func NewAuthSession(headless bool, ctx context.Context) BrowserSession {
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, defaultTimeout)

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", headless),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-setuid-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-first-run", true),
		chromedp.Flag("no-default-browser-check", true),
		chromedp.Flag("ignore-certificate-errors", true),
		chromedp.Flag("disable-extensions", true),
		chromedp.WindowSize(browserWindowWidth, browserWindowHeight),
		chromedp.UserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
	)

	allocCtx, _ := chromedp.NewExecAllocator(ctx, opts...)
	browserCtx, _ := chromedp.NewContext(allocCtx,
		chromedp.WithLogf(log.Printf),
	)

	return &AuthSession{
		ctx:    browserCtx,
		cancel: cancel,
	}
}

func (a *AuthSession) GetContext() context.Context {
	return a.ctx
}

func (a *AuthSession) Login(creds Credentials) error {
	if err := creds.validate(); err != nil {
		return err
	}

	// Primeiro passo: Navegar e aguardar a página carregar completamente
	if err := a.executeLoginStep(loginStep{
		actions: []chromedp.Action{
			chromedp.Navigate(baseURL),
			chromedp.WaitReady("body"),
			chromedp.WaitVisible(`input[id="username"]`, chromedp.ByQuery),
		},
		errMsg: "falha ao carregar página de login",
	}); err != nil {
		return err
	}

	// Segundo passo: Preencher e submeter o formulário
	if err := a.executeLoginStep(loginStep{
		actions: []chromedp.Action{
			chromedp.Focus(`input[id="username"]`),
			chromedp.SendKeys(`input[id="username"]`, creds.Username),
			chromedp.Focus(`input[id="password"]`),
			chromedp.SendKeys(`input[id="password"]`, creds.Password),
			chromedp.WaitVisible(`button[id="verifqUsu"]`),
			chromedp.Click(`button[id="verifqUsu"]`),
		},
		errMsg: "falha no processo de login",
	}); err != nil {
		return err
	}

	// Aguarda um pouco para a página processar o login
	// if err := chromedp.Run(a.ctx, chromedp.Sleep(2*time.Second)); err != nil {
	// 	return err
	// }

	// Terceiro passo: Verificar se há mensagem de erro
	hasInvalidCredentials, err := a.checkForLoginErrors()
	if err != nil {
		return err
	}
	if hasInvalidCredentials {
		return ErrInvalidCredentials
	}

	// Quarto passo: Aguardar carregamento da página principal
	if err := a.executeLoginStep(loginStep{
		actions: []chromedp.Action{
			chromedp.WaitReady("body"),
			chromedp.WaitVisible(`//button[contains(., 'Entrada') or contains(., 'Saída') or contains(., 'refeição')]`, chromedp.BySearch),
		},
		errMsg: "falha ao carregar a página após login",
	}); err != nil {
		// Verifica novamente se houve erro de credenciais
		hasInvalidCredentials, checkErr := a.checkForLoginErrors()
		if checkErr == nil && hasInvalidCredentials {
			return ErrInvalidCredentials
		}
		return err
	}

	return nil
}

func (a *AuthSession) executeLoginStep(step loginStep) error {
	err := chromedp.Run(a.ctx, step.actions...)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return &LoginError{
				Type:    "timeout",
				Message: fmt.Sprintf("timeout: %s", step.errMsg),
				Cause:   err,
			}
		}
		return &LoginError{
			Type:    "execution",
			Message: step.errMsg,
			Cause:   err,
		}
	}
	return nil
}

func (a *AuthSession) checkForLoginErrors() (bool, error) {
	// Aguarda um pouco para a página recarregar e o alerta aparecer
	var err error

	var mensagemErro string
	err = chromedp.Run(a.ctx,
		chromedp.Evaluate(`
			(function() {
				// Verifica mensagens de erro em diferentes elementos possíveis
				const seletores = [
					'.ui-messages-error-detail',
					'.ui-messages-error span',
					'.ui-messages span',
					'.ui-message-error-detail',
					'.ui-message-error span'
				];

				for (const seletor of seletores) {
					const elemento = document.querySelector(seletor);
					if (elemento) {
						const texto = elemento.textContent.trim();
						if (texto) return texto;
					}
				}

				// Verifica alertas do navegador
				const alerts = document.querySelectorAll('[role="alert"]');
				for (const alert of alerts) {
					const texto = alert.textContent.trim();
					if (texto) return texto;
				}

				return '';
			})()
		`, &mensagemErro),
	)
	if err != nil {
		return false, &LoginError{
			Type:    "validation",
			Message: "falha ao verificar erros de login",
			Cause:   err,
		}
	}

	mensagemErroLower := strings.ToLower(mensagemErro)

	// Verifica várias possíveis mensagens de erro de credenciais
	mensagensErro := []string{
		"acesso negado",
		"credenciais inválidas",
		"usuário ou senha incorretos",
		"login inválido",
	}

	for _, erro := range mensagensErro {
		if strings.Contains(mensagemErroLower, erro) {
			return true, &LoginError{
				Type:    "auth",
				Message: "credenciais inválidas",
			}
		}
	}

	if strings.Contains(mensagemErroLower, "bloqueado") ||
		strings.Contains(mensagemErroLower, "intervalo") ||
		strings.Contains(mensagemErroLower, "horário permitido") {
		return false, ErrUserBlocked
	}

	// Se encontrou alguma mensagem de erro mas não é uma das conhecidas, loga para debug
	if mensagemErro != "" {
		log.Printf("Mensagem de erro encontrada: %s", mensagemErro)
	}

	return false, nil
}

func (a *AuthSession) Close() {
	if a.cancel != nil {
		a.cancel()
	}
}
