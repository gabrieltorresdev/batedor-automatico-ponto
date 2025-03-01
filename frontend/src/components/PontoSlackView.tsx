import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePontoManager } from '@/hooks/usePontoManager';
import { useSlackManager } from '@/hooks/useSlackManager';
import { useNotifyStore } from '@/store/notifyStore';
import PontoSlackResumo from '@/components/PontoSlackResumo';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Status } from '@/store/slack/types';

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
    const pontoManager = usePontoManager();
    const slackManager = useSlackManager();

    const updateStepStatus = (index: number, status: StepStatus, errorMsg?: string) => {
        setSteps(steps => steps.map((step, i) => 
            i === index ? { ...step, status } : step
        ));
        if (errorMsg) {
            setErrorDetails(errorMsg);
        }
    };

    const handleConfirm = async (dados: { operacao: string | number; status: Status; mensagem: string }) => {
        setShowProgress(true);
        
        try {
            // Step 1: Register time clock
            updateStepStatus(0, 'loading');
            await pontoManager.executarOperacao(dados.operacao);
            updateStepStatus(0, 'completed');
            
            // Step 2: Update Slack status
            updateStepStatus(1, 'loading');
            await slackManager.setStatus(dados.status);
            updateStepStatus(1, 'completed');
            
            // Step 3: Send Slack message
            updateStepStatus(2, 'loading');
            if (dados.mensagem) {
                await slackManager.sendMessage(dados.mensagem);
            }
            updateStepStatus(2, 'completed');
            
            addNotification('Operação realizada com sucesso!', 'success');
            
            // Navigate back to dashboard after a short delay
            setTimeout(() => {
                navigate('/dashboard');
            }, 1500);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const currentStep = steps.findIndex(step => step.status === 'loading');
            
            if (currentStep !== -1) {
                updateStepStatus(currentStep, 'error', errorMessage);
            }
            
            addNotification(errorMessage, 'error');
        }
    };

    const handleCancel = () => {
        navigate('/dashboard');
    };

    const getProgressValue = () => {
        const completedSteps = steps.filter(step => step.status === 'completed').length;
        return (completedSteps / steps.length) * 100;
    };

    return (
        <div className="flex flex-col gap-4">
            {showProgress ? (
                <Card className="p-4">
                    <div className="space-y-4">
                        <Progress value={getProgressValue()} className="h-2" />
                        
                        <div className="space-y-2">
                            {steps.map((step, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full ${
                                        step.status === 'completed' ? 'bg-green-500' :
                                        step.status === 'loading' ? 'bg-blue-500 animate-pulse' :
                                        step.status === 'error' ? 'bg-red-500' :
                                        'bg-gray-300'
                                    }`} />
                                    <span className={`text-xs ${
                                        step.status === 'completed' ? 'text-green-500' :
                                        step.status === 'loading' ? 'text-blue-500' :
                                        step.status === 'error' ? 'text-red-500' :
                                        'text-gray-500'
                                    }`}>
                                        {step.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                        
                        {errorDetails && (
                            <div className="text-xs text-red-500 mt-2">
                                {errorDetails}
                            </div>
                        )}
                    </div>
                </Card>
            ) : (
                <PontoSlackResumo onConfirm={handleConfirm} onCancel={handleCancel} />
            )}
        </div>
    );
} 