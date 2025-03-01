export interface SlackStatus {
    Emoji: string; // Pode ser um emoji unicode ou uma URL de imagem
    Mensagem: string;
}

export interface SlackConfig {
    DiretorioConfig: string;
    ModoSilencioso: boolean;
}

export interface Status {
    emoji: string;
    text: string;
}

// Types for message operations
export type TipoMensagem = 'entrada' | 'refeicao' | 'saida';
export type TipoOperacao = 'entrada' | 'almoco' | 'saida';
