import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowDownUp, Slack, MessageSquare, MapPin } from "lucide-react";
import { usePontoManager } from "@/hooks/usePontoManager";
import { useSlackManager } from "@/hooks/useSlackManager";
import { Status } from "@/store/slack/types";
import StatusEmoji from "@/components/StatusEmoji";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { normalizarOperacao, getOperacaoDisplay } from "@/store/ponto/actions";
import { Localizacao } from "@/store/ponto/types";
import { normalizeLocation, getDefaultStatus, getDefaultMessages } from "@/store/slack/actions";

interface PontoSlackResumoProps {
  onConfirm: (dados: { operacao: string | number; status: Status; mensagem: string }) => Promise<void>;
  onCancel: () => void;
}

const formSchema = z.object({
  localizacao: z.string().min(1, "Selecione"),
  operacao: z.string().min(1, "Selecione"),
  status: z.string().min(1, "Selecione"),
  mensagem: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function PontoSlackResumo({ onConfirm, onCancel }: PontoSlackResumoProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOperacoes, setIsLoadingOperacoes] = useState(false);
  const [localizacoes, setLocalizacoes] = useState<Localizacao[]>([]);
  const [operacoes, setOperacoes] = useState<Array<string | number>>([]);
  const [mensagensDisponiveis, setMensagensDisponiveis] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialLoadComplete = useRef(false);
  const pontoManager = usePontoManager();
  const slackManager = useSlackManager();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { localizacao: "", operacao: "", status: "", mensagem: "none" },
  });

  const atualizarStatusEMensagens = (operacao: string | number, loc: string) => {
    try {
      const operacaoNormalizada = normalizarOperacao(operacao);
      const localizacaoNormalizada = normalizarLocalizacao(loc);
      const novoStatus = getDefaultStatus(operacaoNormalizada, localizacaoNormalizada);
      form.setValue("status", JSON.stringify(novoStatus), { shouldValidate: true });
      const mensagens = getDefaultMessages(operacaoNormalizada);
      setMensagensDisponiveis(mensagens);
      form.setValue("mensagem", mensagens[0] || "none", { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    } catch (error) {
      console.error("Erro ao atualizar status e mensagens:", error);
    }
  };

  const normalizarLocalizacao = (localizacao: string): string => {
    return normalizeLocation(localizacao);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      const status = JSON.parse(values.status) as Status;
      await onConfirm({
        operacao: values.operacao,
        status,
        mensagem: values.mensagem === "none" ? "" : (values.mensagem || ""),
      });
    } catch (error) {
      console.error("Erro ao enviar formulário:", error);
      setIsSubmitting(false);
    }
  };

  const handleLocalizacaoChange = async (value: string) => {
    form.setValue("localizacao", value, { shouldValidate: true });
    setIsLoadingOperacoes(true);
    try {
      const localizacao = localizacoes.find((loc) => loc.Valor === value);
      if (localizacao) {
        await pontoManager.selecionarLocalizacao(localizacao);
        await fetchOperacoes(localizacao.Nome);
      }
    } catch (error) {
      console.error("Erro ao atualizar localização:", error);
    } finally {
      setIsLoadingOperacoes(false);
    }
  };

  const fetchOperacoes = async (locationName: string) => {
    try {
      console.log("Fetching operations for location:", locationName);
      const ops = await pontoManager.obterOperacoesDisponiveis();
      console.log("Operations received:", ops);
      
      if (!ops || ops.length === 0) {
        console.warn("No operations available for this location");
        setOperacoes([]);
        return;
      }
      
      setOperacoes(ops);
      const primeiraOperacao = ops[0];
      form.setValue("operacao", primeiraOperacao.toString(), { shouldValidate: true });
      atualizarStatusEMensagens(primeiraOperacao, locationName);
    } catch (error) {
      console.error("Error fetching operations:", error);
      setOperacoes([]);
    }
  };

  useEffect(() => {
    if (initialLoadComplete.current) {
      console.log("PontoSlackResumo already initialized, skipping");
      return;
    }

    const carregarDados = async () => {
      console.log("Initializing PontoSlackResumo");
      setIsLoading(true);
      
      try {
        let locAtual = pontoManager.localizacaoAtual;
        let locs = pontoManager.localizacoesDisponiveis;
        
        if (!locAtual || locs.length === 0) {
          console.log("Fetching locations as they're not loaded yet");
          
          try {
            const results = await Promise.all([
              pontoManager.obterLocalizacaoAtual(),
              pontoManager.obterLocalizacoesDisponiveis()
            ]);
            
            locAtual = results[0];
            locs = results[1];
            
            console.log("Current location:", locAtual);
            console.log("Available locations:", locs);
          } catch (error) {
            console.error("Error fetching location data:", error);
            setTimeout(() => {
              if (!initialLoadComplete.current) {
                carregarDados();
              }
            }, 2000);
            return;
          }
        } else {
          console.log("Using already loaded locations data");
          console.log("Current location:", locAtual);
          console.log("Available locations:", locs);
        }
        
        setLocalizacoes(locs);
        
        if (locs.length === 0) {
          console.warn("No locations available, waiting for data...");
          setIsLoading(false);
          initialLoadComplete.current = true;
          return;
        }
        
        const localizacaoAtual = locs.find((l) => l.Nome === locAtual);
        console.log("Selected location object:", localizacaoAtual);
        
        const locToUse = localizacaoAtual || locs[0];
        
        if (locToUse) {
          form.setValue("localizacao", locToUse.Valor, { shouldValidate: true });
          
          await pontoManager.selecionarLocalizacao(locToUse);
          
          setIsLoadingOperacoes(true);
          try {
            await fetchOperacoes(locToUse.Nome);
          } catch (error) {
            console.error("Error fetching operations:", error);
          }
          setIsLoadingOperacoes(false);
        } else {
          console.warn("Could not find any valid location to use");
        }
        
        initialLoadComplete.current = true;
        setIsLoading(false);
      } catch (error) {
        console.error("Unexpected error during data loading:", error);
        setIsLoading(false);
        initialLoadComplete.current = true;
      }
    };
    
    carregarDados();

    return () => {
      console.log("PontoSlackResumo component unmounted");
    };
  }, []);

  const handleOperacaoChange = (value: string) => {
    form.setValue("operacao", value, { shouldValidate: true });
    const localizacaoValue = form.getValues("localizacao");
    const localizacao = localizacoes.find((loc) => loc.Valor === localizacaoValue);
    if (localizacao) {
      atualizarStatusEMensagens(value, localizacao.Nome);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p className="mt-1 text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <FormField
            control={form.control}
            name="localizacao"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-sm flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Localização
                </FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={handleLocalizacaoChange}
                    disabled={isSubmitting || isLoadingOperacoes}
                  >
                    <SelectTrigger className="h-10 text-sm">
                      {isLoadingOperacoes ? (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Carregando...</span>
                        </div>
                      ) : (
                        <SelectValue placeholder="Selecione" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {localizacoes.map((loc) => (
                        <SelectItem key={loc.Valor} value={loc.Valor} className="text-sm py-0.5">
                          {loc.Nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="operacao"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-sm flex items-center gap-1">
                  <ArrowDownUp className="h-4 w-4" />
                  Operação
                </FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={handleOperacaoChange}
                    disabled={isSubmitting || operacoes.length === 0 || isLoadingOperacoes}
                  >
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {operacoes.map((op) => (
                        <SelectItem key={op.toString()} value={op.toString()} className="text-sm py-0.5">
                          {getOperacaoDisplay(op)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel className="text-sm flex items-center gap-1">
                <Slack className="h-4 w-4" />
                Status Slack
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger className="h-10 text-sm px-2">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="text-sm">
                  {slackManager.getStatusPresets().map((status, index) => (
                    <SelectItem
                      key={index}
                      value={JSON.stringify(status)}
                      className="text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <StatusEmoji emoji={status.emoji} size="lg" />
                        <span>{status.text}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="mensagem"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel className="text-sm flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                Mensagem (opcional)
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || "none"}
              >
                <FormControl>
                  <SelectTrigger className="h-10 text-sm px-2">
                    <SelectValue placeholder="Sem mensagem" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="text-sm">
                  <SelectItem value="none" className="text-sm py-0.5">Sem mensagem</SelectItem>
                  {mensagensDisponiveis.map((mensagem, index) => (
                    <SelectItem key={index} value={mensagem} className="text-sm py-0.5">
                      {mensagem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-1.5 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            size="sm"
            className="h-10 text-sm px-2"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            size="sm"
            className="h-10 text-sm px-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Enviando
              </>
            ) : (
              'Confirmar'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
