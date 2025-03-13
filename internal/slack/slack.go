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
	"github.com/chromedp/chromedp/kb"
)

const (
	slackBaseURL     = "https://fintools-ot.slack.com"
	slackDMURL       = "https://app.slack.com/client/TSAD5P1GB/C010LNL7KS9"
	slackRedirectURL = "https://fintools-ot.slack.com/ssb/redirect"

	tempoLimiteOperacao = 10 * time.Second
	tempoLimiteAuth     = 5 * time.Minute
	maxTentativas       = 1
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
	opcoes := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", modoSilencioso),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-setuid-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-first-run", true),
		chromedp.Flag("no-default-browser-check", true),
		chromedp.Flag("ignore-certificate-errors", true),
		chromedp.Flag("disable-extensions", true),
	)

	if modoSilencioso {
		opcoes = append(opcoes, chromedp.WindowSize(200, 200))
	} else {
		opcoes = append(opcoes, chromedp.WindowSize(1024, 768))
	}

	return opcoes
}

func criarContextoNavegador(modoSilencioso bool) (context.Context, context.CancelFunc, error) {
	opts := obterOpcoesNavegador(modoSilencioso)
	allocCtx, _ := chromedp.NewExecAllocator(context.Background(), opts...)
	ctx, cancelar := chromedp.NewContext(allocCtx)

	if err := chromedp.Run(ctx); err != nil {
		cancelar()
		return nil, nil, fmt.Errorf("erro ao iniciar navegador: %w", err)
	}

	return ctx, cancelar, nil
}

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

	if s.eSessaoValida(ctx) {
		return nil
	}

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
	fmt.Println("------------------------------------------------------------------------")
	fmt.Println("Iniciando processo de autenticação do Slack com navegador visível")
	fmt.Println("------------------------------------------------------------------------")

	ctx, cancelar := s.comTempoLimite(tempoLimiteAuth)
	defer cancelar()

	fmt.Println("Abrindo página inicial do Slack...")
	if err := chromedp.Run(ctx, chromedp.Navigate(slackBaseURL)); err != nil {
		fmt.Printf("ERRO AO NAVEGAR PARA %s: %v\n", slackBaseURL, err)
		return fmt.Errorf("erro ao abrir Slack: %w", err)
	}

	time.Sleep(1 * time.Second)

	var currentURL string
	if err := chromedp.Run(ctx, chromedp.Location(&currentURL)); err != nil {
		fmt.Printf("ERRO AO OBTER URL ATUAL: %v\n", err)
	} else {
		fmt.Printf("Página inicial carregada, URL atual: %s\n", currentURL)
	}

	fmt.Println("\n🔐 Por favor, faça login no Slack na janela aberta.")
	fmt.Println("O sistema detectará automaticamente quando o login for concluído...")

	if err := s.aguardarLogin(ctx); err != nil {
		fmt.Printf("ERRO DURANTE AGUARDO DE LOGIN: %v\n", err)
		return fmt.Errorf("erro no login: %w", err)
	}

	fmt.Println("✅ Login no Slack detectado com sucesso!")
	fmt.Println("Aguardando sincronização de dados...")
	time.Sleep(3 * time.Second)

	if err := chromedp.Run(ctx, chromedp.Location(&currentURL)); err != nil {
		fmt.Printf("ERRO AO OBTER URL PÓS-LOGIN: %v\n", err)
	} else {
		fmt.Printf("Login concluído, URL atual: %s\n", currentURL)
	}

	fmt.Println("------------------------------------------------------------------------")
	fmt.Println("Processo de autenticação concluído com sucesso")
	fmt.Println("------------------------------------------------------------------------")

	return nil
}

func (s *SessaoSlack) aguardarLogin(ctx context.Context) error {
	tempoInicio := time.Now()
	ultimaURL := ""

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout durante autenticação: %w", ctx.Err())
		default:
			var url string
			if err := chromedp.Run(ctx, chromedp.Location(&url)); err != nil {
				fmt.Printf("Erro ao obter URL durante aguardo: %v\n", err)
				time.Sleep(500 * time.Millisecond)
				continue
			}

			if url != ultimaURL {
				fmt.Printf("URL detectada durante autenticação: %s\n", url)
				ultimaURL = url
			}

			loginSucesso := false

			if strings.Contains(url, slackRedirectURL) ||
				strings.Contains(url, "app.slack.com/client") {
				fmt.Println("Login detectado via redirecionamento de URL")
				loginSucesso = true
			}

			var temElementos bool
			err := chromedp.Run(ctx, chromedp.Evaluate(`
				(() => {
					const userButton = document.querySelector('button[data-qa="user-button"]');
					const teamMenu = document.querySelector('button[data-qa="team-menu-button"]');
					const messageInput = document.querySelector('div[data-qa="message_input"]');
					
					return !!(userButton || teamMenu || messageInput);
				})()
			`, &temElementos))

			if err == nil && temElementos {
				fmt.Println("Login detectado via elementos da interface")
				loginSucesso = true
			}

			if loginSucesso {
				return nil
			}

			if tempo := time.Since(tempoInicio); tempo > 30*time.Second && tempo%(30*time.Second) < 1*time.Second {
				minutosRestantes := int((tempoLimiteAuth - tempo).Minutes())
				fmt.Printf("Aguardando login... (tempo restante: aproximadamente %d minutos)\n", minutosRestantes)
			}

			time.Sleep(500 * time.Millisecond)
		}
	}
}

func (s *SessaoSlack) ValidarSessao() error {
	if err := s.validarSessaoSomente(); err != nil {
		return err
	}

	return s.navegarParaDM()
}

func (s *SessaoSlack) EnviarMensagem(msg string) error {
	if msg == "" {
		return fmt.Errorf("mensagem vazia")
	}

	ctx, cancelar := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancelar()

	if !s.eSessaoValida(ctx) {
		if err := s.Autenticar(); err != nil {
			return fmt.Errorf("erro na autenticação: %w", err)
		}
	}

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

func (s *SessaoSlack) limparEstadoInicial(ctx context.Context) error {
	return chromedp.Run(ctx,
		chromedp.KeyEvent(kb.Escape),
	)
}

func (s *SessaoSlack) DefinirStatus(status Status) error {
	ctx, cancelar := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancelar()

	if err := s.validarSessaoSomente(); err != nil {
		return fmt.Errorf("erro ao validar sessão: %w", err)
	}

	if err := s.limparEstadoInicial(ctx); err != nil {
		return fmt.Errorf("erro ao limpar estado inicial: %w", err)
	}

	if err := chromedp.Run(ctx,
		chromedp.Click(`button[data-qa="user-button"]`),
		chromedp.WaitVisible(`button[data-qa="main-menu-custom-status-item"]`),
		chromedp.Click(`button[data-qa="main-menu-custom-status-item"]`),
		chromedp.WaitVisible(`div.p-custom_status_modal`),
	); err != nil {
		return fmt.Errorf("erro ao abrir menu de status: %w", err)
	}

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

	err = chromedp.Run(ctx,
		chromedp.WaitVisible(`button[data-qa="custom_status_input_go"]`),
		chromedp.Click(`button[data-qa="custom_status_input_go"]`),
	)

	if err != nil {
		return fmt.Errorf("erro ao salvar status: %w", err)
	}

	err = chromedp.Run(ctx,
		chromedp.Sleep(1*time.Second),
		chromedp.WaitNotPresent(`div.p-custom_status_modal`),
	)

	if err != nil {
		return fmt.Errorf("erro ao confirmar salvamento do status: %w", err)
	}

	statusAtual, err := s.ObterStatusAtual()
	if err != nil {
		return fmt.Errorf("erro ao verificar status após alteração: %w", err)
	}

	if statusAtual == nil || statusAtual.Mensagem != status.Mensagem {
		return fmt.Errorf("status não foi alterado corretamente")
	}

	return nil
}

func (s *SessaoSlack) LimparStatus() error {
	ctx, cancelar := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancelar()

	if err := s.validarSessaoSomente(); err != nil {
		return fmt.Errorf("erro ao validar sessão: %w", err)
	}

	if err := s.limparEstadoInicial(ctx); err != nil {
		return fmt.Errorf("erro ao limpar estado inicial: %w", err)
	}

	if err := chromedp.Run(ctx,
		chromedp.Click(`button[data-qa="user-button"]`),
		chromedp.WaitVisible(`button[data-qa="main-menu-custom-status-item"]`),
		chromedp.Click(`button[data-qa="main-menu-custom-status-item"]`),
		chromedp.WaitVisible(`div.p-custom_status_modal`),
	); err != nil {
		return fmt.Errorf("erro ao abrir menu de status: %w", err)
	}

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

	err := chromedp.Run(ctx,
		chromedp.WaitVisible(`button[data-qa="custom_status_input_go"]`),
		chromedp.Click(`button[data-qa="custom_status_input_go"]`),
	)

	if err != nil {
		return fmt.Errorf("erro ao salvar status: %w", err)
	}

	err = chromedp.Run(ctx,
		chromedp.Sleep(1*time.Second),
		chromedp.WaitNotPresent(`div.p-custom_status_modal`),
	)

	if err != nil {
		return fmt.Errorf("erro ao confirmar limpeza do status: %w", err)
	}

	statusAtual, err := s.ObterStatusAtual()
	if err != nil {
		return fmt.Errorf("erro ao verificar status após limpeza: %w", err)
	}

	if statusAtual != nil {
		return fmt.Errorf("status não foi limpo corretamente")
	}

	return nil
}

func (s *SessaoSlack) ObterStatusAtual() (*Status, error) {
	ctx, cancelar := context.WithTimeout(s.ctx, 30*time.Second)
	defer cancelar()

	if err := s.validarSessaoSomente(); err != nil {
		return nil, fmt.Errorf("erro ao validar sessão: %w", err)
	}

	if err := s.limparEstadoInicial(ctx); err != nil {
		return nil, fmt.Errorf("erro ao limpar estado inicial: %w", err)
	}

	var status *Status
	err := s.tentarNovamente(func() error {
		if err := chromedp.Run(ctx,
			chromedp.Click(`button[data-qa="user-button"]`),
			chromedp.WaitVisible(`button[data-qa="main-menu-custom-status-item"]`),
			chromedp.Click(`button[data-qa="main-menu-custom-status-item"]`),
			chromedp.WaitVisible(`div.p-custom_status_modal`),
		); err != nil {
			return fmt.Errorf("erro ao abrir menu de status: %w", err)
		}

		type resultadoStatus struct {
			TemStatus bool   `json:"hasStatus"`
			Emoji     string `json:"emoji"`
			Mensagem  string `json:"message"`
		}
		var resultado resultadoStatus

		err := chromedp.Run(ctx, chromedp.Evaluate(`
			(() => {
				function extractCleanText(element) {
					if (!element) return '';
					return element.textContent.replace(/\s+/g, ' ').trim();
				}

				const statusInput = document.querySelector('div[data-qa="custom_status_input_body"]');
				const statusText = statusInput ? statusInput.querySelector('.ql-editor p') : null;
				const message = extractCleanText(statusText);

				const emojiImg = document.querySelector('.p_custom_status_modal__input_emoji_picker img.c-emoji');
				if (!emojiImg || !message) {
					return { hasStatus: false };
				}

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
