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
    const addNotification = useNotifyStore((state) => state.addNotification);
    const pontoStore = usePontoStore();

    const updateStepStatus = (index: number, status: StepStatus) => {
        setSteps(steps => steps.map((step, i) => 
            i === index ? { ...step, status } : step
        ));
    };

    const handleConfirm = async (dados: {
        operacao: string | number;
        status: { emoji: string; mensagem: string };
        mensagem: string;
    }) => {
        setShowProgress(true);
        let success = true;

        try {
            // Executa a operação de ponto
            updateStepStatus(0, 'loading');
            await pontoStore.executarOperacao(dados.operacao);
            updateStepStatus(0, 'completed');
            addNotification('Ponto registrado com sucesso!', 'success');
            
            // Define o status no Slack
            updateStepStatus(1, 'loading');
            await slackService.definirStatus(dados.status);
            updateStepStatus(1, 'completed');
            addNotification('Status atualizado com sucesso!', 'success');
            
            // Envia a mensagem
            updateStepStatus(2, 'loading');
            await slackService.enviarMensagem(dados.mensagem);
            updateStepStatus(2, 'completed');
            addNotification('Mensagem enviada com sucesso!', 'success');

        } catch (error) {
            success = false;
            // Marca o passo atual como erro
            const currentStep = steps.findIndex(step => step.status === 'loading');
            if (currentStep !== -1) {
                updateStepStatus(currentStep, 'error');
            }
            addNotification((error as Error).message || 'Erro ao executar ações', 'error');
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
            <PontoSlackResumo onConfirm={handleConfirm} onCancel={handleCancel} />
            
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
                    </div>
                </Card>
            )}
        </div>
    );
} 