import React from 'react';
import otLogo from '@/assets/images/ot.png';

/**
 * Normalizes emoji string to display format
 */
export const normalizeEmoji = (emoji: string): string => {
    // If emoji is an image URL (starts with /)
    if (emoji.startsWith('/')) {
        return emoji;
    }
    // If emoji starts with : and ends with :, extract the real emoji
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
    // If it's a unicode emoji
    return emoji;
};

interface StatusEmojiProps {
    emoji: string;
    className?: string;
}

/**
 * Component to display status emoji, handling both image URLs and unicode emojis
 */
export default function StatusEmoji({ emoji, className = '' }: StatusEmojiProps) {
    const normalizedEmoji = normalizeEmoji(emoji);
    
    // If emoji is an image URL
    if (normalizedEmoji.startsWith('/')) {
        return <img src={normalizedEmoji} alt="Status" className={`w-5 h-5 ${className}`} />;
    }
    // If it's a unicode emoji
    return <span className={`text-base ${className}`}>{normalizedEmoji}</span>;
} 