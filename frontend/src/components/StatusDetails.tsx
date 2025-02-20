import { useSlackStatus } from '@/hooks/useSlackStatus';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Status } from '@/types/slack';

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
    return <span className="text-lg">{normalizedEmoji}</span>;
};

export default function StatusDetails() {
    const navigate = useNavigate();
    const { isLoading, currentStatus } = useSlackStatus();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-12">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <Card 
            className="p-2 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate('/slack/status')}
        >
            <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10">
                    {currentStatus ? (
                        <StatusEmoji emoji={currentStatus.emoji} />
                    ) : (
                        <span className="text-xs text-muted-foreground">?</span>
                    )}
                </div>
                <span className="text-sm font-medium line-clamp-1">
                    {currentStatus ? currentStatus.mensagem : 'Nenhum status definido'}
                </span>
            </div>
        </Card>
    );
} 