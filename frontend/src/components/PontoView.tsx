import { useState, useEffect } from "react";
import { usePonto } from "@/hooks/usePonto";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Clock } from "lucide-react";
import { Localizacao, TipoOperacao } from "@/services/PontoService";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pontoService } from "@/services/PontoService";

export default function PontoView() {
  const navigate = useNavigate();
  const [isLoadingOperacoes, setIsLoadingOperacoes] = useState(false);
  const {
    isLoading,
    localizacaoAtual,
    localizacoesDisponiveis,
    operacoesDisponiveis,
    carregarLocalizacaoAtual,
    carregarLocalizacoesDisponiveis,
    selecionarLocalizacao,
    carregarOperacoesDisponiveis,
    executarOperacao,
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
    setIsLoadingOperacoes(true);
    try {
      const localizacao = localizacoesDisponiveis.find(
        (loc) => loc.Valor === value
      );
      if (localizacao) {
        await selecionarLocalizacao(localizacao);
        await carregarOperacoesDisponiveis();
      }
    } catch (error) {
      console.error("Erro ao atualizar localização:", error);
    } finally {
      setIsLoadingOperacoes(false);
    }
  };

  const handleOperationSelect = async (operacao: TipoOperacao) => {
    if (isLoadingOperacoes) return;
    try {
      await executarOperacao(operacao);
      navigate("/dashboard");
    } catch (error) {
      console.error("Erro ao executar operação:", error);
    }
  };

  if (isLoading) {
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
          disabled={isLoadingOperacoes}
        >
          <SelectTrigger className="h-8 text-xs">
            {isLoadingOperacoes ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Carregando...</span>
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
              disabled={isLoadingOperacoes}
            >
              {pontoService.getOperacaoDisplay(operacao)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
