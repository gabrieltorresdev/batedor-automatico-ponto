import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePontoManager } from '@/hooks/usePontoManager';
import { useSlackManager } from '@/hooks/useSlackManager';
import { useNotifyStore } from '@/store/notifyStore';
import { useTimeline, refreshTimeline } from '@/hooks/useTimeline';
import PontoSlackResumo from '@/components/PontoSlackResumo';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Status } from '@/store/slack/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, Clock, Loader2, RefreshCw, Slack, X } from 'lucide-react';

type StepStatus = 'pending' | 'loading' | 'completed' | 'error';

interface Step {
    label: string;
    status: StepStatus;
}

export default function PontoSlackView() {
    const navigate = useNavigate();
    const [showProgress, setShowProgress] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [steps, setSteps] = useState<Step[]>([
        { label: 'Registrando ponto', status: 'pending' },
        { label: 'Atualizando status', status: 'pending' },
        { label: 'Enviando mensagem', status: 'pending' }
    ]);
    const [errorDetails, setErrorDetails] = useState<string>('');
    const addNotification = useNotifyStore((state) => state.addNotification);
    const pontoManager = usePontoManager();
    const slackManager = useSlackManager();
    const timeline = useTimeline();
    const initRef = useRef(false);

    useEffect(() => {
        if (initRef.current) {
            console.log("PontoSlackView: Already initialized, skipping");
            return;
        }
        
        initRef.current = true;
        console.log("PontoSlackView: useEffect triggered, initializing");
        
        const initializeData = async () => {
            try {
                console.log("PontoSlackView: Starting parallel initialization of Ponto and Slack");
                
                await Promise.all([
                    (async () => {
                        console.log("PontoSlackView: Initializing Ponto module");
                        try {
                            if (!pontoManager.isInitialized && !pontoManager.isLoading) {
                                await pontoManager.initialize();
                            }
                            console.log("PontoSlackView: Ponto module initialized successfully");
                        } catch (error) {
                            console.error("PontoSlackView: Error initializing Ponto module:", error);
                            addNotification(
                                'Não foi possível carregar os dados do ponto. Tente novamente.',
                                'error'
                            );
                        }
                    })(),
                    
                    (async () => {
                        console.log("PontoSlackView: Initializing Slack module");
                        try {
                            if (!slackManager.isInitialized && !slackManager.isLoading) {
                                await slackManager.initialize();
                            }
                            console.log("PontoSlackView: Slack module initialized successfully");
                        } catch (error) {
                            console.warn("PontoSlackView: Non-critical Slack initialization error:", error);
                        }
                    })()
                ]);
                
                console.log("PontoSlackView: Refreshing timeline data");
                await timeline.refresh();
                
                console.log("PontoSlackView: Initialization complete");
            } catch (error) {
                console.error("PontoSlackView: Error during initialization:", error);
            } finally {
                setIsInitializing(false);
            }
        };
        
        initializeData();
        
        return () => {
            console.log("PontoSlackView: Component unmounted");
        };
    }, []);

    const updateStepStatus = (index: number, status: StepStatus, errorMsg?: string) => {
        setSteps(steps => steps.map((step, i) => 
            i === index ? { ...step, status } : step
        ));
        if (errorMsg) {
            setErrorDetails(errorMsg);
        }
    };

    const formatTime = (date?: Date) => {
        if (!date) return '--:--';
        return date.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
    };

    const hasActiveWorkday = timeline.clockInTime && !timeline.clockOutTime;
    
    const getTimelineStatus = () => {
        if (!timeline.clockInTime) {
            return { text: 'Sem registros', color: 'text-muted-foreground' };
        }
        
        if (timeline.lunchStartTime && !timeline.lunchEndTime) {
            return { text: 'Em almoço', color: 'text-amber-500' };
        }
        
        if (timeline.clockOutTime) {
            return { text: 'Encerrado', color: 'text-purple-500' };
        }
        
        return { text: 'Em andamento', color: 'text-green-500' };
    };
    
    const timelineStatus = getTimelineStatus();

    const handleConfirm = async (dados: { operacao: string | number; status: Status; mensagem: string }) => {
        setShowProgress(true);
        
        try {
            updateStepStatus(0, 'loading');
            await pontoManager.executarOperacao(dados.operacao);
            updateStepStatus(0, 'completed');
            
            refreshTimeline();
            
            updateStepStatus(1, 'loading');
            await slackManager.setStatus(dados.status);
            updateStepStatus(1, 'completed');
            
            updateStepStatus(2, 'loading');
            if (dados.mensagem) {
                await slackManager.sendMessage(dados.mensagem);
            }
            updateStepStatus(2, 'completed');
            
            await timeline.refresh();
            
            addNotification('Operação realizada com sucesso!', 'success');
            
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
            
            refreshTimeline();
        }
    };

    const handleCancel = () => {
        navigate('/dashboard');
    };

    const handleRetry = () => {
        setShowProgress(false);
        setErrorDetails('');
        setSteps(steps => steps.map(step => ({ ...step, status: 'pending' })));
        
        refreshTimeline();
    };

    const getProgressValue = () => {
        const completedSteps = steps.filter(step => step.status === 'completed').length;
        return (completedSteps / steps.length) * 100;
    };

    const allCompleted = steps.every(step => step.status === 'completed');
    const hasError = steps.some(step => step.status === 'error');

    if (isInitializing) {
        return (
            <div className="">
                <Card className="shadow-sm border-0">
                    <CardContent className="p-8 flex flex-col items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                        <p className="text-sm text-muted-foreground">Carregando dados...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!showProgress) {
        return (
            <div className="">
                <Card className="shadow-sm border-0 overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 flex items-center gap-1.5">
                        <Slack className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-medium">Registrar ponto e atualizar Slack</span>
                    </div>
                    <CardContent className="p-3">
                        <PontoSlackResumo 
                            onConfirm={handleConfirm} 
                            onCancel={handleCancel} 
                        />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="">
            <div className="flex items-center justify-between mb-2">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => navigate('/dashboard')}
                >
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Voltar
                </Button>
                
                <div className="flex items-center gap-1.5 text-xs">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <div className="flex gap-1 items-center">
                        <span className={timelineStatus.color + " font-medium"}>
                            {timelineStatus.text}
                        </span>
                        {hasActiveWorkday && (
                            <span className="animate-pulse h-1.5 w-1.5 rounded-full bg-green-500"></span>
                        )}
                    </div>
                </div>
            </div>
            
            <Card className="shadow-sm border-0 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 flex items-center gap-1.5">
                    <Slack className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">Processando operação</span>
                </div>
                <CardContent className="p-4">
                    <div className="mb-4">
                        <Progress
                            value={getProgressValue()}
                            className="h-1.5"
                        />
                    </div>
                    
                    <ul className="space-y-2 mb-4">
                        {steps.map((step, index) => (
                            <li key={index} className="flex items-center gap-2 text-xs">
                                {step.status === 'pending' && <div className="h-4 w-4 rounded-full border border-muted" />}
                                {step.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                                {step.status === 'completed' && <Check className="h-4 w-4 text-green-500" />}
                                {step.status === 'error' && <X className="h-4 w-4 text-destructive" />}
                                
                                <span className={
                                    step.status === 'loading' ? 'font-medium text-primary' :
                                    step.status === 'completed' ? 'text-muted-foreground line-through' :
                                    step.status === 'error' ? 'text-destructive' :
                                    'text-muted-foreground'
                                }>
                                    {step.label}
                                </span>
                            </li>
                        ))}
                    </ul>
                    
                    {allCompleted && (
                        <div className="rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-3 text-sm flex items-center gap-2">
                            <Check className="h-4 w-4 flex-shrink-0" />
                            <p>Todas as operações foram concluídas com sucesso!</p>
                        </div>
                    )}
                    
                    {hasError && (
                        <div>
                            <div className="rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 text-sm flex gap-2">
                                <X className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium">Ocorreu um erro ao processar sua solicitação</p>
                                    <p className="text-xs mt-1 whitespace-pre-wrap">{errorDetails}</p>
                                </div>
                            </div>
                            
                            <div className="mt-4 flex justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={handleRetry}
                                >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Tentar novamente
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}