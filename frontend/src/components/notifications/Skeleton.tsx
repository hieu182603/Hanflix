function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ');
}

export type SkeletonShape = 'rect' | 'circle' | 'text';
export type SkeletonSize = 'sm' | 'md' | 'lg';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  shape?: SkeletonShape;
  size?: SkeletonSize;
  className?: string;
  'aria-label'?: string;
}

const SIZE_CLASS: Record<SkeletonShape, Record<SkeletonSize, string>> = {
  rect: { sm: 'h-3 w-16', md: 'h-4 w-32', lg: 'h-6 w-48' },
  circle: { sm: 'h-6 w-6', md: 'h-10 w-10', lg: 'h-16 w-16' },
  text: { sm: 'h-3 w-full', md: 'h-4 w-full', lg: 'h-5 w-full' },
};

const SHAPE_CLASS: Record<SkeletonShape, string> = {
  rect: 'rounded-md',
  circle: 'rounded-full',
  text: 'rounded',
};

export function Skeleton({
  width,
  height,
  shape = 'rect',
  size = 'md',
  className,
  ...rest
}: SkeletonProps) {
  const sizeClass = SIZE_CLASS[shape][size];
  const style: React.CSSProperties = {};
  if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height;
  return (
    <div
      className={cn('animate-pulse bg-[#F2E4D8]', SHAPE_CLASS[shape], sizeClass, className)}
      style={style}
      aria-hidden="true"
      role="presentation"
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}

export function SkeletonText({ lines = 3, className, lastLineWidth = 'w-2/3' }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} shape="text" size="md" className={i === lines - 1 ? lastLineWidth : 'w-full'} />
      ))}
    </div>
  );
}
