import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { usePontoStore } from "@/store/pontoStore";
import { slackService, TipoOperacao } from "@/services/SlackService";
import { Status } from "@/types/slack";
import StatusEmoji from "@/components/StatusEmoji";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";

interface PontoSlackResumoProps {
    onConfirm: (dados: {
        operacao: string | number;
        status: Status;
        mensagem: string;
    }) => Promise<void>;
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
    const [localizacoes, setLocalizacoes] = useState<{ Nome: string; Valor: string }[]>([]);
    const [operacoes, setOperacoes] = useState<Array<string | number>>([]);
    const [mensagensDisponiveis, setMensagensDisponiveis] = useState<string[]>([]);
    
    const pontoStore = usePontoStore();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            localizacao: '',
            operacao: '',
            status: '',
            mensagem: '',
        },
    });

    // Função auxiliar para normalizar operação
    const normalizarOperacao = (operacao: string | number): TipoOperacao => {
        if (typeof operacao === 'number') {
            switch (operacao) {
                case 0: return 'entrada';
                case 1: return 'almoco';
                case 2: return 'saida';
                default: return 'entrada';
            }
        }

        const operacaoLower = operacao.toLowerCase();
        if (operacaoLower.includes('entrada')) return 'entrada';
        if (operacaoLower.includes('refeição') || operacaoLower.includes('almoço')) return 'almoco';
        if (operacaoLower.includes('saída') || operacaoLower.includes('saida')) return 'saida';
        return 'entrada';
    };

    // Atualiza status e mensagens quando a operação ou localização muda
    const atualizarStatusEMensagens = (operacao: string | number, loc: string) => {
        const operacaoNormalizada = normalizarOperacao(operacao);
        
        // Atualiza o status
        const novoStatus = slackService.getDefaultStatus(operacaoNormalizada, loc);
        form.setValue('status', JSON.stringify(novoStatus));

        // Atualiza as mensagens disponíveis
        const mensagens = slackService.getDefaultMensagens(operacaoNormalizada);
        setMensagensDisponiveis(mensagens);
        if (mensagens.length > 0) {
            form.setValue('mensagem', mensagens[0]);
        }
    };

    // Carrega os dados iniciais
    useEffect(() => {
        const carregarDados = async () => {
            setIsLoading(true);
            try {
                const [loc, locs, ops] = await Promise.all([
                    pontoStore.obterLocalizacaoAtual(),
                    pontoStore.obterLocalizacoesDisponiveis(),
                    pontoStore.obterOperacoesDisponiveis()
                ]);
                setLocalizacoes(locs);
                setOperacoes(ops);
                
                form.setValue('localizacao', loc);
                
                // Se só tiver uma operação disponível, seleciona ela
                if (ops.length === 1) {
                    form.setValue('operacao', ops[0].toString());
                    atualizarStatusEMensagens(ops[0], loc);
                }
            } catch (error) {
                console.error('Erro ao carregar dados:', error);
            } finally {
                setIsLoading(false);
            }
        };
        carregarDados();
    }, []);

    const onSubmit = async (data: FormValues) => {
        const status: Status = JSON.parse(data.status);
        await onConfirm({
            operacao: data.operacao,
            status,
            mensagem: data.mensagem || 'ok'
        });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="mt-1 text-xs text-muted-foreground">Carregando...</p>
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2 w-full max-w-[300px] mx-auto">
                {/* Localização e Operação em uma única card */}
                <Card className="p-2">
                    <div className="space-y-2">
                        {/* Localização */}
                        <FormField
                            control={form.control}
                            name="localizacao"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-semibold text-muted-foreground">Localização</FormLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            const loc = localizacoes.find(l => l.Valor === value);
                                            if (loc) {
                                                pontoStore.selecionarLocalizacao(loc).then(async () => {
                                                    const ops = await pontoStore.obterOperacoesDisponiveis();
                                                    setOperacoes(ops);
                                                    if (ops.length === 1) {
                                                        form.setValue('operacao', ops[0].toString());
                                                        atualizarStatusEMensagens(ops[0], loc.Nome);
                                                    }
                                                });
                                            }
                                        }}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="h-8 text-sm">
                                                <SelectValue placeholder="Selecione a localização" />
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
                        
                        {/* Operação */}
                        <FormField
                            control={form.control}
                            name="operacao"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-semibold text-muted-foreground">Operação</FormLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            const loc = localizacoes.find(l => l.Valor === form.getValues('localizacao'));
                                            if (loc) {
                                                atualizarStatusEMensagens(value, loc.Nome);
                                            }
                                        }}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="h-8 text-sm">
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {operacoes.map((op) => (
                                                <SelectItem key={op.toString()} value={op.toString()}>
                                                    {normalizarOperacao(op)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </Card>

                {/* Status e Mensagem em uma única card */}
                {(form.watch('status') || mensagensDisponiveis.length > 0) && (
                    <Card className="p-2">
                        <div className="space-y-2">
                            {/* Status */}
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold text-muted-foreground">Status</FormLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="h-8 text-sm">
                                                    <SelectValue>
                                                        {field.value && (
                                                            <div className="flex items-center gap-2">
                                                                <StatusEmoji emoji={JSON.parse(field.value).emoji} className="w-4 h-4" />
                                                                <span className="truncate">{JSON.parse(field.value).mensagem}</span>
                                                            </div>
                                                        )}
                                                    </SelectValue>
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {slackService.getStatusPresets().map((status, index) => (
                                                    <SelectItem 
                                                        key={index} 
                                                        value={JSON.stringify(status)}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <StatusEmoji emoji={status.emoji} className="w-4 h-4" />
                                                            <span className="truncate">{status.mensagem}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            {/* Mensagem */}
                            {mensagensDisponiveis.length > 0 && (
                                <FormField
                                    control={form.control}
                                    name="mensagem"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-semibold text-muted-foreground">Mensagem</FormLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="h-8 text-sm">
                                                        <SelectValue placeholder="Selecione" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {mensagensDisponiveis.map((msg) => (
                                                        <SelectItem key={msg} value={msg}>
                                                            {msg}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    </Card>
                )}

                {/* Ações */}
                <div className="flex justify-end gap-2">
                    <Button 
                        variant="outline" 
                        onClick={onCancel}
                        type="button"
                        className="h-8 text-xs"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        className="h-8 text-xs"
                    >
                        Confirmar
                    </Button>
                </div>
            </form>
        </Form>
    );
} 