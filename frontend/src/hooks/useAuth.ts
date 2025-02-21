import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginPonto, VerificarCredenciaisSalvas, CarregarCredenciais } from '../../wailsjs/go/main/App';
import { useAuthStore } from '@/store/authStore';
import { useNotifyStore } from '@/store/notifyStore';
import { useSlackStore } from '@/store/slackStore';

export const useAuth = () => {
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const { setAuthenticated, setBlocked, setUnauthenticated } = useAuthStore();
    const { verifySlackSession } = useSlackStore();
    const addNotification = useNotifyStore(state => state.addNotification);

    const verificarSlack = async () => {
        try {
            await verifySlackSession();
        } catch (error) {
            console.debug('Slack não configurado:', error);
        }
    };

    const handleAuthError = (error: any, username?: string) => {
        const errorMessage = error?.message || error?.toString() || 'Erro desconhecido';
        console.debug('Erro de autenticação:', error);

        if (errorMessage.toLowerCase().includes('bloqueado') || 
            errorMessage.toLowerCase().includes('intervalo')) {
            if (username) {
                setBlocked(username);
                addNotification(errorMessage, 'warning');
                verificarSlack();
                navigate('/dashboard');
                return true;
            }
        }
        return false;
    };

    const login = async (username: string, password: string) => {
        try {
            setIsLoading(true);
            await LoginPonto(username, password);
            setAuthenticated(username);
            verificarSlack();
            navigate('/dashboard');
        } catch (error) {
            if (!handleAuthError(error, username)) {
                setUnauthenticated();
                const errorMessage = (error as Error)?.message || 'Erro ao fazer login';
                addNotification(errorMessage, 'error');
                throw error;
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const verificarCredenciais = async () => {
            setIsLoading(true);
            try {
                verificarSlack();

                const credenciais = await CarregarCredenciais().catch(() => null);
                if (!credenciais?.Username) {
                    console.debug('Nenhuma credencial encontrada');
                    setUnauthenticated();
                    return;
                }

                try {
                    await VerificarCredenciaisSalvas();
                    console.debug('Credenciais verificadas com sucesso');
                    setAuthenticated(credenciais.Username);
                    navigate('/dashboard');
                } catch (error) {
                    console.debug('Erro ao verificar credenciais:', error);
                    if (!handleAuthError(error, credenciais.Username)) {
                        setUnauthenticated();
                    }
                }
            } catch (error) {
                console.debug('Erro fatal ao verificar credenciais:', error);
                setUnauthenticated();
            } finally {
                setIsLoading(false);
            }
        };

        verificarCredenciais();
    }, []);

    return {
        login,
        isLoading
    };
}; 