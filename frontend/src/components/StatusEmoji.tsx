import otLogo from '@/assets/images/ot.png';

interface StatusEmojiProps {
    emoji: string;
    className?: string;
}

export default function StatusEmoji({ emoji, className = "w-5 h-5" }: StatusEmojiProps) {
    // Se o emoji for uma URL de imagem (começa com /)
    if (emoji.startsWith('/')) {
        return <img src={otLogo} alt="Status" className={className} />;
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
            ':ot:': otLogo
        };
        const normalizedEmoji = emojiMap[emoji.toLowerCase()] || emoji;
        if (normalizedEmoji === otLogo) {
            return <img src={otLogo} alt="Status" className={className} />;
        }
        return <span className="text-lg">{normalizedEmoji}</span>;
    }
    
    // Se for um emoji unicode
    return <span className="text-lg">{emoji}</span>;
} 