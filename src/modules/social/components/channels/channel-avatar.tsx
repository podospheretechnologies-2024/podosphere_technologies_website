import Image from 'next/image';
import { cn } from '@/shared/lib/cn';

type AvatarSize = 'xs' | 'sm' | 'md';

const sizeClasses: Record<AvatarSize, { box: string; pixels: number }> = {
  xs: { box: 'size-5 text-[10px]', pixels: 20 },
  sm: { box: 'size-7 text-xs', pixels: 28 },
  md: { box: 'size-11 text-sm', pixels: 44 },
};

interface ChannelAvatarProps {
  name: string;
  picture: string | null;
  size?: AvatarSize;
  className?: string;
}

export function ChannelAvatar({ name, picture, size = 'md', className }: ChannelAvatarProps) {
  const { box, pixels } = sizeClasses[size];

  return (
    <div
      className={cn(
        'bg-primary/15 text-primary relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold',
        box,
        className
      )}
    >
      {picture ? (
        <Image
          src={picture}
          alt=""
          fill
          unoptimized
          sizes={`${pixels}px`}
          className="object-cover"
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}
