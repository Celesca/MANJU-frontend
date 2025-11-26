'use client';

import React, {
    Children,
    cloneElement,
    forwardRef,
    isValidElement,
    useEffect,
    useLayoutEffect, // Used for initial placement to prevent FOUC
    useMemo,
    useRef,
    type ReactNode, // FIX: Use type-only import for ReactNode
    type RefObject, // FIX: Use type-only import for RefObject
    type ReactElement // FIX: Import ReactElement type
} from 'react';
import gsap from 'gsap';

// --- Type Definitions ---

/** Props for the main CardSwap container component. */
export interface CardSwapProps {
    width?: number | string;
    height?: number | string;
    cardDistance?: number;
    verticalDistance?: number;
    delay?: number;
    pauseOnHover?: boolean;
    onCardClick?: (idx: number) => void;
    skewAmount?: number;
    easing?: 'linear' | 'elastic';
    children: ReactNode;
}

/** Props for the individual Card component. */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    customClass?: string;
}

/** The structure representing the computed position/transform for a card. */
interface Slot {
    x: number;
    y: number;
    z: number;
    zIndex: number;
}

// --- Card Component (Styled) ---

/**
 * Individual card component. Uses forwardRef for GSAP manipulation.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(({ customClass, ...rest }, ref) => (
    <div
        ref={ref}
        {...rest}
        // Added some stylistic touches (backdrop-blur) and improved border/shadow for visual appeal
        className={`absolute top-1/2 left-1/2 rounded-xl border border-white/20 bg-black/50 backdrop-blur-sm shadow-xl cursor-pointer
            [transform-style:preserve-3d] [will-change:transform] [backface-visibility:hidden] 
            ${customClass ?? ''} ${rest.className ?? ''}`.trim()}
    />
));
Card.displayName = 'Card';

// --- Utility Functions ---

// FIX: CardRef must include 'null' as createRef is initialized with null
type CardRef = RefObject<HTMLDivElement | null>; 

/**
 * Calculates the 3D position (slot) for a card based on its index.
 */
const makeSlot = (i: number, distX: number, distY: number, total: number): Slot => ({
    x: i * distX,
    y: -i * distY,
    z: -i * distX * 1.5,
    zIndex: total - i
});

/**
 * Immediately sets the initial 3D position and skew of an element using GSAP.
 */
const placeNow = (el: HTMLElement, slot: Slot, skew: number) =>
    gsap.set(el, {
        x: slot.x,
        y: slot.y,
        z: slot.z,
        xPercent: -50,
        yPercent: -50,
        skewY: skew,
        transformOrigin: 'center center',
        zIndex: slot.zIndex,
        force3D: true
    });


// --- Main CardSwap Component ---

const CardSwap: React.FC<CardSwapProps> = ({
    width = 500,
    height = 400,
    cardDistance = 60,
    verticalDistance = 70,
    delay = 5000,
    pauseOnHover = false,
    onCardClick,
    skewAmount = 6,
    easing = 'elastic',
    children
}) => {
    // Configuration object derived from the 'easing' prop (using useMemo for optimization)
    const config = useMemo(() => easing === 'elastic'
        ? {
            ease: 'elastic.out(0.6,0.9)',
            durDrop: 2,
            durMove: 2,
            durReturn: 2,
            promoteOverlap: 0.9,
            returnDelay: 0.05
        }
        : {
            ease: 'power1.inOut',
            durDrop: 0.8,
            durMove: 0.8,
            durReturn: 0.8,
            promoteOverlap: 0.45,
            returnDelay: 0.2
        }, [easing]);

    // Use ReactElement type which is now imported
    const childArr = useMemo(() => Children.toArray(children).filter(isValidElement) as ReactElement<CardProps>[], [children]);
    
    // The type CardRef is now correct, so this is valid.
    const refs = useMemo<CardRef[]>(() => childArr.map(() => React.createRef<HTMLDivElement>()), [childArr.length]);
    
    // Store the order of card indices. Start with [0, 1, 2, ...]
    const order = useRef<number[]>(Array.from({ length: childArr.length }, (_, i) => i));

    const container = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<number>(0);
    const tlRef = useRef<gsap.core.Timeline | null>(null); // Ref to hold the currently running timeline

    const totalCards = refs.length;

    // 1. Initial Placement (useLayoutEffect to prevent FOUC)
    useLayoutEffect(() => {
        if (totalCards === 0) return;
        
        // Use GSAP context for initial placement setup
        const ctx = gsap.context(() => {
            refs.forEach((r, i) => {
                if (r.current) {
                    // Set initial positions instantly
                    placeNow(r.current, makeSlot(i, cardDistance, verticalDistance, totalCards), skewAmount);
                }
            });
        }, container);

        return () => ctx.revert(); // Revert initial GSAP settings on unmount

    }, [cardDistance, verticalDistance, skewAmount, totalCards]);

    // 2. Animation Loop and Lifecycle (useEffect for side effects and cleanup)
    useEffect(() => {
        if (totalCards < 2) {
            clearInterval(intervalRef.current);
            return;
        }

        // Use GSAP Context to scope the animation loop
        const ctx = gsap.context(() => {
            
            const swap = () => {
                const [front, ...rest] = order.current;
                const elFront = refs[front].current;

                if (!elFront) return;

                const tl = gsap.timeline();
                tlRef.current = tl; // Store the new timeline instance

                // 1. Drop the front card
                tl.to(elFront, {
                    y: '+=500',
                    duration: config.durDrop,
                    ease: config.ease
                });

                // 2. Promote the remaining cards
                tl.addLabel('promote', `-=${config.durDrop * config.promoteOverlap}`);
                rest.forEach((idx, i) => {
                    const el = refs[idx].current;
                    if (!el) return;
                    
                    const slot = makeSlot(i, cardDistance, verticalDistance, totalCards);
                    
                    // Set zIndex immediately at the start of promotion
                    tl.set(el, { zIndex: slot.zIndex }, 'promote');
                    
                    // Animate to new position
                    tl.to(
                        el,
                        {
                            x: slot.x,
                            y: slot.y,
                            z: slot.z,
                            skewY: skewAmount, // Include skew in the move
                            duration: config.durMove,
                            ease: config.ease
                        },
                        `promote+=${i * 0.15}` // Stagger the promotion slightly
                    );
                });

                // 3. Return the front card to the back slot
                const backSlot = makeSlot(totalCards - 1, cardDistance, verticalDistance, totalCards);
                tl.addLabel('return', `promote+=${config.durMove * config.returnDelay}`);
                
                tl.call(
                    () => {
                        // Update the logical order right before the card returns
                        order.current = [...rest, front];
                    },
                    undefined,
                    'return'
                );
                
                // Set the final zIndex for the returning card before the animation
                tl.set(elFront, { zIndex: backSlot.zIndex }, 'return');
                
                tl.to(
                    elFront,
                    {
                        x: backSlot.x,
                        y: backSlot.y,
                        z: backSlot.z,
                        skewY: skewAmount,
                        duration: config.durReturn,
                        ease: config.ease
                    },
                    'return'
                );

            };

            // Start the cycle
            intervalRef.current = window.setInterval(swap, delay);
            // Run the first animated swap to start the loop
            swap(); 

            // --- Hover Pause Logic ---
            if (pauseOnHover) {
                const node = container.current!;
                
                const pauseAnimation = () => {
                    tlRef.current?.pause(); // Pause the current animation timeline
                    clearInterval(intervalRef.current); // Clear the auto-swap interval
                };
                
                const resumeAnimation = () => {
                    tlRef.current?.play(); // Resume the animation timeline
                    intervalRef.current = window.setInterval(swap, delay); // Restart the interval
                };

                node.addEventListener('mouseenter', pauseAnimation);
                node.addEventListener('mouseleave', resumeAnimation);
                
                // Add hover cleanup to the context's return function
                return () => {
                    node.removeEventListener('mouseenter', pauseAnimation);
                    node.removeEventListener('mouseleave', resumeAnimation);
                };
            }

        }, container); // Scope GSAP to the container element

        // Cleanup function for useEffect
        return () => {
            clearInterval(intervalRef.current);
            ctx.revert(); // Reverts all GSAP animations and sets created by this context
        };
        
    }, [cardDistance, verticalDistance, delay, pauseOnHover, skewAmount, totalCards, config, refs]);


    const rendered = childArr.map((child, i) =>
        isValidElement<CardProps>(child)
            ? cloneElement(child, {
                  key: i,
                  ref: refs[i],
                  // Ensure width/height from props override any internal defaults but respect child's styles
                  style: { width, height, ...(child.props.style ?? {}) }, 
                  onClick: e => {
                      child.props.onClick?.(e as React.MouseEvent<HTMLDivElement>);
                      // Call the prop-level click handler with the card's original index
                      onCardClick?.(i); 
                  }
              } as CardProps & React.RefAttributes<HTMLDivElement>)
            : child
    );

    return (
        <div
            ref={container}
            // Tailwind classes for 3D context and responsive scaling
            className="absolute bottom-0 right-0 transform translate-x-[5%] translate-y-[20%] origin-bottom-right perspective-[900px] overflow-visible
                        max-[768px]:translate-x-[25%] max-[768px]:translate-y-[25%] max-[768px]:scale-[0.75] 
                        max-[480px]:translate-x-[25%] max-[480px]:translate-y-[25%] max-[480px]:scale-[0.55]"
            style={{ width, height }}
        >
            {rendered}
        </div>
    );
};

export default CardSwap;