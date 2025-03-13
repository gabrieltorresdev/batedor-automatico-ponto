import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePontoManager } from '@/hooks/usePontoManager';
import { useNotifyStore } from '@/store/notifyStore';
import { useTimeline, refreshTimeline } from '@/hooks/useTimeline';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, Clock, Loader2, RefreshCw, X } from 'lucide-react';
import { TipoOperacao, Localizacao } from '@/store/ponto/types';
import { getOperacaoDisplay } from '@/store/ponto/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type StepStatus = 'pending' | 'loading' | 'completed' | 'error';

interface Step {
    label: string;
    status: StepStatus;
}

export default function PontoView() {
    const navigate = useNavigate();
    const [showProgress, setShowProgress] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [errorDetails, setErrorDetails] = useState<string>('');
    const [steps, setSteps] = useState<Step[]>([
        { label: 'Registrando ponto', status: 'pending' }
    ]);
    
    const [isLoadingOperacoes, setIsLoadingOperacoes] = useState(false);
    const [localizacoes, setLocalizacoes] = useState<Localizacao[]>([]);
    const [operacoes, setOperacoes] = useState<TipoOperacao[]>([]);
    const [localizacaoSelecionada, setLocalizacaoSelecionada] = useState<string>('');
    const [operacaoSelecionada, setOperacaoSelecionada] = useState<string>('');
    const [localizacaoAtual, setLocalizacaoAtual] = useState<string>('');
    
    const addNotification = useNotifyStore((state) => state.addNotification);
    const pontoManager = usePontoManager();
    const timeline = useTimeline();
    const initRef = useRef(false);

    useEffect(() => {
        if (initRef.current) {
            console.log("PontoView: Already initialized, skipping");
            return;
        }
        
        initRef.current = true;
        console.log("PontoView: useEffect triggered, initializing");
        
        const initializeData = async () => {
            try {
                console.log("PontoView: Starting initialization of Ponto");
                
                console.log("PontoView: Initializing Ponto module");
                try {
                    if (!pontoManager.isInitialized && !pontoManager.isLoading) {
                        await pontoManager.initialize();
                    }
                    console.log("PontoView: Ponto module initialized successfully");
                    
                    console.log("PontoView: Fetching locations");
                    
                    const [locAtual, locs] = await Promise.all([
                        pontoManager.obterLocalizacaoAtual(),
                        pontoManager.obterLocalizacoesDisponiveis()
                    ]);
                    
                    console.log("PontoView: Current location:", locAtual);
                    console.log("PontoView: Available locations:", locs);
                    
                    setLocalizacoes(locs);
                    setLocalizacaoAtual(locAtual);
                    
                    const localizacaoObj = locs.find((l) => l.Nome === locAtual);
                    console.log("PontoView: Selected location object:", localizacaoObj);
                    
                    const locToUse = localizacaoObj || (locs.length > 0 ? locs[0] : null);
                    
                    if (locToUse) {
                        setLocalizacaoSelecionada(locToUse.Valor);
                        console.log("PontoView: Setting location:", locToUse.Valor);
                        await pontoManager.selecionarLocalizacao(locToUse);
                        
                        setIsLoadingOperacoes(true);
                        try {
                            console.log("PontoView: Fetching operations for location:", locToUse.Nome);
                            const ops = await pontoManager.obterOperacoesDisponiveis();
                            console.log("PontoView: Operations received:", ops);
                            
                            if (ops && ops.length > 0) {
                                setOperacoes(ops);
                                setOperacaoSelecionada(ops[0].toString());
                            } else {
                                console.warn("PontoView: No operations available for this location");
                                setOperacoes([]);
                            }
                        } catch (error) {
                            console.error("PontoView: Error fetching operations:", error);
                        } finally {
                            setIsLoadingOperacoes(false);
                        }
                    } else {
                        console.warn("PontoView: Could not find any valid location to use");
                    }
                } catch (error) {
                    console.error("PontoView: Error initializing Ponto module:", error);
                    addNotification(
                        'Não foi possível carregar os dados do ponto. Tente novamente.',
                        'error'
                    );
                }
                
                console.log("PontoView: Refreshing timeline data");
                await timeline.refresh();
                
                console.log("PontoView: Initialization complete");
            } catch (error) {
                console.error("PontoView: Error during initialization:", error);
            } finally {
                setIsInitializing(false);
            }
        };
        
        initializeData();
        
        return () => {
            console.log("PontoView: Component unmounted");
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

    const handleLocalizacaoChange = async (value: string) => {
        console.log("PontoView: Location changed to:", value);
        setLocalizacaoSelecionada(value);
        setIsLoadingOperacoes(true);
        
        try {
            const localizacao = localizacoes.find((loc) => loc.Valor === value);
            if (localizacao) {
                console.log("PontoView: Selecting location:", localizacao.Nome);
                await pontoManager.selecionarLocalizacao(localizacao);
                
                console.log("PontoView: Fetching operations for location:", localizacao.Nome);
                const ops = await pontoManager.obterOperacoesDisponiveis();
                console.log("PontoView: Operations received:", ops);
                
                if (ops && ops.length > 0) {
                    setOperacoes(ops);
                    setOperacaoSelecionada(ops[0].toString());
                } else {
                    console.warn("PontoView: No operations available for this location");
                    setOperacoes([]);
                    setOperacaoSelecionada('');
                }
            }
        } catch (error) {
            console.error("PontoView: Error updating location:", error);
            addNotification("Erro ao selecionar localização", "error");
        } finally {
            setIsLoadingOperacoes(false);
        }
    };

    const handleOperacaoChange = (value: string) => {
        console.log("PontoView: Operation changed to:", value);
        setOperacaoSelecionada(value);
    };

    const handleOperacaoSubmit = async () => {
        if (!operacaoSelecionada) {
            addNotification("Selecione uma operação", "error");
            return;
        }
        
        setShowProgress(true);
        updateStepStatus(0, 'loading');
        
        try {
            console.log("PontoView: Executing operation:", operacaoSelecionada);
            await pontoManager.executarOperacao(operacaoSelecionada);
            updateStepStatus(0, 'completed');
            
            console.log("PontoView: Refreshing timeline");
            refreshTimeline();
            
            await timeline.refresh();
            
            addNotification(`Operação ${getOperacaoDisplay(operacaoSelecionada)} realizada com sucesso!`, 'success');
            
            setTimeout(() => {
                navigate('/dashboard');
            }, 1500);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("PontoView: Error executing operation:", errorMessage);
            updateStepStatus(0, 'error', errorMessage);
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
            <div className="flex flex-col items-center justify-center p-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Carregando dados do ponto...</p>
            </div>
        );
    }

    if (showProgress) {
        return (
            <Card className="w-full">
                <CardContent className="pt-6">
                    <div className="space-y-4">
                        <Progress value={getProgressValue()} className="h-2" />
                        
                        <div className="space-y-2">
                            {steps.map((step, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    {step.status === 'pending' && <Clock className="h-4 w-4 text-muted-foreground" />}
                                    {step.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                                    {step.status === 'completed' && <Check className="h-4 w-4 text-green-500" />}
                                    {step.status === 'error' && <X className="h-4 w-4 text-destructive" />}
                                    
                                    <span className={`text-sm ${
                                        step.status === 'loading' ? 'text-primary font-medium' :
                                        step.status === 'completed' ? 'text-green-500' :
                                        step.status === 'error' ? 'text-destructive' :
                                        'text-muted-foreground'
                                    }`}>
                                        {step.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                        
                        {hasError && (
                            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                                <p className="font-medium">Erro</p>
                                <p className="mt-1">{errorDetails}</p>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="mt-2" 
                                    onClick={handleRetry}
                                >
                                    <RefreshCw className="mr-2 h-3 w-3" />
                                    Tentar novamente
                                </Button>
                            </div>
                        )}
                        
                        {allCompleted && (
                            <div className="rounded-md bg-green-500/10 p-3 text-xs text-green-600">
                                <p className="font-medium">Concluído</p>
                                <p className="mt-1">Operação realizada com sucesso!</p>
                            </div>
                        )}
                        
                        <div className="flex justify-between">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleCancel}
                                disabled={allCompleted}
                            >
                                <ArrowLeft className="mr-2 h-3 w-3" />
                                Voltar
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="pt-6 space-y-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-medium">Localização</span>
                        </div>
                        <Select
                            value={localizacaoSelecionada}
                            onValueChange={handleLocalizacaoChange}
                            disabled={isLoadingOperacoes}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                {isLoadingOperacoes ? (
                                    <div className="flex items-center gap-1.5">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span className="text-[10px]">Carregando...</span>
                                    </div>
                                ) : (
                                    <SelectValue placeholder="Selecione a localização" />
                                )}
                            </SelectTrigger>
                            <SelectContent>
                                {localizacoes.map((loc) => (
                                    <SelectItem key={loc.Valor} value={loc.Valor} className="text-[10px] py-0.5">
                                        {loc.Nome}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-medium">Operação</span>
                        </div>
                        <Select
                            value={operacaoSelecionada}
                            onValueChange={handleOperacaoChange}
                            disabled={isLoadingOperacoes || operacoes.length === 0}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                {isLoadingOperacoes ? (
                                    <div className="flex items-center gap-1.5">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span className="text-[10px]">Carregando...</span>
                                    </div>
                                ) : (
                                    <SelectValue placeholder="Selecione a operação" />
                                )}
                            </SelectTrigger>
                            <SelectContent>
                                {operacoes.map((op) => (
                                    <SelectItem key={op.toString()} value={op.toString()} className="text-[10px] py-0.5">
                                        {getOperacaoDisplay(op)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex justify-between">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancel}
                        >
                            <ArrowLeft className="mr-2 h-3 w-3" />
                            Voltar
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleOperacaoSubmit}
                            disabled={isLoadingOperacoes || operacoes.length === 0 || !operacaoSelecionada}
                        >
                            <Check className="mr-2 h-3 w-3" />
                            Confirmar
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}