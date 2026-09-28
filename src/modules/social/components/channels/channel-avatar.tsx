import Image from 'next/image';
import { cn } from '@/shared/lib/cn';

interface ChannelAvatarProps {
  name: string;
  picture: string | null;
  className?: string;
}

export function ChannelAvatar({ name, picture, className }: ChannelAvatarProps) {
  return (
    <div
      className={cn(
        'bg-primary/15 text-primary relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold',
        className
      )}
    >
      {picture ? (
        <Image src={picture} alt="" fill unoptimized sizes="44px" className="object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}
