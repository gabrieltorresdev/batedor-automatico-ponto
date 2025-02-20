import { useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Status } from '@/types/slack';
import { useNotifyStore } from '@/store/notifyStore';
import { slackService } from '@/services/SlackService';

const SLACK_STATUS_KEY = 'slackStatus';

export function useSlackStatus() {
    const queryClient = useQueryClient();
    const addNotification = useNotifyStore((state) => state.addNotification);

    // Query para obter o status atual
    const { 
        data: currentStatus,
        isLoading: isLoadingStatus,
        error: statusError
    } = useQuery({
        queryKey: [SLACK_STATUS_KEY],
        queryFn: () => slackService.obterStatusAtual(),
        refetchInterval: 10000, // Refetch a cada 10 segundos
        retry: 1, // Limita o número de retentativas
        retryDelay: 1000, // Espera 1 segundo entre as tentativas
        gcTime: 0, // Remove do cache imediatamente quando não estiver em uso
    });

    // Mutation para definir um novo status
    const { mutate: definirStatus, isPending: isSettingStatus } = useMutation({
        mutationFn: (novoStatus: Status) => slackService.definirStatus(novoStatus),
        onSuccess: (_, novoStatus) => {
            queryClient.setQueryData([SLACK_STATUS_KEY], novoStatus);
            addNotification('Status atualizado com sucesso!', 'success');
        },
        onError: (error) => {
            console.error('Erro ao definir status:', error);
            addNotification('Não foi possível definir o status', 'error');
            // Força um refetch para garantir que temos o status correto
            queryClient.invalidateQueries({ queryKey: [SLACK_STATUS_KEY] });
        }
    });

    // Mutation para limpar o status
    const { mutate: limparStatus, isPending: isClearingStatus } = useMutation({
        mutationFn: () => slackService.limparStatus(),
        onSuccess: () => {
            queryClient.setQueryData([SLACK_STATUS_KEY], null);
            addNotification('Status removido com sucesso!', 'success');
        },
        onError: (error) => {
            console.error('Erro ao limpar status:', error);
            addNotification('Não foi possível limpar o status', 'error');
            // Força um refetch para garantir que temos o status correto
            queryClient.invalidateQueries({ queryKey: [SLACK_STATUS_KEY] });
        }
    });

    const getStatusPresets = useCallback(() => {
        return slackService.getStatusPresets();
    }, []);

    // Limpa as queries quando o componente é desmontado
    useEffect(() => {
        return () => {
            queryClient.removeQueries({ queryKey: [SLACK_STATUS_KEY] });
        };
    }, [queryClient]);

    return {
        currentStatus,
        isLoading: isLoadingStatus || isSettingStatus || isClearingStatus,
        error: statusError,
        definirStatus,
        limparStatus,
        getStatusPresets
    };
} 