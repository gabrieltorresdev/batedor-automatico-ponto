import { useEffect } from 'react';
import { usePonto } from '@/hooks/usePonto';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Clock } from 'lucide-react';
import { Localizacao, TipoOperacao } from '@/services/PontoService';
import { useNavigate } from 'react-router-dom';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { pontoService } from '@/services/PontoService';

export default function PontoView() {
    const navigate = useNavigate();
    const {
        isLoading,
        localizacaoAtual,
        localizacoesDisponiveis,
        operacoesDisponiveis,
        carregarLocalizacaoAtual,
        carregarLocalizacoesDisponiveis,
        selecionarLocalizacao,
        carregarOperacoesDisponiveis,
        executarOperacao
    } = usePonto();

    useEffect(() => {
        const loadInitialData = async () => {
            await carregarLocalizacaoAtual();
            await carregarLocalizacoesDisponiveis();
            await carregarOperacoesDisponiveis();
        };
        loadInitialData();
    }, []);

    const handleLocationChange = async (value: string) => {
        const localizacao = localizacoesDisponiveis.find(loc => loc.Valor === value);
        if (localizacao) {
            await selecionarLocalizacao(localizacao);
        }
    };

    const handleOperationSelect = async (operacao: TipoOperacao) => {
        try {
            await executarOperacao(operacao);
            // Navega de volta para o dashboard após operação bem-sucedida
            navigate('/dashboard');
        } catch (error) {
            // Em caso de erro, mantém na tela atual
            console.error('Erro ao executar operação:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Carregando...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <Card className="p-4">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-medium">Localização</h3>
                    </div>
                    <Select
                        value={localizacoesDisponiveis.find(loc => loc.Nome === localizacaoAtual)?.Valor}
                        onValueChange={handleLocationChange}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione a localização" />
                        </SelectTrigger>
                        <SelectContent>
                            {localizacoesDisponiveis.map((loc) => (
                                <SelectItem key={loc.Valor} value={loc.Valor}>
                                    {loc.Nome}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </Card>

            <Card className="p-4">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-medium">Operações Disponíveis</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {operacoesDisponiveis.map((operacao) => (
                            <Button
                                key={operacao}
                                variant="outline"
                                onClick={() => handleOperationSelect(operacao)}
                                className="justify-start"
                            >
                                {pontoService.getOperacaoDisplay(operacao)}
                            </Button>
                        ))}
                    </div>
                </div>
            </Card>
        </div>
    );
} 