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
	slackDMURL       = "https://app.slack.com/client/TSAD5P1GB/C010LNL7KS9"
	slackRedirectURL = "https://fintools-ot.slack.com/ssb/redirect"

	tempoLimiteOperacao = 30 * time.Second
	tempoLimiteAuth     = 2 * time.Minute
	maxTentativas       = 3
	atrasoTentativa     = time.Second
	arquivoCookies      = "slack_cookies.json"
	diretorioConfig     = ".batedorponto"
)

type Navegador interface {
	Navegar(url string) error
	ObterLocalizacao() (string, error)
	AguardarElemento(seletor string) error
	Clicar(seletor string) error
	EnviarTeclas(seletor, texto string) error
	PressionarEnter() error
	ObterCookies() ([]*network.Cookie, error)
	DefinirCookies([]*network.Cookie) error
}

type SessaoSlack struct {
	ctx       context.Context
	cancelar  context.CancelFunc
	navegador Navegador
}

type NavegadorChrome struct {
	ctx context.Context
}

func (b *NavegadorChrome) Navegar(url string) error {
	return chromedp.Run(b.ctx, chromedp.Navigate(url))
}

func (b *NavegadorChrome) ObterLocalizacao() (string, error) {
	var url string
	err := chromedp.Run(b.ctx, chromedp.Location(&url))
	return url, err
}

func (b *NavegadorChrome) AguardarElemento(seletor string) error {
	return chromedp.Run(b.ctx, chromedp.WaitVisible(seletor))
}

func (b *NavegadorChrome) Clicar(seletor string) error {
	return chromedp.Run(b.ctx, chromedp.Click(seletor))
}

func (b *NavegadorChrome) EnviarTeclas(seletor, texto string) error {
	return chromedp.Run(b.ctx, chromedp.SendKeys(seletor, texto))
}

func (b *NavegadorChrome) PressionarEnter() error {
	return chromedp.Run(b.ctx, chromedp.KeyEvent("\r"))
}

func (b *NavegadorChrome) ObterCookies() ([]*network.Cookie, error) {
	var cookies []*network.Cookie
	err := chromedp.Run(b.ctx, chromedp.ActionFunc(func(ctx context.Context) error {
		var err error
		cookies, err = network.GetCookies().Do(ctx)
		return err
	}))
	return cookies, err
}

func (b *NavegadorChrome) DefinirCookies(cookies []*network.Cookie) error {
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

func obterOpcoesNavegador(modoSilencioso bool) []chromedp.ExecAllocatorOption {
	return append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", modoSilencioso),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("disable-extensions", true),
		chromedp.Flag("disable-setuid-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.WindowSize(1280, 720),
		chromedp.UserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0"),
	)
}

func criarContextoNavegador(modoSilencioso bool) (context.Context, context.CancelFunc, error) {
	opts := obterOpcoesNavegador(modoSilencioso)
	allocCtx, _ := chromedp.NewExecAllocator(context.Background(), opts...)
	ctx, cancelar := chromedp.NewContext(allocCtx)

	// Aguarda o navegador iniciar
	if err := chromedp.Run(ctx); err != nil {
		cancelar()
		return nil, nil, fmt.Errorf("erro ao iniciar navegador: %w", err)
	}

	return ctx, cancelar, nil
}

// NovaSessaoSlack cria uma nova sessão do Slack com o modo de navegador especificado
func NovaSessaoSlack(ctxPai context.Context, modoSilencioso bool) *SessaoSlack {
	ctx, cancelar, err := criarContextoNavegador(modoSilencioso)
	if err != nil {
		fmt.Printf("\n⚠️  Erro ao criar sessão: %v\n", err)
		return nil
	}

	navegador := &NavegadorChrome{ctx: ctx}
	return &SessaoSlack{
		ctx:       ctx,
		cancelar:  cancelar,
		navegador: navegador,
	}
}

func (s *SessaoSlack) Close() {
	if s.cancelar != nil {
		s.cancelar()
		s.cancelar = nil
	}
}

func (s *SessaoSlack) comTempoLimite(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(s.ctx, d)
}

func (s *SessaoSlack) tentarNovamente(fn func() error) error {
	var err error
	for i := 0; i < maxTentativas; i++ {
		if err = fn(); err == nil {
			return nil
		}
		time.Sleep(atrasoTentativa * time.Duration(i+1))
	}
	return fmt.Errorf("falha após %d tentativas: %v", maxTentativas, err)
}

func obterCaminhoCookies(diretorio string) string {
	return filepath.Join(diretorio, arquivoCookies)
}

func (s *SessaoSlack) SalvarCookies(diretorio string) error {
	cookies, err := s.navegador.ObterCookies()
	if err != nil {
		return fmt.Errorf("erro ao obter cookies: %w", err)
	}

	if len(cookies) == 0 {
		return fmt.Errorf("nenhum cookie encontrado")
	}

	caminho := obterCaminhoCookies(diretorio)
	dados, err := json.Marshal(cookies)
	if err != nil {
		return fmt.Errorf("erro ao serializar cookies: %w", err)
	}

	if err := os.WriteFile(caminho, dados, 0600); err != nil {
		return fmt.Errorf("erro ao salvar cookies: %w", err)
	}

	return nil
}

func (s *SessaoSlack) CarregarCookies(diretorio string) error {
	dados, err := os.ReadFile(obterCaminhoCookies(diretorio))
	if err != nil {
		return fmt.Errorf("erro ao ler cookies: %w", err)
	}

	var cookies []*network.Cookie
	if err := json.Unmarshal(dados, &cookies); err != nil {
		return fmt.Errorf("erro ao deserializar cookies: %w", err)
	}

	if len(cookies) == 0 {
		return fmt.Errorf("arquivo de cookies vazio")
	}

	if err := s.navegador.DefinirCookies(cookies); err != nil {
		return fmt.Errorf("erro ao restaurar cookies: %w", err)
	}

	return nil
}

func (s *SessaoSlack) obterURLAtual(ctx context.Context) (string, error) {
	var url string
	if err := chromedp.Run(ctx, chromedp.Location(&url)); err != nil {
		return "", fmt.Errorf("erro ao obter URL: %w", err)
	}
	return url, nil
}

func (s *SessaoSlack) eSessaoValida(ctx context.Context) bool {
	url, err := s.obterURLAtual(ctx)
	if err != nil {
		return false
	}
	return strings.Contains(url, "app.slack.com/client/")
}

func (s *SessaoSlack) validarSessaoSomente() error {
	ctx, cancelar := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancelar()

	// Primeiro verifica se já estamos em uma página válida do Slack
	if s.eSessaoValida(ctx) {
		return nil
	}

	// Se não estiver, tenta navegar para a URL base
	if err := chromedp.Run(ctx, chromedp.Navigate(slackBaseURL)); err != nil {
		return fmt.Errorf("erro ao navegar: %w", err)
	}

	if !s.eSessaoValida(ctx) {
		return fmt.Errorf("sessão expirada")
	}

	return nil
}

func (s *SessaoSlack) navegarParaDM() error {
	ctx, cancelar := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancelar()

	// Verifica se já estamos na DM
	url, err := s.obterURLAtual(ctx)
	if err == nil && url == slackDMURL {
		return nil
	}

	return s.tentarNovamente(func() error {
		if err := chromedp.Run(ctx, chromedp.Navigate(slackDMURL)); err != nil {
			return fmt.Errorf("erro ao navegar para DM: %w", err)
		}
		return nil
	})
}

func (s *SessaoSlack) Autenticar() error {
	ctx, cancelar := s.comTempoLimite(tempoLimiteAuth)
	defer cancelar()

	if err := chromedp.Run(ctx, chromedp.Navigate(slackBaseURL)); err != nil {
		return fmt.Errorf("erro ao abrir Slack: %w", err)
	}

	fmt.Println("\n🔐 Por favor, faça login no Slack.")
	fmt.Println("O programa continuará após o login...")

	if err := s.aguardarLogin(ctx); err != nil {
		return fmt.Errorf("erro no login: %w", err)
	}

	// Aguarda um pouco após o login para garantir que os cookies foram salvos
	time.Sleep(2 * time.Second)

	return nil
}

func (s *SessaoSlack) aguardarLogin(ctx context.Context) error {
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

func (s *SessaoSlack) ValidarSessao() error {
	// Primeiro valida a sessão
	if err := s.validarSessaoSomente(); err != nil {
		return err
	}

	// Se a sessão estiver válida, navega para DM
	return s.navegarParaDM()
}

func (s *SessaoSlack) EnviarMensagem(msg string) error {
	if msg == "" {
		return fmt.Errorf("mensagem vazia")
	}

	ctx, cancelar := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancelar()

	// Verifica se a sessão está válida sem navegar
	if !s.eSessaoValida(ctx) {
		if err := s.Autenticar(); err != nil {
			return fmt.Errorf("erro na autenticação: %w", err)
		}
	}

	// Navega para DM apenas se necessário
	if err := s.navegarParaDM(); err != nil {
		return fmt.Errorf("erro ao navegar para DM: %w", err)
	}

	return s.tentarNovamente(func() error {
		campoMensagem := `div[data-qa="message_input"] > div[contenteditable="true"]`
		if err := chromedp.Run(ctx,
			chromedp.WaitVisible(campoMensagem),
			chromedp.Click(campoMensagem),
			chromedp.SendKeys(campoMensagem, msg),
			chromedp.KeyEvent("\r"),
		); err != nil {
			return fmt.Errorf("erro ao enviar mensagem: %w", err)
		}

		return nil
	})
}

// DefinirStatus define o status do usuário no Slack
func (s *SessaoSlack) DefinirStatus(status Status) error {
	ctx, cancelar := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancelar()

	// Primeiro valida a sessão
	if err := s.validarSessaoSomente(); err != nil {
		return fmt.Errorf("erro ao validar sessão: %w", err)
	}

	// Abre o menu de status
	if err := chromedp.Run(ctx,
		chromedp.Click(`button[data-qa="user-button"]`),
		chromedp.WaitVisible(`button[data-qa="main-menu-custom-status-item"]`),
		chromedp.Click(`button[data-qa="main-menu-custom-status-item"]`),
		chromedp.WaitVisible(`div.p-custom_status_modal`),
	); err != nil {
		return fmt.Errorf("erro ao abrir menu de status: %w", err)
	}

	// Aguarda o modal carregar e limpa o status atual
	if err := chromedp.Run(ctx,
		chromedp.Evaluate(`
			(() => {
				const clearButton = document.querySelector('.p_custom_status_modal__input_clear_button');
				if (clearButton) clearButton.click();
				return true;
			})()
		`, nil),
	); err != nil {
		fmt.Printf("\n⚠️  Aviso: não foi possível limpar status atual: %v\n", err)
	}

	// Tenta encontrar e clicar no status pré-configurado
	var statusDefinido bool
	err := chromedp.Run(ctx,
		chromedp.Evaluate(`
			(() => {
				const sections = document.querySelectorAll('.p-custom_status_modal__presets');
				for (const section of sections) {
					const containers = section.querySelectorAll('.p-custom_status_modal__preset_container');
					for (const container of containers) {
						const button = container.querySelector('button.p-custom_status_modal__preset');
						if (!button) continue;

						const statusText = button.querySelector('[data-qa="custom_status_text"]');
						if (!statusText) continue;

						if (statusText.textContent.trim() === '`+status.Mensagem+`') {
							button.click();
							return true;
						}
					}
				}
				return false;
			})()
		`, &statusDefinido))

	if err != nil {
		return fmt.Errorf("erro ao selecionar status: %w", err)
	}

	// Aguarda o status ser selecionado e clica no botão de salvar
	err = chromedp.Run(ctx,
		chromedp.WaitVisible(`button[data-qa="custom_status_input_go"]`),
		chromedp.Click(`button[data-qa="custom_status_input_go"]`),
	)

	if err != nil {
		return fmt.Errorf("erro ao salvar status: %w", err)
	}

	// Aguarda o modal fechar e verifica se o status foi alterado
	err = chromedp.Run(ctx,
		chromedp.Sleep(1*time.Second), // Dá um tempo para o modal fechar
		chromedp.WaitNotPresent(`div.p-custom_status_modal`),
	)

	if err != nil {
		return fmt.Errorf("erro ao confirmar salvamento do status: %w", err)
	}

	// Verifica se o status foi realmente alterado
	statusAtual, err := s.ObterStatusAtual()
	if err != nil {
		return fmt.Errorf("erro ao verificar status após alteração: %w", err)
	}

	if statusAtual == nil || statusAtual.Mensagem != status.Mensagem {
		return fmt.Errorf("status não foi alterado corretamente")
	}

	return nil
}

// LimparStatus limpa o status do usuário no Slack
func (s *SessaoSlack) LimparStatus() error {
	ctx, cancelar := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancelar()

	// Primeiro valida a sessão
	if err := s.validarSessaoSomente(); err != nil {
		return fmt.Errorf("erro ao validar sessão: %w", err)
	}

	// Abre o menu de status
	if err := chromedp.Run(ctx,
		chromedp.Click(`button[data-qa="user-button"]`),
		chromedp.WaitVisible(`button[data-qa="main-menu-custom-status-item"]`),
		chromedp.Click(`button[data-qa="main-menu-custom-status-item"]`),
		chromedp.WaitVisible(`div.p-custom_status_modal`),
	); err != nil {
		return fmt.Errorf("erro ao abrir menu de status: %w", err)
	}

	// Limpa o status atual
	if err := chromedp.Run(ctx,
		chromedp.Evaluate(`
			(() => {
				const clearButton = document.querySelector('.p_custom_status_modal__input_clear_button');
				if (clearButton) {
					clearButton.click();
					return true;
				}
				return false;
			})()
		`, nil),
	); err != nil {
		return fmt.Errorf("erro ao limpar status: %w", err)
	}

	// Aguarda e clica no botão de salvar
	err := chromedp.Run(ctx,
		chromedp.WaitVisible(`button[data-qa="custom_status_input_go"]`),
		chromedp.Click(`button[data-qa="custom_status_input_go"]`),
	)

	if err != nil {
		return fmt.Errorf("erro ao salvar status: %w", err)
	}

	// Aguarda o modal fechar e verifica se o status foi alterado
	err = chromedp.Run(ctx,
		chromedp.Sleep(1*time.Second), // Dá um tempo para o modal fechar
		chromedp.WaitNotPresent(`div.p-custom_status_modal`),
	)

	if err != nil {
		return fmt.Errorf("erro ao confirmar limpeza do status: %w", err)
	}

	// Verifica se o status foi realmente limpo
	statusAtual, err := s.ObterStatusAtual()
	if err != nil {
		return fmt.Errorf("erro ao verificar status após limpeza: %w", err)
	}

	if statusAtual != nil {
		return fmt.Errorf("status não foi limpo corretamente")
	}

	return nil
}

// ObterStatusAtual obtém o status atual do usuário no Slack
func (s *SessaoSlack) ObterStatusAtual() (*Status, error) {
	ctx, cancelar := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancelar()

	// Primeiro valida a sessão
	if err := s.validarSessaoSomente(); err != nil {
		return nil, fmt.Errorf("erro ao validar sessão: %w", err)
	}

	var status *Status
	err := s.tentarNovamente(func() error {
		// Abre o menu de status
		if err := chromedp.Run(ctx,
			chromedp.Click(`button[data-qa="user-button"]`),
			chromedp.WaitVisible(`button[data-qa="main-menu-custom-status-item"]`),
			chromedp.Click(`button[data-qa="main-menu-custom-status-item"]`),
			chromedp.WaitVisible(`div.p-custom_status_modal`),
		); err != nil {
			return fmt.Errorf("erro ao abrir menu de status: %w", err)
		}

		// Obtém o status atual
		type resultadoStatus struct {
			TemStatus bool   `json:"hasStatus"`
			Emoji     string `json:"emoji"`
			Mensagem  string `json:"message"`
		}
		var resultado resultadoStatus

		err := chromedp.Run(ctx, chromedp.Evaluate(`
			(() => {
				// Função para extrair texto limpo
				function extractCleanText(element) {
					if (!element) return '';
					// Remove espaços extras e quebras de linha
					return element.textContent.replace(/\s+/g, ' ').trim();
				}

				// Busca o texto do status
				const statusInput = document.querySelector('div[data-qa="custom_status_input_body"]');
				const statusText = statusInput ? statusInput.querySelector('.ql-editor p') : null;
				const message = extractCleanText(statusText);

				// Busca o emoji
				const emojiImg = document.querySelector('.p_custom_status_modal__input_emoji_picker img.c-emoji');
				if (!emojiImg || !message) {
					return { hasStatus: false };
				}

				// Extrai o código do emoji
				const emojiAlt = emojiImg.alt || '';
				const emoji = emojiAlt.replace(/:/g, '');

				return {
					hasStatus: true,
					emoji: ':' + emoji + ':',
					message: message
				};
			})()
		`, &resultado))

		if err != nil {
			return fmt.Errorf("erro ao obter status: %w", err)
		}

		// Fecha o modal
		if err := chromedp.Run(ctx,
			chromedp.Click(`button[data-qa="sk_close_modal_button"]`),
		); err != nil {
			return fmt.Errorf("erro ao fechar modal: %w", err)
		}

		if resultado.TemStatus {
			status = &Status{
				Emoji:    resultado.Emoji,
				Mensagem: resultado.Mensagem,
			}
		}

		return nil
	})

	return status, err
}
