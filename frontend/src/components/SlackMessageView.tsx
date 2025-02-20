import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSlackMessage } from '@/hooks/useSlackMessage';
import { TipoMensagem } from '@/services/SlackService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MessageCard = ({ message, onClick }: { message: string; onClick?: () => void }) => (
    <div 
        onClick={onClick}
        className={`flex h-12 items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
            onClick ? 'hover:bg-accent cursor-pointer' : 'bg-card'
        }`}
    >
        <span className="text-sm font-medium line-clamp-1 text-start">{message}</span>
    </div>
);

const tiposMensagem: { tipo: TipoMensagem; label: string }[] = [
    { tipo: 'entrada', label: 'Entrada' },
    { tipo: 'refeicao', label: 'Almoço' },
    { tipo: 'saida', label: 'Saída' }
];

export default function SlackMessageView() {
    const navigate = useNavigate();
    const {
        isLoading,
        enviarMensagem,
        prepararMensagem,
        getMensagensPreset
    } = useSlackMessage();

    const [selectedType, setSelectedType] = useState<TipoMensagem | null>(null);
    const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    const handleTypeSelect = (tipo: TipoMensagem) => {
        setSelectedType(tipo);
        setSelectedMessage(null);
    };

    const handleMessageSelect = (mensagem: string) => {
        setSelectedMessage(mensagem);
        setShowConfirmDialog(true);
    };

    const handleConfirmMessage = async () => {
        if (selectedMessage) {
            enviarMensagem(selectedMessage, {
                onSuccess: () => {
                    setShowConfirmDialog(false);
                    setSelectedMessage(null);
                    navigate('/dashboard');
                }
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Carregando...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-xl mx-auto">
            {/* Seleção de Tipo */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Tipo de Mensagem</h3>
                <div className="grid grid-cols-3 gap-2">
                    {tiposMensagem.map(({ tipo, label }) => (
                        <Button
                            key={tipo}
                            onClick={() => handleTypeSelect(tipo)}
                            variant={selectedType === tipo ? "default" : "outline"}
                            className="h-12"
                        >
                            {label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Mensagens Predefinidas */}
            {selectedType && (
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground">Selecione a Mensagem</h3>
                    <Card className="p-2">
                        <div className="grid grid-cols-1 gap-2">
                            {getMensagensPreset(selectedType).map((mensagem, index) => (
                                <MessageCard
                                    key={index}
                                    message={mensagem}
                                    onClick={() => handleMessageSelect(mensagem)}
                                />
                            ))}
                        </div>
                    </Card>
                </div>
            )}

            {/* Diálogo de confirmação */}
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Mensagem</AlertDialogTitle>
                        <AlertDialogDescription>
                            {selectedMessage && (
                                <MessageCard message={selectedMessage} />
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmMessage}>
                            Enviar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
} 