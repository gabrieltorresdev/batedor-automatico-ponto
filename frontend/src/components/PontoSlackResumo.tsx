import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { usePontoManager } from "@/hooks/usePontoManager";
import { useSlackManager } from "@/hooks/useSlackManager";
import { Status } from "@/store/slack/types";
import StatusEmoji from "@/components/StatusEmoji";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { normalizarOperacao, getOperacaoDisplay } from "@/store/ponto/actions";
import { Localizacao } from "@/store/ponto/types";
import { normalizeLocation, getDefaultStatus, getDefaultMessages } from "@/store/slack/actions";
import React from "react";

interface PontoSlackResumoProps {
  onConfirm: (dados: { operacao: string | number; status: Status; mensagem: string }) => Promise<void>;
  onCancel: () => void;
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
  const pontoManager = usePontoManager();
  const slackManager = useSlackManager();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { localizacao: "", operacao: "", status: "", mensagem: "" },
  });

  const atualizarStatusEMensagens = (operacao: string | number, loc: string) => {
    try {
      const operacaoNormalizada = normalizarOperacao(operacao);
      const localizacaoNormalizada = normalizarLocalizacao(loc);
      const novoStatus = getDefaultStatus(operacaoNormalizada, localizacaoNormalizada);
      form.setValue("status", JSON.stringify(novoStatus), { shouldValidate: true });
      const mensagens = getDefaultMessages(operacaoNormalizada);
      setMensagensDisponiveis(mensagens);
      form.setValue("mensagem", mensagens[0] || "", { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    } catch (error) {
      console.error("Erro ao atualizar status e mensagens:", error);
    }
  };

  // Função auxiliar para normalizar localização
  const normalizarLocalizacao = (localizacao: string): string => {
    return normalizeLocation(localizacao);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const status = JSON.parse(values.status) as Status;
      await onConfirm({
        operacao: values.operacao,
        status,
        mensagem: values.mensagem || "",
      });
    } catch (error) {
      console.error("Erro ao enviar formulário:", error);
    }
  };

  const handleLocalizacaoChange = async (value: string) => {
    form.setValue("localizacao", value, { shouldValidate: true });
    setIsLoadingOperacoes(true);
    try {
      const localizacao = localizacoes.find((loc) => loc.Valor === value);
      if (localizacao) {
        await pontoManager.selecionarLocalizacao(localizacao);
        const ops = await pontoManager.obterOperacoesDisponiveis();
        setOperacoes(ops);
        if (ops.length > 0) {
          const primeiraOperacao = ops[0];
          form.setValue("operacao", primeiraOperacao.toString(), { shouldValidate: true });
          atualizarStatusEMensagens(primeiraOperacao, localizacao.Nome);
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar localização:", error);
    } finally {
      setIsLoadingOperacoes(false);
    }
  };

  useEffect(() => {
    const carregarDados = async () => {
      setIsLoading(true);
      try {
        const [locAtual, locs] = await Promise.all([
          pontoManager.obterLocalizacaoAtual(),
          pontoManager.obterLocalizacoesDisponiveis(),
        ]);
        setLocalizacoes(locs);
        const localizacaoAtual = locs.find((l) => l.Nome === locAtual);
        if (localizacaoAtual) {
          form.setValue("localizacao", localizacaoAtual.Valor, { shouldValidate: true });
          setIsLoadingOperacoes(true);
          const ops = await pontoManager.obterOperacoesDisponiveis();
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
    <Card className="p-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="localizacao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Localização</FormLabel>
                <Select
                  onValueChange={(value) => handleLocalizacaoChange(value)}
                  value={field.value}
                  disabled={isLoadingOperacoes}
                >
                  <FormControl>
                    <SelectTrigger>
                      {isLoadingOperacoes ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Carregando...</span>
                        </div>
                      ) : (
                        <SelectValue placeholder="Selecione a localização" />
                      )}
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {localizacoes.map((loc) => (
                      <SelectItem key={loc.Valor} value={loc.Valor}>
                        {loc.Nome}
                      </SelectItem>
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
                <FormLabel>Operação</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    const localizacaoAtual = localizacoes.find(
                      (loc) => loc.Valor === form.getValues("localizacao")
                    );
                    if (localizacaoAtual) {
                      atualizarStatusEMensagens(value, localizacaoAtual.Nome);
                    }
                  }}
                  value={field.value}
                  disabled={isLoadingOperacoes}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a operação" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {operacoes.map((op) => (
                      <SelectItem key={op.toString()} value={op.toString()}>
                        {getOperacaoDisplay(op)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status no Slack</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {slackManager.getStatusPresets().map((status, index) => (
                      <SelectItem
                        key={index}
                        value={JSON.stringify(status)}
                      >
                        <div className="flex items-center gap-2">
                          <StatusEmoji emoji={status.emoji} />
                          <span>{status.text}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mensagem"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mensagem no Slack</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a mensagem" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {mensagensDisponiveis.map((msg, index) => (
                      <SelectItem key={index} value={msg}>
                        {msg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              Confirmar
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  );
}
