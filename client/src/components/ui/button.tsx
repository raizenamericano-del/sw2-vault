// shadcn/ui-style Button primitive: Radix Slot + cva, adapted to the STATUSVAULT design tokens.
import * as React from 'react';
import {Slot} from '@radix-ui/react-slot';
import {cva, type VariantProps} from 'class-variance-authority';
import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';
const cn=(...inputs:ClassValue[])=>twMerge(clsx(inputs));
const buttonVariants=cva('btn',{variants:{variant:{primary:'primary',secondary:'secondary',danger:'danger'},size:{default:'',wide:'wide'}},defaultVariants:{variant:'primary',size:'default'}});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,VariantProps<typeof buttonVariants>{asChild?:boolean}
export const Button=React.forwardRef<HTMLButtonElement,ButtonProps>(({className,variant,size,asChild=false,...props},ref)=>{const Comp=asChild?Slot:'button';return <Comp className={cn(buttonVariants({variant,size}),className)} ref={ref} {...props}/>});
Button.displayName='Button';
