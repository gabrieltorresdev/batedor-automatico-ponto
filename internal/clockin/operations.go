package clockin

import (
	"context"
	"fmt"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/manifoldco/promptui"
)

type TipoOperacao int

const (
	Entrada TipoOperacao = iota
	Almoco
	Saida
)

type Localizacao struct {
	Nome  string
	Valor string
}

type ErroPonto struct {
	Operacao TipoOperacao
	Tipo     string
	Mensagem string
	Causa    error
}

func (e *ErroPonto) Error() string {
	if e.Causa != nil {
		return fmt.Sprintf("%s: %v", e.Mensagem, e.Causa)
	}
	return e.Mensagem
}

func (op TipoOperacao) String() string {
	switch op {
	case Entrada:
		return "Entrada"
	case Almoco:
		return "Saída refeição/descanso"
	case Saida:
		return "Saída"
	default:
		return "desconhecido"
	}
}

type GerenciadorPonto struct {
	ctx context.Context
}

func NewGerenciadorPonto(ctx context.Context) *GerenciadorPonto {
	return &GerenciadorPonto{
		ctx: ctx,
	}
}

const (
	maxTentativas              = 10
	tempoEsperaEntreTentativas = 500 * time.Millisecond
)

func (g *GerenciadorPonto) aguardarAjax() chromedp.Action {
	return chromedp.WaitNotPresent(`#j_idt113_blocker[style*="display: block"]`)
}

func (g *GerenciadorPonto) tentarOperacaoString(operacao func() (string, error)) (string, error) {
	var resultado string
	var ultimoErro error

	for tentativa := 0; tentativa < maxTentativas; tentativa++ {
		if tentativa > 0 {
			time.Sleep(tempoEsperaEntreTentativas)
		}

		resultado, ultimoErro = operacao()
		if ultimoErro == nil {
			return resultado, nil
		}
	}

	return resultado, ultimoErro
}

func (g *GerenciadorPonto) tentarOperacaoLocalizacoes(operacao func() ([]Localizacao, error)) ([]Localizacao, error) {
	var resultado []Localizacao
	var ultimoErro error

	for tentativa := 0; tentativa < maxTentativas; tentativa++ {
		if tentativa > 0 {
			time.Sleep(tempoEsperaEntreTentativas)
		}

		resultado, ultimoErro = operacao()
		if ultimoErro == nil {
			return resultado, nil
		}
	}

	return resultado, ultimoErro
}

func (g *GerenciadorPonto) tentarOperacaoOperacoes(operacao func() ([]TipoOperacao, error)) ([]TipoOperacao, error) {
	var resultado []TipoOperacao
	var ultimoErro error

	for tentativa := 0; tentativa < maxTentativas; tentativa++ {
		if tentativa > 0 {
			time.Sleep(tempoEsperaEntreTentativas)
		}

		resultado, ultimoErro = operacao()
		if ultimoErro == nil {
			return resultado, nil
		}
	}

	return resultado, ultimoErro
}

func (g *GerenciadorPonto) tentarOperacaoBool(operacao func() (bool, error)) (bool, error) {
	var resultado bool
	var ultimoErro error

	for tentativa := 0; tentativa < maxTentativas; tentativa++ {
		if tentativa > 0 {
			time.Sleep(tempoEsperaEntreTentativas)
		}

		resultado, ultimoErro = operacao()
		if ultimoErro == nil {
			return resultado, nil
		}
	}

	return resultado, ultimoErro
}

func (g *GerenciadorPonto) obterLocalizacaoAtual() (string, error) {
	if err := g.validarSessao(); err != nil {
		return "", err
	}
	return g.tentarOperacaoString(func() (string, error) {
		var localizacaoAtual string
		err := chromedp.Run(g.ctx,
			g.aguardarAjax(),
			chromedp.WaitReady("#formMarc"),
			chromedp.Evaluate(`
				(function() {
					const btn = document.querySelector('#formMarc\\:btnLoc');
					if (!btn) return '';
					
					btn.style.cssText = 'display:block !important; visibility:visible !important; opacity:1 !important';
					
					const textoLoc = btn.querySelector('.loc-text');
					return (textoLoc && textoLoc.textContent) ? textoLoc.textContent.trim() : btn.textContent.trim();
				})()
			`, &localizacaoAtual),
		)

		if err != nil {
			return "", &ErroPonto{
				Tipo:     "localizacao",
				Mensagem: "falha ao obter localização atual",
				Causa:    err,
			}
		}

		if localizacaoAtual == "" {
			return "", &ErroPonto{
				Tipo:     "localizacao",
				Mensagem: "localização não encontrada",
			}
		}

		return localizacaoAtual, nil
	})
}

func (g *GerenciadorPonto) obterLocalizacoesDisponiveis() ([]Localizacao, error) {
	if err := g.validarSessao(); err != nil {
		return nil, err
	}
	return g.tentarOperacaoLocalizacoes(func() ([]Localizacao, error) {
		var localizacoes []Localizacao
		err := chromedp.Run(g.ctx,
			g.aguardarAjax(),
			chromedp.WaitReady("#formMarc"),
			chromedp.Evaluate(`
				(function() {
					const btnLoc = document.querySelector('#formMarc\\:btnLoc');
					if (!btnLoc) return [];
					
					btnLoc.style.cssText = 'display:block !important; visibility:visible !important; opacity:1 !important';
					btnLoc.click();
					
					const tabela = document.querySelector('#formMarc\\:dtLoc');
					if (!tabela) return [];
					
					tabela.style.cssText = 'display:block !important; visibility:visible !important; opacity:1 !important';
					const tbody = tabela.querySelector('tbody');
					if (tbody) {
						tbody.style.cssText = 'display:table-row-group !important; visibility:visible !important; opacity:1 !important';
					}
					
					const celulas = Array.from(tabela.querySelectorAll('tbody tr td'));
					return celulas
						.map((td, index) => {
							const texto = td.textContent.trim();
							return texto ? {nome: texto, valor: (index + 1).toString()} : null;
						})
						.filter(item => item !== null);
				})()
			`, &localizacoes),
		)

		if err != nil {
			return nil, &ErroPonto{
				Tipo:     "localizacao",
				Mensagem: "falha ao obter localizações",
				Causa:    err,
			}
		}

		if len(localizacoes) == 0 {
			return nil, &ErroPonto{
				Tipo:     "localizacao",
				Mensagem: "nenhuma localização disponível",
			}
		}

		return localizacoes, nil
	})
}

func (g *GerenciadorPonto) selecionarLocalizacao(localizacao Localizacao) error {
	if err := g.validarSessao(); err != nil {
		return err
	}
	_, err := g.tentarOperacaoBool(func() (bool, error) {
		var sucesso bool
		err := chromedp.Run(g.ctx,
			g.aguardarAjax(),
			chromedp.WaitReady("#formMarc"),
			chromedp.Evaluate(`
				(function() {
					const btnLoc = document.querySelector('#formMarc\\:btnLoc');
					if (!btnLoc) return false;
					
					btnLoc.style.cssText = 'display:block !important; visibility:visible !important; opacity:1 !important';
					btnLoc.click();
					
					const tabela = document.querySelector('#formMarc\\:dtLoc');
					if (!tabela) return false;
					
					tabela.style.cssText = 'display:block !important; visibility:visible !important; opacity:1 !important';
					const tbody = tabela.querySelector('tbody');
					if (tbody) {
						tbody.style.cssText = 'display:table-row-group !important; visibility:visible !important; opacity:1 !important';
					}
					
					const celulas = tabela.querySelectorAll('tbody tr td');
					for (const celula of celulas) {
						if (celula.textContent.trim() === '`+localizacao.Nome+`') {
							celula.click();
							return true;
						}
					}
					
					const celulaAlvo = tabela.querySelector('tbody tr:nth-child(' + localizacao.Valor + ') td');
					if (celulaAlvo) {
						celulaAlvo.click();
						return true;
					}
					
					return false;
				})()
			`, &sucesso),
		)

		if err != nil || !sucesso {
			return false, &ErroPonto{
				Tipo:     "localizacao",
				Mensagem: fmt.Sprintf("falha ao selecionar %s", localizacao.Nome),
				Causa:    err,
			}
		}

		return true, chromedp.Run(g.ctx, g.aguardarAjax())
	})

	return err
}

func (g *GerenciadorPonto) obterOperacoesDisponiveis() ([]TipoOperacao, error) {
	if err := g.validarSessao(); err != nil {
		return nil, err
	}
	return g.tentarOperacaoOperacoes(func() ([]TipoOperacao, error) {
		var operacoesStr []string
		err := chromedp.Run(g.ctx,
			g.aguardarAjax(),
			chromedp.WaitReady("#formMarc"),
			chromedp.Evaluate(`
				(function() {
					const botoes = Array.from(document.querySelectorAll('button'));
					const tipos = ['Entrada', 'Saída refeição/descanso', 'Saída'];
					
					// Força a atualização do display dos botões
					botoes.forEach(btn => {
						if (btn.offsetParent !== null) {
							btn.style.cssText = 'display:block !important; visibility:visible !important; opacity:1 !important';
						}
					});

					return tipos.filter(tipo => {
						const btn = botoes.find(b => 
							b.textContent.includes(tipo) && 
							!b.disabled && 
							b.offsetParent !== null &&
							window.getComputedStyle(b).display !== 'none'
						);
						if (btn) {
							btn.style.cssText = 'display:block !important; visibility:visible !important; opacity:1 !important';
							return true;
						}
						return false;
					});
				})()
			`, &operacoesStr),
		)

		if err != nil {
			return nil, &ErroPonto{
				Tipo:     "validacao",
				Mensagem: "falha ao obter operações",
				Causa:    err,
			}
		}

		var operacoes []TipoOperacao
		for _, op := range operacoesStr {
			switch op {
			case "Entrada":
				operacoes = append(operacoes, Entrada)
			case "Saída refeição/descanso":
				operacoes = append(operacoes, Almoco)
			case "Saída":
				operacoes = append(operacoes, Saida)
			}
		}

		return operacoes, nil
	})
}

func (g *GerenciadorPonto) executarOperacao(operacao TipoOperacao) error {
	if err := g.validarSessao(); err != nil {
		return err
	}
	_, err := g.tentarOperacaoBool(func() (bool, error) {
		var clicado bool
		err := chromedp.Run(g.ctx,
			g.aguardarAjax(),
			chromedp.WaitReady("#formMarc"),
			chromedp.Evaluate(fmt.Sprintf(`
				(function() {
					const botoes = document.querySelectorAll('button');
					for (const btn of botoes) {
						if (btn.textContent.includes('%s') && !btn.disabled) {
							btn.style.cssText = 'display:block !important; visibility:visible !important; opacity:1 !important';
							btn.click();
							return true;
						}
					}
					return false;
				})()
			`, operacao.String()), &clicado),
		)

		if err != nil {
			return false, &ErroPonto{
				Operacao: operacao,
				Tipo:     "execucao",
				Mensagem: "falha ao executar operação",
				Causa:    err,
			}
		}

		if !clicado {
			return false, &ErroPonto{
				Operacao: operacao,
				Tipo:     "validacao",
				Mensagem: "operação indisponível",
			}
		}

		if err := chromedp.Run(g.ctx, g.aguardarAjax()); err != nil {
			return false, err
		}

		return true, g.tratarModalIntervalo()
	})

	return err
}

func (g *GerenciadorPonto) tratarModalIntervalo() error {
	var modalInfo struct {
		Visivel  bool
		Conteudo string
	}

	err := chromedp.Run(g.ctx,
		chromedp.Evaluate(`
			(function() {
				const dialog = document.querySelector('.ui-dialog');
				if (!dialog) return {visivel: false};
				
				const title = dialog.querySelector('.ui-dialog-title');
				if (!title || !title.textContent.includes('Intervalo Opcional')) {
					return {visivel: false};
				}
				
				const content = dialog.querySelector('.ui-dialog-content');
				return {
					visivel: true,
					conteudo: content ? content.textContent.trim() : ''
				};
			})()
		`, &modalInfo),
	)

	if err != nil || !modalInfo.Visivel {
		return nil
	}

	fmt.Printf("\n⏰ Intervalo Opcional Detectado\n%s\n", modalInfo.Conteudo)

	prompt := promptui.Prompt{
		Label:     "Deseja considerar este período como intervalo opcional",
		IsConfirm: true,
	}

	resultado, err := prompt.Run()
	if err != nil {
		if err == promptui.ErrAbort {
			fmt.Println("\n✖ Operação cancelada")
			return nil
		}
		return &ErroPonto{
			Tipo:     "modal",
			Mensagem: "erro na confirmação do intervalo",
			Causa:    err,
		}
	}

	seletor := `button.ui-button span`
	if resultado == "y" || resultado == "Y" {
		seletor += `:contains("Sim")`
	} else {
		seletor += `:contains("Não")`
	}

	err = chromedp.Run(g.ctx,
		chromedp.Click(seletor, chromedp.ByQuery),
	)

	if err != nil {
		return &ErroPonto{
			Tipo:     "modal",
			Mensagem: "falha ao responder modal",
			Causa:    err,
		}
	}

	return chromedp.Run(g.ctx, g.aguardarAjax())
}

func (g *GerenciadorPonto) validarSessao() error {
	var elementosVisiveis bool
	err := chromedp.Run(g.ctx,
		g.aguardarAjax(),
		chromedp.Evaluate(`
			(function() {
				const botoes = document.querySelectorAll('button');
				for (const btn of botoes) {
					if (btn.textContent.includes('Entrada') || 
						btn.textContent.includes('Saída') || 
						btn.textContent.includes('refeição')) {
						return true;
					}
				}
				return false;
			})()
		`, &elementosVisiveis),
	)

	if err != nil || !elementosVisiveis {
		return fmt.Errorf("sessão expirada")
	}

	return nil
}

func (g *GerenciadorPonto) ObterLocalizacaoAtual() (string, error) {
	return g.obterLocalizacaoAtual()
}

func (g *GerenciadorPonto) ObterLocalizacoesDisponiveis() ([]Localizacao, error) {
	return g.obterLocalizacoesDisponiveis()
}

func (g *GerenciadorPonto) SelecionarLocalizacao(localizacao Localizacao) error {
	return g.selecionarLocalizacao(localizacao)
}

func (g *GerenciadorPonto) ObterOperacoesDisponiveis() ([]TipoOperacao, error) {
	return g.obterOperacoesDisponiveis()
}

func (g *GerenciadorPonto) ExecutarOperacao(operacao TipoOperacao) error {
	return g.executarOperacao(operacao)
}

// Close releases resources used by the module
func (g *GerenciadorPonto) Close() {
	if g.ctx != nil {
		if cancel, ok := g.ctx.Value("cancel").(context.CancelFunc); ok {
			cancel()
		}
	}
}
