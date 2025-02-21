import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNotifyStore } from '@/store/notifyStore';
import { slackService } from '@/services/SlackService';
import type { TipoMensagem } from '@/services/SlackService';

export function useSlackMessage() {
    const addNotification = useNotifyStore((state) => state.addNotification);

    const { mutate: enviarMensagem, isPending: isEnviando } = useMutation({
        mutationFn: (mensagem: string) => slackService.enviarMensagem(mensagem),
        onSuccess: () => {
            addNotification('Mensagem enviada com sucesso!', 'success');
        },
        onError: (error) => {
            console.error('Erro ao enviar mensagem:', error);
            addNotification('Não foi possível enviar a mensagem', 'error');
        }
    });

    const { mutate: prepararMensagem, isPending: isPreparando } = useMutation({
        mutationFn: (tipo: TipoMensagem) => slackService.prepararMensagem(tipo),
        onError: (error) => {
            console.error('Erro ao preparar mensagem:', error);
            addNotification('Não foi possível preparar a mensagem', 'error');
        }
    });

    const getMensagensPreset = useCallback((tipo: TipoMensagem) => {
        return slackService.getMensagensPreset(tipo);
    }, []);

    return {
        enviarMensagem,
        prepararMensagem,
        getMensagensPreset,
        isLoading: isEnviando || isPreparando
    };
} 