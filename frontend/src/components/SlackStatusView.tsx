import { useState, useEffect } from 'react';
import { useSlackManager } from '@/hooks/useSlackManager';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Slack, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Status } from '@/store/slack/types';
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

const normalizeEmoji = (emoji: string) => {
    // Se o emoji for uma URL de imagem (começa com /)
    if (emoji.startsWith('/')) {
        return emoji;
    }
    // Se o emoji começar com : e terminar com :, extrai o emoji real
    if (emoji.startsWith(':') && emoji.endsWith(':')) {
        const emojiMap: Record<string, string> = {
            ':cama:': '🛏️',
            ':bed:': '🛏️',
            ':casa_com_jardim:': '🏡',
            ':house_with_garden:': '🏡',
            ':café:': '☕',
            ':coffee:': '☕',
            ':prato_garfo_faca:': '🍽️',
            ':knife_fork_plate:': '🍽️',
            ':ot:': '/src/assets/images/ot.png'
        };
        return emojiMap[emoji.toLowerCase()] || emoji;
    }
    // Se for um emoji unicode
    return emoji;
};

const StatusEmoji = ({ emoji }: { emoji: string }) => {
    const normalizedEmoji = normalizeEmoji(emoji);
    
    // Se o emoji for uma URL de imagem
    if (normalizedEmoji.startsWith('/')) {
        return <img src={normalizedEmoji} alt="Status" className="w-5 h-5" />;
    }
    // Se for um emoji unicode
    return <span className="text-base">{normalizedEmoji}</span>;
};

const StatusCard = ({ status, onClick }: { status: Status; onClick?: () => void }) => (
    <div 
        onClick={onClick}
        className={`flex h-12 items-center p-2 gap-2 rounded-lg transition-all duration-200 ${
            onClick ? 'hover:bg-accent cursor-pointer' : 'bg-card'
        }`}
    >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10">
            <div className="flex items-center justify-center">
                <StatusEmoji emoji={status.emoji} />
            </div>
        </div>
        <span className="text-sm font-medium line-clamp-1 text-start">
            {status.text}
        </span>
    </div>
);

export default function SlackStatusView() {
    const navigate = useNavigate();
    const {
        isLoading,
        currentStatus,
        setStatus,
        clearStatus,
        getStatusPresets
    } = useSlackManager();

    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const handleStatusSelect = (status: Status) => {
        setSelectedStatus(status);
        setShowConfirmDialog(true);
    };

    const handleConfirmStatus = async () => {
        if (selectedStatus) {
            try {
                await setStatus(selectedStatus);
                setShowConfirmDialog(false);
                setSelectedStatus(null);
            } catch (error) {
                console.error('Error setting status:', error);
            }
        }
    };

    const handleClearStatus = async () => {
        try {
            await clearStatus();
            setShowClearConfirm(false);
        } catch (error) {
            console.error('Error clearing status:', error);
        }
    };

    // Filtra o status atual da lista de presets
    const presets = getStatusPresets();
    const filteredPresets = presets.filter(preset => {
        if (!currentStatus) return true;
        
        // Normaliza os emojis antes de comparar
        const normalizedCurrentEmoji = normalizeEmoji(currentStatus.emoji);
        const normalizedPresetEmoji = normalizeEmoji(preset.emoji);
        
        // Normaliza as mensagens (remove espaços extras e converte para minúsculas)
        const normalizedCurrentMessage = currentStatus.text.toLowerCase().trim();
        const normalizedPresetMessage = preset.text.toLowerCase().trim();
        
        // Debug para verificar os valores
        console.debug('Comparando status:', {
            current: {
                emoji: currentStatus.emoji,
                normalizedEmoji: normalizedCurrentEmoji,
                message: normalizedCurrentMessage
            },
            preset: {
                emoji: preset.emoji,
                normalizedEmoji: normalizedPresetEmoji,
                message: normalizedPresetMessage
            }
        });
        
        // Retorna true se o status for diferente (mantém na lista)
        return normalizedCurrentEmoji !== normalizedPresetEmoji || 
               normalizedCurrentMessage !== normalizedPresetMessage;
    });

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
                    <Slack className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Status Atual</span>
                    {currentStatus && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowClearConfirm(true)}
                            className="text-muted-foreground hover:text-destructive ml-auto h-6 w-6"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    )}
                </div>
                <div>
                    {currentStatus ? (
                        <StatusCard status={currentStatus} />
                    ) : (
                        <div className="p-4 text-sm text-muted-foreground text-center">
                            Nenhum status definido
                        </div>
                    )}
                </div>
            </div>

            {/* Status Pré-definidos */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Slack className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground text-start">Novo Status</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                    {filteredPresets.map((status, index) => (
                        <StatusCard 
                            key={index}
                            status={status}
                            onClick={() => handleStatusSelect(status)}
                        />
                    ))}
                </div>
            </div>

            {/* Diálogo de confirmação para definir status */}
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Status</AlertDialogTitle>
                        <AlertDialogDescription>
                            {selectedStatus && (
                                <StatusCard status={selectedStatus} />
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmStatus}>
                            Confirmar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Diálogo de confirmação para limpar status */}
            <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Limpar Status</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja remover seu status atual?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearStatus}>
                            Confirmar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
} 