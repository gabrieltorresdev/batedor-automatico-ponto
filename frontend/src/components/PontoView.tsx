import { useState, useEffect } from "react";
import { usePontoManager } from "@/hooks/usePontoManager";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Clock, RefreshCw } from "lucide-react";
import { Localizacao, TipoOperacao } from "@/store/ponto/types";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getOperacaoDisplay } from "@/store/ponto/actions";

export default function PontoView() {
  const navigate = useNavigate();
  const [isLoadingOperacoes, setIsLoadingOperacoes] = useState(false);
  const pontoManager = usePontoManager();
  const {
    isLoading,
    localizacaoAtual,
    localizacoesDisponiveis,
    operacoesDisponiveis,
    obterLocalizacaoAtual,
    obterLocalizacoesDisponiveis,
    selecionarLocalizacao,
    obterOperacoesDisponiveis,
    executarOperacao,
    retryStatus
  } = pontoManager;

  useEffect(() => {
    const loadInitialData = async () => {
      await obterLocalizacaoAtual();
      await obterLocalizacoesDisponiveis();
      await obterOperacoesDisponiveis();
    };
    loadInitialData();
  }, []);

  const handleLocationChange = async (value: string) => {
    setIsLoadingOperacoes(true);
    try {
      const localizacao = localizacoesDisponiveis.find(
        (loc) => loc.Valor === value
      );
      if (localizacao) {
        await selecionarLocalizacao(localizacao);
        await obterOperacoesDisponiveis();
      }
    } catch (error) {
      console.error("Erro ao atualizar localização:", error);
    } finally {
      setIsLoadingOperacoes(false);
    }
  };

  const handleOperationSelect = async (operacao: TipoOperacao) => {
    if (isLoadingOperacoes || retryStatus.isRetrying) return;
    try {
      await executarOperacao(operacao);
      // Navigation is handled by the hook
    } catch (error) {
      console.error("Erro ao executar operação:", error);
    }
  };

  const isRetrying = retryStatus.isRetrying;
  const activeRetry = retryStatus.active;

  if (isLoading && !isRetrying) {
    return (
      <div className="flex flex-col items-center justify-center p-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p className="mt-1 text-xs text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Localização
          </span>
        </div>
        <Select
          value={
            localizacoesDisponiveis.find((loc) => loc.Nome === localizacaoAtual)
              ?.Valor
          }
          onValueChange={handleLocationChange}
          disabled={isLoadingOperacoes || isRetrying}
        >
          <SelectTrigger className="h-8 text-xs">
            {isLoadingOperacoes || (isRetrying && retryStatus.localizacao.isRetrying) ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>
                  {isRetrying && retryStatus.localizacao.isRetrying 
                    ? `Tentativa ${activeRetry?.attempt || 0}/${activeRetry?.maxAttempts || 3}` 
                    : "Carregando..."}
                </span>
              </div>
            ) : (
              <SelectValue placeholder="Selecione a localização" />
            )}
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

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Operações Disponíveis
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {operacoesDisponiveis.map((operacao) => (
            <Button
              key={operacao}
              onClick={() => handleOperationSelect(operacao)}
              variant="outline"
              className="h-8 text-xs justify-start"
              disabled={isLoadingOperacoes || isRetrying}
            >
              {isRetrying && retryStatus.execucao.isRetrying ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin mr-2" />
                  <span>
                    Tentativa {activeRetry?.attempt || 0}/{activeRetry?.maxAttempts || 3}
                  </span>
                </div>
              ) : (
                getOperacaoDisplay(operacao)
              )}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
