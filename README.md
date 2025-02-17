# Batedor de Ponto - Oliveira Trust

## Descrição

O Batedor de Ponto é um script desenvolvido para automatizar a marcação de ponto e a atualização do status no Slack, facilitando o controle de horários e comunicação com a equipe.

## Pré-requisitos

- Distribuição Linux (Ubuntu, Debian, etc.)
- Go (versão 1.16 ou superior)
- Git
- Chromium (necessário para a automação via chromedp)
- X Server (ou execução em modo headless, conforme configurado)

## Passo a Passo de Instalação

### 1. Clonar o Repositório

Abra o terminal e execute:

```bash
git clone https://github.com/gabrieltorresdev/batedor-automatico-ponto.git 
cd batedor-automatico-ponto
```

### 2. Instalar o Go (se ainda não estiver instalado)

Verifique se o Go está instalado:

```bash
go version
```

Caso não esteja instalado, utilize os comandos:

```bash
sudo apt update
sudo apt install golang-go
```

### 3. Instalar o Chromium

```bash
sudo apt update
sudo apt install chromium-browser
```

### 4. Configurar Diretório para Cookies e Credenciais

O script utiliza o diretório `~/.batedorponto` para armazenar arquivos de configuração (como cookies do Slack). Crie o diretório caso não exista:

```bash
mkdir -p ~/.batedorponto
```

Além disso, configure as credenciais necessárias (essas informações geralmente são solicitadas ou configuradas por meio de um arquivo de configuração ou variáveis de ambiente, dependendo do seu setup).

### 5. Build do Projeto

Compile o projeto utilizando o comando:

```bash
go build cmd/app -ldflags="-s -w" -o batponto
```

Isso gerará um executável `batponto`.

### 6. Executar o Script

Execute o script:

```bash
./batponto
```

Siga as instruções apresentadas na interface interativa. Durante a execução, você poderá:

- Selecionar ou alterar a localização (obrigatório para habilitar as operações).
- Marcar o ponto (entrada, almoço, saída).
- Gerenciar a integração com o Slack (envio de mensagens e atualização de status).

## Configurações Adicionais

- **Modo de Desenvolvimento:** Se desejar testar sem operar o sistema real, altere a variável `mocarPonto` no arquivo `cmd/app/main.go` para `true`, o que utilizará o módulo mock.
- **Slack:** Para que as funcionalidades do Slack funcionem corretamente, certifique-se de que as credenciais e cookies estejam configurados no diretório `~/.batedorponto`.

## Solução de Problemas

- **Operações não Disponíveis:** Se após a seleção da localização as operações não forem habilitadas, verifique se há um atraso na atualização da interface. O script implementa uma espera de 2 segundos para tentar recuperar as operações; aumente esse tempo se necessário.
- **Chromium:** Certifique-se de que o navegador está instalado e acessível.
- **Erros de Credenciais ou Login:** Verifique a configuração e o carregamento das credenciais conforme informado nos logs.

## Observações Finais

- Este script foi desenvolvido para facilitar a marcação de ponto e a integração com Slack em ambientes Linux.
- Caso utilize o modo headless, assegure-se de que todas as dependências estejam configuradas para esse fim.