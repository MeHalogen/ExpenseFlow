import { HTMLAttributes } from 'react'; import { cn } from '@/lib/utils'
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn('glass rounded-3xl p-4', className)} {...props} /> }
