import React, { useEffect, useRef } from "react";

interface VisualizerProps {
    audioRef: React.RefObject<HTMLAudioElement | null>;
    isPlaying: boolean;
}

// AudioProcessor code as inline string for AudioWorklet
const audioProcessorCode = `
class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
    }
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input && input.length > 0) {
            const channelData = input[0];
            let sum = 0;
            for (let i = 0; i < channelData.length; i++) {
                sum += channelData[i] * channelData[i];
            }
            const rms = Math.sqrt(sum / channelData.length);
            this.port.postMessage({ type: "LEVEL", level: Math.min(1, rms * 3) });
        }
        return true;
    }
}
registerProcessor("audio-processor", AudioProcessor);
`;

// Global state to prevent re-initialization
const sourceMap = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();
const contextMap = new WeakMap<HTMLAudioElement, AudioContext>();

const BAR_COUNT = 96;
const FFT_SIZE = 1024;
const BAR_GAP = 4;

const Visualizer: React.FC<VisualizerProps> = ({ audioRef, isPlaying }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animFrameRef = useRef<number>(0);

    // Effect 1: Audio Context and Analyser Initialization
    useEffect(() => {
        if (!audioRef.current) return;
        const audioEl = audioRef.current;

        // Get or create AudioContext
        let ctx = contextMap.get(audioEl);
        if (!ctx) {
            ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            contextMap.set(audioEl, ctx);
        }
        audioContextRef.current = ctx;

        // Resume if suspended
        if (ctx.state === "suspended" && isPlaying) {
            ctx.resume();
        }

        // Create Analyser node
        if (!analyserRef.current) {
            const analyser = ctx.createAnalyser();
            analyser.fftSize = FFT_SIZE;
            analyser.smoothingTimeConstant = 0.5;
            analyserRef.current = analyser;

            // Connect source to analyser
            if (!sourceMap.has(audioEl)) {
                try {
                    const source = ctx.createMediaElementSource(audioEl);
                    source.connect(ctx.destination);
                    source.connect(analyser);
                    sourceMap.set(audioEl, source);
                } catch (e) {
                    // Source might already exist
                    const source = sourceMap.get(audioEl);
                    if (source) {
                        try { source.connect(analyser); } catch (e2) { }
                    }
                }
            } else {
                const source = sourceMap.get(audioEl);
                if (source) {
                    try { source.connect(analyser); } catch (e) { }
                }
            }
        }

        return () => {
            // Cleanup
        };
    }, [isPlaying, audioRef]);

    // Effect 2: Canvas animation
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !isPlaying) {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
            return;
        }

        const ctx2d = canvas.getContext('2d');
        if (!ctx2d) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = 1000 * dpr;
        canvas.height = 80 * dpr;

        const analyser = analyserRef.current;
        if (!analyser) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animFrameRef.current = requestAnimationFrame(draw);

            analyser.getByteFrequencyData(dataArray);

            ctx2d.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;

            for (let i = 0; i < BAR_COUNT; i++) {
                const dataIndex = Math.floor(i * bufferLength / BAR_COUNT);
                const value = dataArray[dataIndex] / 255;
                const barHeight = Math.max(2, value * canvas.height);

                const x = i * (barWidth + BAR_GAP);
                const y = canvas.height - barHeight;

                // Create gradient for each bar
                const gradient = ctx2d.createLinearGradient(x, canvas.height, x, y);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');

                ctx2d.fillStyle = gradient;
                ctx2d.fillRect(x, y, barWidth, barHeight);
            }
        };

        draw();

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [isPlaying]);

    if (!isPlaying) return <div className="h-10 w-full"></div>;

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-10 transition-opacity duration-500"
        />
    );
};

export default Visualizer;
