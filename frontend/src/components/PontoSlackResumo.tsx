import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { usePontoStore } from "@/store/pontoStore";
import { slackService } from "@/services/SlackService";
import { Status } from "@/types/slack";
import StatusEmoji from "@/components/StatusEmoji";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { pontoService } from "@/services/PontoService";
import React from "react";

interface PontoSlackResumoProps {
  onConfirm: (dados: { operacao: string | number; status: Status; mensagem: string }) => Promise<void>;
  onCancel: () => void;
}

interface Localizacao {
  Nome: string;
  Valor: string;
}

const formSchema = z.object({
  localizacao: z.string().min(1, "Selecione uma localização"),
  operacao: z.string().min(1, "Selecione uma operação"),
  status: z.string().min(1, "Selecione um status"),
  mensagem: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function PontoSlackResumo({ onConfirm, onCancel }: PontoSlackResumoProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOperacoes, setIsLoadingOperacoes] = useState(false);
  const [localizacoes, setLocalizacoes] = useState<Localizacao[]>([]);
  const [operacoes, setOperacoes] = useState<Array<string | number>>([]);
  const [mensagensDisponiveis, setMensagensDisponiveis] = useState<string[]>([]);
  const pontoStore = usePontoStore();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { localizacao: "", operacao: "", status: "", mensagem: "" },
  });

  const atualizarStatusEMensagens = (operacao: string | number, loc: string) => {
    try {
      const operacaoNormalizada = pontoService.normalizarOperacao(operacao);
      const localizacaoNormalizada = pontoService.normalizarLocalizacao(loc);
      const novoStatus = slackService.getDefaultStatus(operacaoNormalizada, localizacaoNormalizada);
      form.setValue("status", JSON.stringify(novoStatus), { shouldValidate: true });
      const mensagens = slackService.getDefaultMensagens(operacaoNormalizada);
      setMensagensDisponiveis(mensagens);
      form.setValue("mensagem", mensagens[0] || "", { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    } catch (error) {
      console.error("Erro ao atualizar status e mensagens:", error);
    }
  };

  const handleLocalizacaoChange = async (value: string) => {
    const loc = localizacoes.find((l) => l.Valor === value);
    if (!loc) return;

    setIsLoadingOperacoes(true);
    try {
      await pontoStore.selecionarLocalizacao(loc);
      const novaLocalizacao = await pontoStore.obterLocalizacaoAtual();
      form.setValue("localizacao", value, { shouldValidate: true });
      const ops = await pontoStore.obterOperacoesDisponiveis();
      setOperacoes(ops);

      if (ops.length > 0) {
        const primeiraOperacao = ops[0].toString();
        form.setValue("operacao", primeiraOperacao);
        atualizarStatusEMensagens(primeiraOperacao, novaLocalizacao);
      } else {
        form.setValue("operacao", "");
        form.setValue("status", "");
        setMensagensDisponiveis([]);
      }
    } catch (error) {
      console.error("Erro ao atualizar localização:", error);
    } finally {
      setIsLoadingOperacoes(false);
    }
  };

  const handleOperacaoChange = (value: string) => {
    form.setValue("operacao", value, { shouldValidate: true });
    const loc = localizacoes.find((l) => l.Valor === form.getValues("localizacao"));
    if (loc) atualizarStatusEMensagens(value, loc.Nome);
  };

  const onSubmit = async (data: FormValues) => {
    if (isLoadingOperacoes) return;
    try {
      const status: Status = JSON.parse(data.status);
      const operacao = pontoService.normalizarOperacao(data.operacao);
      await onConfirm({ operacao, status, mensagem: data.mensagem || "ok" });
    } catch (error) {
      console.error("Erro ao submeter formulário:", error);
    }
  };

  useEffect(() => {
    const carregarDados = async () => {
      setIsLoading(true);
      try {
        const [locAtual, locs] = await Promise.all([
          pontoStore.obterLocalizacaoAtual(),
          pontoStore.obterLocalizacoesDisponiveis(),
        ]);
        setLocalizacoes(locs);
        const localizacaoAtual = locs.find((l) => l.Nome === locAtual);
        if (localizacaoAtual) {
          form.setValue("localizacao", localizacaoAtual.Valor, { shouldValidate: true });
          setIsLoadingOperacoes(true);
          const ops = await pontoStore.obterOperacoesDisponiveis();
          setOperacoes(ops);
          if (ops.length > 0) {
            const primeiraOperacao = ops[0];
            form.setValue("operacao", primeiraOperacao.toString(), { shouldValidate: true });
            atualizarStatusEMensagens(primeiraOperacao, locAtual);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingOperacoes(false);
      }
    };
    carregarDados();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p className="mt-1 text-xs text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          <FormField
            control={form.control}
            name="localizacao"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-muted-foreground">Localização</FormLabel>
                <Select value={field.value} onValueChange={handleLocalizacaoChange} disabled={isLoadingOperacoes}>
                  <FormControl>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione a localização" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {localizacoes.map((loc) => (
                      <SelectItem key={loc.Valor} value={loc.Valor}>{loc.Nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="operacao"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-muted-foreground">Operação</FormLabel>
                <Select value={field.value} onValueChange={handleOperacaoChange} disabled={isLoadingOperacoes || !operacoes.length}>
                  <FormControl>
                    <SelectTrigger className="h-8 text-xs">
                      {isLoadingOperacoes ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Carregando...</span>
                        </div>
                      ) : (
                        <SelectValue placeholder="Selecione">
                          {field.value && pontoService.getOperacaoDisplay(field.value)}
                        </SelectValue>
                      )}
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {operacoes.map((op) => (
                      <SelectItem key={op.toString()} value={op.toString()}>
                        {pontoService.getOperacaoDisplay(op)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {(form.watch("status") || mensagensDisponiveis.length > 0) && (
          <div className="flex flex-col gap-2">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecione o status">
                          {field.value && (
                            <div className="flex items-center gap-2">
                              <StatusEmoji emoji={JSON.parse(field.value).emoji} className="w-3 h-3" />
                              <span>{JSON.parse(field.value).mensagem}</span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {slackService.getStatusPresets().map((status, index) => (
                        <SelectItem key={index} value={JSON.stringify(status)}>
                          <div className="flex items-center gap-2">
                            <StatusEmoji emoji={status.emoji} className="w-3 h-3" />
                            <span>{status.mensagem}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mensagensDisponiveis.length > 0 && (
              <FormField
                control={form.control}
                name="mensagem"
                render={({ field: { onChange, value, ...field } }) => {
                  const currentValue = value || mensagensDisponiveis[0];
                  React.useEffect(() => {
                    if (!value && mensagensDisponiveis.length) {
                      onChange(mensagensDisponiveis[0]);
                      form.setValue("mensagem", mensagensDisponiveis[0], {
                        shouldValidate: true,
                        shouldDirty: true,
                        shouldTouch: true,
                      });
                    }
                  }, [value, mensagensDisponiveis]);

                  return (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground">Mensagem</FormLabel>
                      <Select value={currentValue} onValueChange={(newValue) => {
                        onChange(newValue);
                        form.setValue("mensagem", newValue, {
                          shouldValidate: true,
                          shouldDirty: true,
                          shouldTouch: true,
                        });
                      }}>
                        <FormControl>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue>{currentValue}</SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {mensagensDisponiveis.map((mensagem, index) => (
                            <SelectItem key={index} value={mensagem}>{mensagem}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onCancel} type="button" className="h-8 text-xs">Cancelar</Button>
          <Button type="submit" className="h-8 text-xs">Confirmar</Button>
        </div>
      </form>
    </Form>
  );
}
