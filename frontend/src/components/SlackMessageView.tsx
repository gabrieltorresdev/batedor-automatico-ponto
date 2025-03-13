import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSlackManager } from '@/hooks/useSlackManager';
import { TipoMensagem } from '@/store/slack/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare } from 'lucide-react';
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
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
        </div>
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
        sendMessage,
        getPresetMessages
    } = useSlackManager();

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
            try {
                await sendMessage(selectedMessage);
                setShowConfirmDialog(false);
                setSelectedMessage(null);
            } catch (error) {
                console.error('Error sending message:', error);
            }
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
        <div className="flex flex-col gap-4">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Tipo de Mensagem</span>
                </div>
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

            {selectedType && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Selecione a Mensagem</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {getPresetMessages(selectedType).map((mensagem, index) => (
                            <MessageCard
                                key={index}
                                message={mensagem}
                                onClick={() => handleMessageSelect(mensagem)}
                            />
                        ))}
                    </div>
                </div>
            )}

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