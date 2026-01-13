import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, RotateCw } from 'lucide-react';

interface VoiceAudioPlayerProps {
    src: string;
    fileName?: string;
    fileSize?: string;
    showControls?: boolean;
    compact?: boolean;
}

export default function VoiceAudioPlayer({
    src,
    fileName,
    fileSize,
    showControls = true,
    compact = false,
}: VoiceAudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const animationRef = useRef<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [rotation, setRotation] = useState(0);

    // Spinning animation using requestAnimationFrame
    useEffect(() => {
        if (isPlaying) {
            const animate = () => {
                setRotation((prev) => prev + 1);
                animationRef.current = requestAnimationFrame(animate);
            };
            animationRef.current = requestAnimationFrame(animate);
        } else {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleEnded = () => {
            setIsPlaying(false);
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    const skipForward = () => {
        const audio = audioRef.current;
        if (audio) {
            audio.currentTime = Math.min(audio.currentTime + 5, duration);
        }
    };

    const skipBackward = () => {
        const audio = audioRef.current;
        if (audio) {
            audio.currentTime = Math.max(audio.currentTime - 5, 0);
        }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * duration;
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    if (compact) {
        return (
            <div className="flex items-center gap-3 bg-slate-100 rounded-lg px-4 py-2">
                <audio ref={audioRef} src={src} preload="metadata" />
                <button
                    onClick={togglePlay}
                    className="w-8 h-8 flex items-center justify-center bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors"
                >
                    {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                </button>
                <div className="flex-1">
                    <div
                        className="h-1 bg-slate-300 rounded-full cursor-pointer"
                        onClick={handleProgressClick}
                    >
                        <div
                            className="h-full bg-slate-900 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* Vinyl Disc */}
            <div className="flex justify-center">
                <div className="relative">
                    <motion.div
                        className="w-40 h-40 rounded-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center shadow-xl"
                        animate={{ rotate: rotation }}
                        transition={{ duration: 0, ease: 'linear' }}
                    >
                        {/* Vinyl grooves */}
                        <div className="absolute inset-2 rounded-full border border-slate-700/50" />
                        <div className="absolute inset-6 rounded-full border border-slate-700/50" />
                        <div className="absolute inset-10 rounded-full border border-slate-700/50" />
                        <div className="absolute inset-14 rounded-full border border-slate-700/50" />

                        {/* Center label */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center border-2 border-slate-500">
                            <div className="w-2 h-2 rounded-full bg-slate-400" />
                        </div>

                        {/* Shine effect */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
                    </motion.div>

                    {/* Spinning indicator */}
                    {isPlaying && (
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-3 bg-red-500 rounded-full" />
                    )}
                </div>
            </div>

            {/* File info */}
            {(fileName || fileSize) && (
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={togglePlay}
                            className="w-8 h-8 flex items-center justify-center bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors"
                        >
                            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                        </button>
                        {fileName && <p className="text-sm font-medium text-slate-800">{fileName}</p>}
                    </div>
                    {fileSize && <p className="text-xs text-slate-500 mt-1">{fileSize}</p>}
                </div>
            )}

            {/* Progress bar */}
            <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-mono w-10">{formatTime(currentTime)}</span>
                <div
                    className="flex-1 h-1.5 bg-slate-200 rounded-full cursor-pointer"
                    onClick={handleProgressClick}
                >
                    <div
                        className="h-full bg-slate-900 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="text-xs text-slate-500 font-mono w-10">{formatTime(duration)}</span>
            </div>

            {/* Controls */}
            {showControls && (
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={skipBackward}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <RotateCcw className="w-5 h-5" />
                    </button>
                    <button
                        onClick={togglePlay}
                        className="w-12 h-12 flex items-center justify-center bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors shadow-lg"
                    >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </button>
                    <button
                        onClick={skipForward}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <RotateCw className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    );
}
