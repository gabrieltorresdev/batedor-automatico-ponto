package slack

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"
)

const (
	slackBaseURL     = "https://fintools-ot.slack.com"
	slackDMURL       = "https://app.slack.com/client/TSAD5P1GB/D045LMRNAJC"
	slackRedirectURL = "https://fintools-ot.slack.com/ssb/redirect"

	slackOperationTimeout = 30 * time.Second
	slackAuthTimeout      = 2 * time.Minute
	maxRetries            = 3
	retryDelay            = time.Second
	cookiesFile           = "slack_cookies.json"
	configDir             = ".batedorponto"
)

type Browser interface {
	Navigate(url string) error
	GetLocation() (string, error)
	WaitForElement(selector string) error
	Click(selector string) error
	SendKeys(selector, text string) error
	PressEnter() error
	GetCookies() ([]*network.Cookie, error)
	SetCookies([]*network.Cookie) error
}

type SlackSession struct {
	ctx     context.Context
	cancel  context.CancelFunc
	browser Browser
}

type ChromeBrowser struct {
	ctx context.Context
}

func (b *ChromeBrowser) Navigate(url string) error {
	return chromedp.Run(b.ctx, chromedp.Navigate(url))
}

func (b *ChromeBrowser) GetLocation() (string, error) {
	var url string
	err := chromedp.Run(b.ctx, chromedp.Location(&url))
	return url, err
}

func (b *ChromeBrowser) WaitForElement(selector string) error {
	return chromedp.Run(b.ctx, chromedp.WaitVisible(selector))
}

func (b *ChromeBrowser) Click(selector string) error {
	return chromedp.Run(b.ctx, chromedp.Click(selector))
}

func (b *ChromeBrowser) SendKeys(selector, text string) error {
	return chromedp.Run(b.ctx, chromedp.SendKeys(selector, text))
}

func (b *ChromeBrowser) PressEnter() error {
	return chromedp.Run(b.ctx, chromedp.KeyEvent("\r"))
}

func (b *ChromeBrowser) GetCookies() ([]*network.Cookie, error) {
	var cookies []*network.Cookie
	err := chromedp.Run(b.ctx, chromedp.ActionFunc(func(ctx context.Context) error {
		var err error
		cookies, err = network.GetCookies().Do(ctx)
		return err
	}))
	return cookies, err
}

func (b *ChromeBrowser) SetCookies(cookies []*network.Cookie) error {
	return chromedp.Run(b.ctx, chromedp.ActionFunc(func(ctx context.Context) error {
		for _, cookie := range cookies {
			err := network.SetCookie(cookie.Name, cookie.Value).
				WithPath(cookie.Path).
				WithDomain(cookie.Domain).
				Do(ctx)
			if err != nil {
				return err
			}
		}
		return nil
	}))
}

func getBrowserOptions(headless bool) []chromedp.ExecAllocatorOption {
	return append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", headless),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-gpu", false),
		chromedp.Flag("disable-extensions", true),
		chromedp.Flag("disable-setuid-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.WindowSize(1280, 720),
		chromedp.UserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0"),
	)
}

func createBrowserContext(headless bool) (context.Context, context.CancelFunc, error) {
	opts := getBrowserOptions(headless)
	allocCtx, _ := chromedp.NewExecAllocator(context.Background(), opts...)
	ctx, cancel := chromedp.NewContext(allocCtx)

	// Aguarda o navegador iniciar
	if err := chromedp.Run(ctx); err != nil {
		cancel()
		return nil, nil, fmt.Errorf("erro ao iniciar navegador: %w", err)
	}

	return ctx, cancel, nil
}

func NewSlackSession(parentCtx context.Context) *SlackSession {
	// Usa o contexto pai para criar o contexto do browser
	ctx, cancel, err := createBrowserContext(false)
	if err != nil {
		fmt.Printf("\n⚠️  Erro ao criar sessão: %v\n", err)
		return nil
	}

	// Cria um contexto derivado do pai para cancelamento apropriado
	browserCtx := context.WithoutCancel(ctx)

	browser := &ChromeBrowser{ctx: browserCtx}

	return &SlackSession{
		ctx:     browserCtx,
		cancel:  cancel,
		browser: browser,
	}
}

func (s *SlackSession) Close() {
	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
	}
}

func (s *SlackSession) withTimeout(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(s.ctx, d)
}

func (s *SlackSession) retry(fn func() error) error {
	var err error
	for i := 0; i < maxRetries; i++ {
		if err = fn(); err == nil {
			return nil
		}
		time.Sleep(retryDelay * time.Duration(i+1))
	}
	return fmt.Errorf("falha após %d tentativas: %v", maxRetries, err)
}

func getCookiesPath(dir string) string {
	return filepath.Join(dir, cookiesFile)
}

func (s *SlackSession) SaveCookies(dir string) error {
	return s.retry(func() error {
		cookies, err := s.browser.GetCookies()
		if err != nil {
			return fmt.Errorf("erro ao obter cookies: %w", err)
		}

		if len(cookies) == 0 {
			return fmt.Errorf("nenhum cookie encontrado")
		}

		path := getCookiesPath(dir)
		data, err := json.Marshal(cookies)
		if err != nil {
			return fmt.Errorf("erro ao serializar cookies: %w", err)
		}

		if err := os.WriteFile(path, data, 0600); err != nil {
			return fmt.Errorf("erro ao salvar cookies: %w", err)
		}

		return nil
	})
}

func (s *SlackSession) LoadCookies(dir string) error {
	return s.retry(func() error {
		data, err := os.ReadFile(getCookiesPath(dir))
		if err != nil {
			return fmt.Errorf("erro ao ler cookies: %w", err)
		}

		var cookies []*network.Cookie
		if err := json.Unmarshal(data, &cookies); err != nil {
			return fmt.Errorf("erro ao deserializar cookies: %w", err)
		}

		if len(cookies) == 0 {
			return fmt.Errorf("arquivo de cookies vazio")
		}

		if err := s.browser.SetCookies(cookies); err != nil {
			return fmt.Errorf("erro ao restaurar cookies: %w", err)
		}

		return nil
	})
}

func (s *SlackSession) getCurrentURL(ctx context.Context) (string, error) {
	var url string
	if err := chromedp.Run(ctx, chromedp.Location(&url)); err != nil {
		return "", fmt.Errorf("erro ao obter URL: %w", err)
	}
	return url, nil
}

func (s *SlackSession) isValidSession(ctx context.Context) bool {
	url, err := s.getCurrentURL(ctx)
	if err != nil {
		return false
	}
	return strings.Contains(url, "app.slack.com/client/")
}

func (s *SlackSession) validateSessionOnly() error {
	ctx, cancel := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancel()

	// Primeiro verifica se já estamos em uma página válida do Slack
	if s.isValidSession(ctx) {
		return nil
	}

	// Se não estiver, tenta navegar para a URL base e valida novamente
	if err := s.retry(func() error {
		if err := chromedp.Run(ctx, chromedp.Navigate(slackBaseURL)); err != nil {
			return fmt.Errorf("erro ao navegar: %w", err)
		}

		if !s.isValidSession(ctx) {
			return fmt.Errorf("sessão expirada")
		}

		return nil
	}); err != nil {
		// Se falhou, precisa autenticar
		return s.Authenticate()
	}

	return nil
}

func (s *SlackSession) navigateToDM() error {
	ctx, cancel := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancel()

	// Verifica se já estamos na DM
	url, err := s.getCurrentURL(ctx)
	if err == nil && url == slackDMURL {
		return nil
	}

	return s.retry(func() error {
		if err := chromedp.Run(ctx, chromedp.Navigate(slackDMURL)); err != nil {
			return fmt.Errorf("erro ao navegar para DM: %w", err)
		}
		return nil
	})
}

func (s *SlackSession) Authenticate() error {
	ctx, cancel := s.withTimeout(slackAuthTimeout)
	defer cancel()

	if err := chromedp.Run(ctx, chromedp.Navigate(slackBaseURL)); err != nil {
		return fmt.Errorf("erro ao abrir Slack: %w", err)
	}

	fmt.Println("\n🔐 Por favor, faça login no Slack.")
	fmt.Println("O programa continuará após o login...")

	if err := s.waitForLogin(ctx); err != nil {
		return fmt.Errorf("erro no login: %w", err)
	}

	return nil
}

func (s *SlackSession) waitForLogin(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			var url string
			if err := chromedp.Run(ctx, chromedp.Location(&url)); err != nil {
				return err
			}

			if strings.Contains(url, slackRedirectURL) {
				return nil
			}
			time.Sleep(500 * time.Millisecond)
		}
	}
}

func (s *SlackSession) ValidateSession() error {
	// Primeiro valida a sessão
	if err := s.validateSessionOnly(); err != nil {
		return err
	}

	// Se a sessão estiver válida, navega para DM
	return s.navigateToDM()
}

func (s *SlackSession) SendMessage(msg string) error {
	if msg == "" {
		return fmt.Errorf("mensagem vazia")
	}

	ctx, cancel := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancel()

	// Navega para DM apenas se necessário
	if err := s.navigateToDM(); err != nil {
		return fmt.Errorf("erro ao navegar para DM: %w", err)
	}

	return s.retry(func() error {
		messageInput := `div[data-qa="message_input"] > div[contenteditable="true"]`
		if err := chromedp.Run(ctx,
			chromedp.WaitVisible(messageInput),
			chromedp.Click(messageInput),
			chromedp.SendKeys(messageInput, msg),
			chromedp.KeyEvent("\r"),
		); err != nil {
			return fmt.Errorf("erro ao enviar mensagem: %w", err)
		}

		return nil
	})
}
