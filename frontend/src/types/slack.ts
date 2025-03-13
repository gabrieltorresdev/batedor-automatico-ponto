export interface SlackStatus {
    Emoji: string;
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

export type TipoMensagem = 'entrada' | 'refeicao' | 'saida';
export type TipoOperacao = 'entrada' | 'almoco' | 'saida';
