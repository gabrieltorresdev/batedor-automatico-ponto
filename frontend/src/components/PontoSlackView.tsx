import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePontoStore } from '@/store/pontoStore';
import { slackService } from '@/services/SlackService';
import { useNotifyStore } from '@/store/notifyStore';
import PontoSlackResumo from '@/components/PontoSlackResumo';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';

type StepStatus = 'pending' | 'loading' | 'completed' | 'error';

interface Step {
    label: string;
    status: StepStatus;
}

export default function PontoSlackView() {
    const navigate = useNavigate();
    const [showProgress, setShowProgress] = useState(false);
    const [steps, setSteps] = useState<Step[]>([
        { label: 'Registrando ponto', status: 'pending' },
        { label: 'Atualizando status', status: 'pending' },
        { label: 'Enviando mensagem', status: 'pending' }
    ]);
    const [errorDetails, setErrorDetails] = useState<string>('');
    const addNotification = useNotifyStore((state) => state.addNotification);
    const pontoStore = usePontoStore();

    const updateStepStatus = (index: number, status: StepStatus, errorMsg?: string) => {
        setSteps(steps => steps.map((step, i) => 
            i === index ? { ...step, status } : step
        ));
        if (errorMsg) {
            setErrorDetails(errorMsg);
        }
    };

    const handleConfirm = async (dados: {
        operacao: string | number;
        status: { emoji: string; mensagem: string };
        mensagem: string;
    }) => {
        setShowProgress(true);
        setErrorDetails('');
        let success = true;

        try {
            // Executa a operação de ponto
            updateStepStatus(0, 'loading');
            try {
                await pontoStore.executarOperacao(dados.operacao);
                updateStepStatus(0, 'completed');
                addNotification('Ponto registrado com sucesso!', 'success');
            } catch (error) {
                success = false;
                updateStepStatus(0, 'error', `Erro ao registrar ponto: ${(error as Error).message}`);
                throw error;
            }
            
            // Define o status no Slack
            updateStepStatus(1, 'loading');
            try {
                await slackService.definirStatus(dados.status);
                updateStepStatus(1, 'completed');
                addNotification('Status atualizado com sucesso!', 'success');
            } catch (error) {
                success = false;
                updateStepStatus(1, 'error', `Erro ao atualizar status: ${(error as Error).message}`);
                if (steps[0].status === 'completed') {
                    addNotification('O ponto foi registrado, mas houve erro ao atualizar o status no Slack', 'warning');
                }
                throw error;
            }
            
            // Envia a mensagem
            updateStepStatus(2, 'loading');
            try {
                await slackService.enviarMensagem(dados.mensagem);
                updateStepStatus(2, 'completed');
                addNotification('Mensagem enviada com sucesso!', 'success');
            } catch (error) {
                success = false;
                updateStepStatus(2, 'error', `Erro ao enviar mensagem: ${(error as Error).message}`);
                if (steps[0].status === 'completed') {
                    addNotification('O ponto foi registrado, mas houve erro ao enviar a mensagem no Slack', 'warning');
                }
                throw error;
            }

            if (success) {
                // Atualiza o cache do status do Slack
                await slackService.obterStatusAtual();
            }

        } catch (error) {
            console.error('Erro durante execução:', error);
        } finally {
            // Aguarda 2 segundos antes de fechar o diálogo de progresso
            setTimeout(() => {
                setShowProgress(false);
                if (success) {
                    navigate('/dashboard');
                }
            }, 2000);
        }
    };

    const handleCancel = () => {
        navigate('/dashboard');
    };

    return (
        <div className="flex flex-col gap-4">
            {!showProgress && (
                <PontoSlackResumo onConfirm={handleConfirm} onCancel={handleCancel} />
            )}
            
            {showProgress && (
                <Card className="p-4">
                    <div className="space-y-4">
                        {steps.map((step, index) => (
                            <div key={index} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span>{step.label}</span>
                                    <span>
                                        {step.status === 'pending' && '⏳'}
                                        {step.status === 'loading' && '🔄'}
                                        {step.status === 'completed' && '✅'}
                                        {step.status === 'error' && '❌'}
                                    </span>
                                </div>
                                <Progress 
                                    value={
                                        step.status === 'completed' ? 100 :
                                        step.status === 'loading' ? 50 :
                                        step.status === 'error' ? 100 : 0
                                    } 
                                    className={
                                        step.status === 'completed' ? 'bg-green-500' :
                                        step.status === 'error' ? 'bg-red-500' : ''
                                    }
                                />
                            </div>
                        ))}
                        
                        {errorDetails && (
                            <div className="mt-4 p-2 bg-red-50 border border-red-200 rounded-md">
                                <p className="text-sm text-red-600">{errorDetails}</p>
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
} 