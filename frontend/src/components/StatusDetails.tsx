import { useSlackStatus } from '@/hooks/useSlackStatus';
import { Skeleton } from '@/components/ui/skeleton';

const normalizeEmoji = (emoji: string) => {
    if (emoji.startsWith('/')) {
        return emoji;
    }
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
    return emoji;
};

const StatusEmoji = ({ emoji }: { emoji: string }) => {
    const normalizedEmoji = normalizeEmoji(emoji);
    
    if (normalizedEmoji.startsWith('/')) {
        return <img src={normalizedEmoji} alt="Status" className="w-5 h-5" />;
    }
    return <span className="text-base">{normalizedEmoji}</span>;
};

export default function StatusDetails() {
    const { isLoading, currentStatus } = useSlackStatus();

    if (isLoading) {
        return (
            <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-24" />
            </div>
        );
    }

    return (
        <div className="flex items-baseline gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10">
                {currentStatus ? (
                    <div className="flex items-center justify-center">
                        <StatusEmoji emoji={currentStatus.emoji} />
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">?</span>
                )}
            </div>
            <span className="text-sm font-medium line-clamp-1 text-start">
                {currentStatus ? currentStatus.mensagem : 'Nenhum status definido'}
            </span>
        </div>
    );
} 