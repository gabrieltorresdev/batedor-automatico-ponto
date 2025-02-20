import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginPonto, VerificarCredenciaisSalvas } from '../../wailsjs/go/main/App';
import { useNotifyStore } from '../store/notifyStore';
import { useSlackStore } from '../store/slackStore';

export const useAuth = () => {
    const navigate = useNavigate();
    const addNotification = useNotifyStore((state) => state.addNotification);
    const verifySlackSession = useSlackStore((state) => state.verifySlackSession);
    const [isLoading, setIsLoading] = useState(true);

    const login = async (username: string, password: string) => {
        try {
            setIsLoading(true);
            // Primeiro faz login no ponto
            await LoginPonto(username, password);
            // Depois verifica o Slack silenciosamente
            await verifySlackSession();
            addNotification('Login realizado com sucesso!', 'success');
            navigate('/dashboard');
        } catch (err) {
            addNotification((err as Error).message || 'Erro ao realizar login', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const checkSavedCredentials = async () => {
        try {
            setIsLoading(true);
            // Verifica credenciais e Slack em paralelo
            await Promise.all([
                VerificarCredenciaisSalvas(),
                verifySlackSession()
            ]);
            navigate('/dashboard');
        } catch (err) {
            // Ignora erros do Slack, apenas loga para debug
            console.debug('Verificação inicial:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkSavedCredentials();
    }, []);

    return {
        login,
        isLoading
    };
}; 