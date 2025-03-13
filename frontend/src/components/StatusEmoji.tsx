import React from 'react';
import otLogo from '@/assets/images/ot.png';

export const normalizeEmoji = (emoji: string): string => {
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

type StatusEmojiSize = 'xs' | 'sm' | 'md' | 'lg';

interface StatusEmojiProps {
    emoji: string;
    className?: string;
    size?: StatusEmojiSize;
}

export default function StatusEmoji({ emoji, className = '', size = 'md' }: StatusEmojiProps) {
    const normalizedEmoji = normalizeEmoji(emoji);
    
    const sizeClasses = {
        xs: 'w-3 h-3 text-xs',
        sm: 'w-4 h-4 text-sm',
        md: 'w-5 h-5 text-base',
        lg: 'w-6 h-6 text-lg',
    };
    
    if (normalizedEmoji.startsWith('/')) {
        return <img src={normalizedEmoji} alt="Status" className={`${sizeClasses[size]} ${className}`} />;
    }
    return <span className={`${sizeClasses[size]} ${className}`}>{normalizedEmoji}</span>;
}