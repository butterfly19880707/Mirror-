import React, { useEffect, useRef, useState } from 'react';
import { Mic, Upload, Play, Pause, Square, Music } from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [source, setSource] = useState<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [mode, setMode] = useState<'mic' | 'file' | null>(null);
  const [theme, setTheme] = useState<string>('neon');
  const [kaleidoscope, setKaleidoscope] = useState(true);
  
  const requestRef = useRef<number>();
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const beatRef = useRef({ energy: 0, threshold: 0, lastBeat: 0 });
  const rotationRef = useRef(0);

  // Mandala settings
  const numPetals = 16;
  const baseRadius = 60;

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    dataArrayRef.current = dataArray;

    const draw = () => {
      requestRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      // Resize canvas to window size
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const centerX = width / 2;
      const centerY = height / 2;

      // Beat Detection (Bass range: 0-10 bins for 512 FFT)
      let bassEnergy = 0;
      for (let i = 0; i < 10; i++) bassEnergy += dataArray[i];
      bassEnergy /= 10;

      const now = performance.now();
      let isBeat = false;
      if (bassEnergy > beatRef.current.threshold && now - beatRef.current.lastBeat > 200) {
        isBeat = true;
        beatRef.current.lastBeat = now;
        beatRef.current.threshold = bassEnergy * 1.2;
      } else {
        beatRef.current.threshold *= 0.99; // Decay threshold
      }
      beatRef.current.energy = bassEnergy;

      // Clear with slight trail effect
      ctx.fillStyle = isBeat ? 'rgba(20, 10, 40, 0.3)' : 'rgba(10, 5, 20, 0.15)';
      ctx.fillRect(0, 0, width, height);

      // Update rotation based on intensity
      rotationRef.current += 0.005 + (bassEnergy / 255) * 0.05;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationRef.current);

      // Calculate average volume for pulsing effect
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avgVolume = sum / bufferLength;
      const pulse = (1 + avgVolume / 200) * (isBeat ? 1.2 : 1);

      // Draw Mandala
      for (let i = 0; i < numPetals; i++) {
        ctx.save();
        ctx.rotate((i * 2 * Math.PI) / numPetals);
        
        // Draw one petal
        drawPetal(ctx, dataArray, bufferLength, pulse, isBeat);
        
        // Mirror petal
        ctx.scale(1, -1);
        drawPetal(ctx, dataArray, bufferLength, pulse, isBeat);
        
        ctx.restore();
      }

      ctx.restore();

      // Kaleidoscope Overlay
      if (kaleidoscope) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.3;
        ctx.translate(centerX, centerY);
        ctx.rotate(-rotationRef.current * 0.5);
        ctx.scale(0.8, 0.8);
        
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(canvas, -centerX, -centerY);
        }
        ctx.restore();
      }
    };

    draw();

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [analyser, theme]);

  const drawPetal = (ctx: CanvasRenderingContext2D, dataArray: Uint8Array, bufferLength: number, pulse: number, isBeat: boolean) => {
    ctx.beginPath();
    ctx.moveTo(baseRadius * pulse, 0);

    const step = Math.floor(bufferLength / 80);
    
    for (let i = 0; i < 80; i++) {
      const value = dataArray[i * step];
      const percent = value / 255;
      
      const r = baseRadius * pulse + percent * (isBeat ? 300 : 200) * pulse;
      const theta = (i / 80) * (Math.PI / numPetals);
      
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      
      ctx.lineTo(x, y);
    }

    // Add some color based on theme
    let hue1, hue2;
    const beatShift = isBeat ? 30 : 0;
    
    if (theme === 'neon') {
      hue1 = 300 + beatShift; // Magenta
      hue2 = 180 + beatShift; // Cyan
    } else if (theme === 'sunset') {
      hue1 = 20 + beatShift;  // Orange
      hue2 = 340 + beatShift; // Pink/Red
    } else if (theme === 'ocean') {
      hue1 = 200 + beatShift; // Blue
      hue2 = 160 + beatShift; // Teal
    } else if (theme === 'emerald') {
      hue1 = 140 + beatShift; // Green
      hue2 = 60 + beatShift;  // Yellow
    } else if (theme === 'monochrome') {
      hue1 = 0;
      hue2 = 0;
    } else {
      // Dynamic (default)
      hue1 = ((dataArray[10] / 255) * 360 + beatShift) % 360;
      hue2 = (hue1 + 60) % 360;
    }

    const gradient = ctx.createLinearGradient(0, 0, 400, 0);
    const saturation = theme === 'monochrome' ? '0%' : (isBeat ? '100%' : '80%');
    const lightness = theme === 'monochrome' ? (isBeat ? '100%' : '70%') : (isBeat ? '60%' : '50%');
    
    gradient.addColorStop(0, `hsla(${hue1}, ${saturation}, ${lightness}, 0.9)`);
    gradient.addColorStop(1, `hsla(${hue2}, ${saturation}, ${lightness}, 0.1)`);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = isBeat ? 3 : 1.5;
    ctx.stroke();
    
    // Fill with slight opacity
    ctx.fillStyle = `hsla(${hue1}, ${saturation}, ${lightness}, ${isBeat ? 0.2 : 0.05})`;
    ctx.fill();
  };

  const initAudio = () => {
    if (!audioContext) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const anal = ctx.createAnalyser();
      anal.fftSize = 512;
      anal.smoothingTimeConstant = 0.8;
      setAudioContext(ctx);
      setAnalyser(anal);
      return { ctx, anal };
    }
    return { ctx: audioContext, anal: analyser };
  };

  const startMic = async () => {
    try {
      stopAudio();
      const { ctx, anal } = initAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const src = ctx.createMediaStreamSource(stream);
      src.connect(anal);
      setSource(src);
      setMode('mic');
      setIsPlaying(true);
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopAudio();
    const { ctx, anal } = initAudio();
    
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    
    const src = ctx.createMediaElementSource(audio);
    src.connect(anal);
    anal.connect(ctx.destination); // Connect to speakers
    
    audio.play();
    
    setAudioElement(audio);
    setSource(src);
    setMode('file');
    setIsPlaying(true);

    audio.onended = () => {
      setIsPlaying(false);
    };
  };

  const togglePlayPause = () => {
    if (mode === 'file' && audioElement) {
      if (isPlaying) {
        audioElement.pause();
      } else {
        audioElement.play();
      }
      setIsPlaying(!isPlaying);
    } else if (mode === 'mic' && audioContext) {
       if (isPlaying) {
         audioContext.suspend();
       } else {
         audioContext.resume();
       }
       setIsPlaying(!isPlaying);
    }
  };

  const stopAudio = () => {
    if (source) {
      source.disconnect();
    }
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
    if (mode === 'mic' && source && 'mediaStream' in source) {
      const stream = (source as MediaStreamAudioSourceNode).mediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setSource(null);
    setAudioElement(null);
    setIsPlaying(false);
    setMode(null);
  };

  return (
    <div className="relative w-full h-screen bg-[#0a0514] overflow-hidden font-sans text-white">
      {/* Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />

      {/* UI Overlay */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-6 z-10 w-full max-w-md px-4">
        
        {/* Theme Selector */}
        <div className="flex items-center gap-4 p-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 overflow-x-auto no-scrollbar max-w-full">
          <div className="flex gap-2">
            {[
              { id: 'dynamic', name: 'Dynamic', color: 'bg-gradient-to-r from-red-400 via-green-400 to-blue-400' },
              { id: 'neon', name: 'Neon', color: 'bg-gradient-to-r from-fuchsia-500 to-cyan-400' },
              { id: 'sunset', name: 'Sunset', color: 'bg-gradient-to-r from-orange-500 to-rose-500' },
              { id: 'ocean', name: 'Ocean', color: 'bg-gradient-to-r from-blue-600 to-teal-400' },
              { id: 'emerald', name: 'Emerald', color: 'bg-gradient-to-r from-emerald-500 to-lime-400' },
              { id: 'monochrome', name: 'Mono', color: 'bg-white' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`group relative flex items-center justify-center w-8 h-8 rounded-full transition-all hover:scale-110 active:scale-95 flex-shrink-0 ${
                  theme === t.id ? 'ring-2 ring-white ring-offset-2 ring-offset-black/50 scale-110' : 'opacity-60 hover:opacity-100'
                }`}
                title={t.name}
              >
                <div className={`w-full h-full rounded-full ${t.color} shadow-lg`} />
              </button>
            ))}
          </div>
          
          <div className="h-6 w-px bg-white/10" />
          
          <button
            onClick={() => setKaleidoscope(!kaleidoscope)}
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
              kaleidoscope ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Kaleidoscope
          </button>
        </div>

        {!mode ? (
          <div className="flex flex-col items-center gap-6 p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl w-full">
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-light tracking-tighter uppercase italic">Rhythm Mandala</h1>
              <p className="text-white/50 text-xs tracking-widest uppercase">Experience the Sound</p>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={startMic}
                className="flex flex-col items-center justify-center w-32 h-32 gap-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:scale-105 active:scale-95"
              >
                <Mic className="w-8 h-8 text-emerald-400" />
                <span className="text-sm font-medium">Microphone</span>
              </button>
              
              <label className="flex flex-col items-center justify-center w-32 h-32 gap-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:scale-105 active:scale-95 cursor-pointer">
                <Upload className="w-8 h-8 text-indigo-400" />
                <span className="text-sm font-medium">Upload Audio</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            
            <div className="text-xs text-white/40 max-w-xs text-center mt-2">
              Tip: Play your favorite track (like <a href="https://www.youtube.com/watch?v=y0DQ0sXqMEU" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">this one</a>) in another tab and use the <b>Microphone</b> mode to visualize it!
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 p-4 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10">
              {mode === 'mic' ? <Mic className="w-5 h-5 text-emerald-400" /> : <Music className="w-5 h-5 text-indigo-400" />}
            </div>
            
            <div className="h-8 w-px bg-white/10 mx-2" />
            
            <button
              onClick={togglePlayPause}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-white text-black hover:bg-white/90 transition-all active:scale-95"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
            </button>
            
            <button
              onClick={stopAudio}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-95 text-white"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
