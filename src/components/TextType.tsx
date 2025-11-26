'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'react';
import type { ElementType } from 'react';

// --- FIX: Replaced Enum with Const Object and Type Alias ---
const Phase = {
  Typing: 'typing',
  Pausing: 'pausing',
  Deleting: 'deleting',
} as const;

type Phase = typeof Phase[keyof typeof Phase];
// -----------------------------------------------------------

interface TextTypeProps {
  text: string | string[];
  as?: ElementType;
  className?: string;
  
  // Speed Settings
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  variableSpeed?: { min: number; max: number };
  initialDelay?: number;
  
  // Logic Settings
  loop?: boolean;
  startOnVisible?: boolean;
  reverseMode?: boolean; // Types text backwards (e.g. "dlroW")
  
  // Cursor Settings
  showCursor?: boolean;
  cursorChar?: string | React.ReactNode;
  cursorClassName?: string;
  cursorBlinkSpeed?: number; // in seconds
  hideCursorOnComplete?: boolean;
  
  // Styling
  gradient?: boolean; // Enable gradient text
  glowCursor?: boolean; // Enable glowing cursor
  
  // Events
  onSentenceTyped?: (sentence: string, index: number) => void;
  onLoopComplete?: () => void;
}

const TextWelcome = ({
  text,
  as: Component = 'div',
  className = '',
  
  typingSpeed = 50,
  deletingSpeed = 30,
  pauseDuration = 1500,
  variableSpeed,
  initialDelay = 0,
  
  loop = true,
  startOnVisible = false,
  reverseMode = false,
  
  showCursor = true,
  cursorChar = '|',
  cursorClassName = '',
  cursorBlinkSpeed = 0.8,
  hideCursorOnComplete = false,
  
  gradient = false,
  glowCursor = false,
  
  onSentenceTyped,
  onLoopComplete,
  ...props
}: TextTypeProps & React.HTMLAttributes<HTMLElement>) => {
  
  // --- State ---
  const [displayedText, setDisplayedText] = useState('');
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(Phase.Typing); 
  const [isVisible, setIsVisible] = useState(!startOnVisible);

  const containerRef = useRef<HTMLElement>(null);
  
  // Normalize text to array
  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);

  // Calculate Speed
  const getTypingSpeed = useCallback(() => {
    if (variableSpeed) {
      const { min, max } = variableSpeed;
      return Math.random() * (max - min) + min;
    }
    return typingSpeed;
  }, [typingSpeed, variableSpeed]);

  // --- Visibility Observer ---
  useEffect(() => {
    if (!startOnVisible || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  // --- Main Typing Logic ---
  useEffect(() => {
    if (!isVisible) return;

    let timeout: ReturnType<typeof setTimeout>;

    // Get the full string we are currently processing
    const fullCurrentText = textArray[currentTextIndex];
    // Handle the "Reverse Mode" prop (types "olleh" instead of "hello")
    const targetText = reverseMode 
      ? fullCurrentText.split('').reverse().join('') 
      : fullCurrentText;

    const handleTyping = () => {
      // 1. TYPING PHASE
      if (phase === Phase.Typing) {
        const nextChar = targetText.slice(0, displayedText.length + 1);
        
        if (nextChar === displayedText) {
          // Finished typing the sentence
          if (onSentenceTyped) onSentenceTyped(fullCurrentText, currentTextIndex);
          setPhase(Phase.Pausing);
        } else {
          // Type next character
          setDisplayedText(nextChar);
        }
      
      // 2. DELETING PHASE
      } else if (phase === Phase.Deleting) {
        if (displayedText === '') {
          // Finished deleting
          const nextIndex = currentTextIndex + 1;
          
          if (nextIndex >= textArray.length) {
              if (loop) {
                setCurrentTextIndex(0);
                setPhase(Phase.Typing);
                if(onLoopComplete) onLoopComplete();
              } else {
                // Stop completely
                return; 
              }
          } else {
            setCurrentTextIndex(nextIndex);
            setPhase(Phase.Typing);
          }
        } else {
          // Delete last character
          setDisplayedText((prev) => prev.slice(0, -1));
        }

      // 3. PAUSING PHASE
      } else if (phase === Phase.Pausing) {
        // If not looping and on last sentence, stop here
        if (!loop && currentTextIndex === textArray.length - 1) {
          return;
        }
        setPhase(Phase.Deleting);
      }
    };

    // Determine Delay based on Phase
    let delay = getTypingSpeed();
    
    if (phase === Phase.Deleting) {
      delay = deletingSpeed;
    } else if (phase === Phase.Pausing) {
      delay = pauseDuration;
    }

    // Initial Start Delay
    if (displayedText === '' && phase === Phase.Typing && currentTextIndex === 0 && initialDelay > 0) {
        timeout = setTimeout(() => {
            // Trigger the first character manually to break the delay
            setDisplayedText(targetText.slice(0, 1)); 
        }, initialDelay);
    } else {
      timeout = setTimeout(handleTyping, delay);
    }

    return () => clearTimeout(timeout);
  }, [
    displayedText,
    phase,
    currentTextIndex,
    textArray,
    isVisible,
    loop,
    reverseMode,
    deletingSpeed,
    pauseDuration,
    initialDelay,
    getTypingSpeed,
    onSentenceTyped,
    onLoopComplete
  ]);

  // --- Styling Classes ---
  // If gradient is enabled, apply generic gradient classes (can be overridden by className)
  const textClasses = gradient 
    ? `bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 ${className}` 
    : className;

  const cursorBaseClasses = `inline-block ml-0.5 align-middle font-normal text-current transition-opacity`;
  const cursorGlowStyle = glowCursor ? { textShadow: '0 0 8px currentColor' } : {};

  // Check if we should hide cursor permanently after finishing
  const shouldHideCursor = !loop && phase === Phase.Pausing && currentTextIndex === textArray.length - 1 && hideCursorOnComplete;

  return (
    <Component
      ref={containerRef}
      className={`inline-flex items-center tracking-tight font-medium ${textClasses}`}
      aria-label={textArray[currentTextIndex]} // Accessibility
      {...props}
    >
      <span className="whitespace-pre-wrap">{displayedText}</span>

      {showCursor && !shouldHideCursor && (
        <span
          aria-hidden="true"
          className={`${cursorBaseClasses} ${cursorClassName}`}
          style={{
            ...cursorGlowStyle,
            animation: `blink ${cursorBlinkSpeed}s step-end infinite`
          }}
        >
          {cursorChar}
        </span>
      )}

      {/* Inject Keyframes for Cursor locally to avoid external CSS dependency */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </Component>
  );
};

export default TextWelcome;