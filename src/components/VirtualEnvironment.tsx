import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Square, RotateCcw, X, Sliders, Map, RefreshCw, ChevronRight, HelpCircle, Eye, EyeOff, Home, ZoomIn, ZoomOut, Upload, Trash2, Maximize2, Minimize2, Layers, Save, Download } from 'lucide-react';
import { motion } from 'motion/react';

interface VirtualEnvironmentProps {
  code: string;
  onClose: () => void;
  motors: any[];
  sensors: any[];
  wheelDiameter: number;
  wheelDistance: number;
  maxMotorSpeed: number;
}

interface Obstacle {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  pushable?: boolean;
  shape?: 'square' | 'circle';
  color?: string;
}

// Map styles
type MapType = 'line' | 'colors' | 'maze' | 'empty' | 'custom';

export default function VirtualEnvironment({
  code,
  onClose,
  motors,
  sensors,
  wheelDiameter,
  wheelDistance,
  maxMotorSpeed,
}: VirtualEnvironmentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement>(null);

  // Simulation State
  const [isPlaying, setIsPlaying] = useState(false);
  const [mapType, setMapType] = useState<MapType>('line');
  const [trailEnabled, setTrailEnabled] = useState(true);
  const [isDraggingObstacle, setIsDraggingObstacle] = useState<number | null>(null);
  const [isDraggingRobot, setIsDraggingRobot] = useState(false);
  const startPosRef = useRef({ x: 150, y: 200, angle: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });

  // Fullscreen and Sidebar custom states to maximize the robot simulation view
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Zoom & Pan State / Refs
  const scaleRef = useRef(1);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetStartRef = useRef({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // Escape key handler to exit fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Custom image upload states & handlers
  const [customBgImage, setCustomBgImage] = useState<HTMLImageElement | null>(null);
  const [customBgImageSrc, setCustomBgImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileImportInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setCustomBgImage(img);
        setCustomBgImageSrc(dataUrl);
        setConsoleLogs(prev => [...prev, `[Simulatore] Caricata immagine di sfondo personalizzata: ${file.name}`]);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const applyLayoutData = (data: any) => {
    if (data.mapType) {
      setMapType(data.mapType);
    }
    if (data.obstacles) {
      setObstacles(data.obstacles);
      obstaclesRef.current = data.obstacles;
    }
    if (data.startPos) {
      startPosRef.current = data.startPos;
      // Reset the current robot position to startPos
      robotRef.current.x = data.startPos.x;
      robotRef.current.y = data.startPos.y;
      robotRef.current.angle = data.startPos.angle;
      robotRef.current.yawResetAngle = data.startPos.angle;
      robotRef.current.trail = [];
    }
    if (data.customBgImageSrc) {
      setCustomBgImageSrc(data.customBgImageSrc);
      const img = new Image();
      img.onload = () => {
        setCustomBgImage(img);
      };
      img.src = data.customBgImageSrc;
    } else {
      setCustomBgImage(null);
      setCustomBgImageSrc(null);
    }
  };

  const saveLayoutToLocalStorage = () => {
    try {
      const layoutData = {
        mapType,
        customBgImageSrc,
        obstacles,
        startPos: startPosRef.current
      };
      localStorage.setItem('openroberta_sim_saved_field', JSON.stringify(layoutData));
      setConsoleLogs(prev => [...prev, '[Simulatore] Campo simulato salvato correttamente nel browser.']);
    } catch (error) {
      console.error(error);
      setConsoleLogs(prev => [...prev, '[Errore] Impossibile salvare nel browser (l\'immagine potrebbe essere troppo grande). Prova ad esportare come File.']);
    }
  };

  const loadLayoutFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('openroberta_sim_saved_field');
      if (!saved) {
        setConsoleLogs(prev => [...prev, '[Simulatore] Nessun salvataggio trovato nel browser.']);
        return;
      }
      const data = JSON.parse(saved);
      applyLayoutData(data);
      setConsoleLogs(prev => [...prev, '[Simulatore] Campo simulato caricato dal browser.']);
    } catch (error) {
      console.error(error);
      setConsoleLogs(prev => [...prev, '[Errore] Impossibile caricare il campo dal browser.']);
    }
  };

  const exportLayoutToFile = () => {
    try {
      const layoutData = {
        mapType,
        customBgImageSrc,
        obstacles,
        startPos: startPosRef.current
      };
      const jsonString = JSON.stringify(layoutData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `campo_simulato_${mapType}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setConsoleLogs(prev => [...prev, '[Simulatore] Campo esportato come file JSON con successo.']);
    } catch (error) {
      console.error(error);
      setConsoleLogs(prev => [...prev, '[Errore] Impossibile esportare il campo.']);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        applyLayoutData(data);
        setConsoleLogs(prev => [...prev, `[Simulatore] Importato file campo: ${file.name}`]);
      } catch (err) {
        console.error(err);
        setConsoleLogs(prev => [...prev, '[Errore] File JSON non valido o corrotto.']);
      }
      // We must reset the value of the input so the SAME file can be imported again
      if (fileImportInputRef.current) {
        fileImportInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Robot Physical State (canvas coordinates)
  const robotRef = useRef({
    x: 150,
    y: 200,
    angle: 0, // in degrees, 0 is pointing right
    yawResetAngle: 0,
    leftSpeed: 0,
    rightSpeed: 0,
    matrixText: '',
    matrixImage: '',
    beepActive: false,
    trail: [] as { x: number; y: number }[],
    // Sensors readings
    distance: 200,
    color: -1, // -1 means none, 0=Nero, 3=Blu, 5=Verde, 7=Giallo, 9=Rosso, 10=Bianco
    reflection: 100, // 0 to 100
    collision: false,
  });

  // Keep state for rendering overlay
  const sensorReadingsRef = useRef<{
    [port: string]: {
      type: string;
      color: number;
      colorName: string;
      colorHex: string;
      reflection: number;
      distance: number;
      force: number;
      sensorX: number;
      sensorY: number;
    }
  }>({});

  const [activeSensorsReadings, setActiveSensorsReadings] = useState<any[]>([]);

  const [sensorsDisplay, setSensorsDisplay] = useState({
    x: 150,
    y: 200,
    angle: 0,
    leftSpeed: 0,
    rightSpeed: 0,
    distance: 200,
    colorName: 'Nessuno',
    colorHex: '#CCCCCC',
    reflection: 100,
    collision: false,
    matrixText: '',
    matrixImage: '',
  });

  // Draggable Obstacles list starting empty by default
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);

  const [selectedObstacleId, setSelectedObstacleId] = useState<number | null>(null);

  // Maintain stable reference of obstacles for high-frequency physics
  const obstaclesRef = useRef<Obstacle[]>([]);
  useEffect(() => {
    obstaclesRef.current = obstacles;
  }, [obstacles]);

  // Sync obstacles coordinates from physics loop back to react state when play starts or stops
  useEffect(() => {
    if (!isPlaying) {
      setObstacles([...obstaclesRef.current]);
    }
  }, [isPlaying]);

  // Helper to check if a hex color is gray / neutral
  const isColorGray = (hex: string): boolean => {
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length !== 6 && cleanHex.length !== 3) return false;
    const r = parseInt(cleanHex.length === 3 ? cleanHex[0] + cleanHex[0] : cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.length === 3 ? cleanHex[1] + cleanHex[1] : cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.length === 3 ? cleanHex[2] + cleanHex[2] : cleanHex.substring(4, 6), 16);
    // If Red, Green, and Blue values are extremely close, it is a gray, white or black shade
    return Math.abs(r - g) < 25 && Math.abs(g - b) < 25 && Math.abs(r - b) < 25;
  };

  const addSolidObstacle = () => {
    const newId = obstacles.length > 0 ? Math.max(...obstacles.map(o => o.id)) + 1 : 1;
    const newObs: Obstacle = {
      id: newId,
      x: 350,
      y: 150,
      w: 60,
      h: 40,
      pushable: false,
      shape: 'square',
      color: '#4B5563'
    };
    const updated = [...obstacles, newObs];
    setObstacles(updated);
    obstaclesRef.current = updated;
    setSelectedObstacleId(newId);
  };

  const addPushableObstacle = () => {
    const newId = obstacles.length > 0 ? Math.max(...obstacles.map(o => o.id)) + 1 : 1;
    const newObs: Obstacle = {
      id: newId,
      x: 350,
      y: 150,
      w: 40,
      h: 40,
      pushable: true,
      shape: 'square',
      color: '#D97706'
    };
    const updated = [...obstacles, newObs];
    setObstacles(updated);
    obstaclesRef.current = updated;
    setSelectedObstacleId(newId);
  };

  const updateSelectedObstacle = (fields: Partial<Obstacle>) => {
    if (selectedObstacleId !== null) {
      const updated = obstacles.map(obs => {
        if (obs.id === selectedObstacleId) {
          let finalColor = fields.color !== undefined ? fields.color : obs.color;
          
          if (obs.pushable) {
            // Moveable objects cannot be gray
            if (finalColor && isColorGray(finalColor)) {
              finalColor = obs.color && !isColorGray(obs.color) ? obs.color : '#D97706';
            }
          } else {
            // Walls/muri are always and only dark gray
            finalColor = '#4B5563';
          }

          const updatedObs = { ...obs, ...fields, color: finalColor };
          // If switching to circle, make sure width and height are equal (square aspect)
          if (fields.shape === 'circle') {
            updatedObs.w = obs.w;
            updatedObs.h = obs.w;
          }
          return updatedObs;
        }
        return obs;
      });
      setObstacles(updated);
      obstaclesRef.current = updated;
    }
  };

  const deleteSelectedObstacle = () => {
    if (selectedObstacleId !== null) {
      const updated = obstacles.filter(o => o.id !== selectedObstacleId);
      setObstacles(updated);
      obstaclesRef.current = updated;
      setSelectedObstacleId(null);
    }
  };

  const clearAllObstacles = () => {
    setObstacles([]);
    obstaclesRef.current = [];
    setSelectedObstacleId(null);
  };

  // Thread control for code execution
  const activeExecutionId = useRef<number>(0);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  // Sound Synth API
  const audioCtxRef = useRef<AudioContext | null>(null);

  const triggerBeep = useCallback((freq = 440, duration = 200) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
      
      osc.start();
      osc.stop(ctx.currentTime + duration / 1000);
      
      robotRef.current.beepActive = true;
      setTimeout(() => {
        robotRef.current.beepActive = false;
      }, duration);
    } catch (e) {
      console.error("Audio beep fail", e);
    }
  }, []);

  // Set initial robot position depending on map type
  const resetRobot = useCallback((forceDefaultHome = false) => {
    let startX = 150;
    let startY = 200;
    let startAngle = 0;

    if (mapType === 'line') {
      startX = 130;
      startY = 118; // Shifted 17px (approx 5cm) up
      startAngle = 0;
    } else if (mapType === 'colors') {
      startX = 100;
      startY = 200;
      startAngle = 0;
    } else if (mapType === 'maze') {
      startX = 70;
      startY = 70;
      startAngle = 0;
    }

    if (forceDefaultHome) {
      startPosRef.current = { x: startX, y: startY, angle: startAngle };
    }

    const targetX = startPosRef.current.x;
    const targetY = startPosRef.current.y;
    const targetAngle = startPosRef.current.angle;

    robotRef.current = {
      x: targetX,
      y: targetY,
      angle: targetAngle,
      yawResetAngle: targetAngle,
      leftSpeed: 0,
      rightSpeed: 0,
      matrixText: '',
      matrixImage: '',
      beepActive: false,
      trail: [],
      distance: 200,
      color: -1,
      reflection: 100,
      collision: false,
    };

    setSensorsDisplay({
      x: Math.round(targetX),
      y: Math.round(targetY),
      angle: Math.round(targetAngle),
      leftSpeed: 0,
      rightSpeed: 0,
      distance: 200,
      colorName: 'Nessuno',
      colorHex: '#CCCCCC',
      reflection: 100,
      collision: false,
      matrixText: '',
      matrixImage: '',
    });
  }, [mapType]);

  useEffect(() => {
    resetRobot(true);
  }, [mapType, resetRobot]);

  // Helper to translate client/touch coordinates to canvas coordinates (800x380) taking into account object-contain scaling
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | MouseEvent | TouchEvent | WheelEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    
    if ('touches' in e) {
      if (e.touches.length === 0) {
        if ('targetTouches' in e && (e as TouchEvent).targetTouches.length > 0) {
          clientX = (e as TouchEvent).targetTouches[0].clientX;
          clientY = (e as TouchEvent).targetTouches[0].clientY;
        } else if ('changedTouches' in e && (e as TouchEvent).changedTouches.length > 0) {
          clientX = (e as TouchEvent).changedTouches[0].clientX;
          clientY = (e as TouchEvent).changedTouches[0].clientY;
        } else {
          return { x: 0, y: 0 };
        }
      } else {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const r_img = 800 / 380; // exactly 240 / 114
    const r_container = rect.width / rect.height;
    
    let w_render = rect.width;
    let h_render = rect.height;
    let dx = 0;
    let dy = 0;
    
    if (r_container > r_img) {
      h_render = rect.height;
      w_render = rect.height * r_img;
      dx = (rect.width - w_render) / 2;
    } else {
      w_render = rect.width;
      h_render = rect.width / r_img;
      dy = (rect.height - h_render) / 2;
    }
    
    const clickX = clientX - rect.left - dx;
    const clickY = clientY - rect.top - dy;
    
    const x = (clickX / w_render) * 800;
    const y = (clickY / h_render) * 380;
    
    return { x, y };
  };

  const getWorldCoords = (canvasX: number, canvasY: number) => {
    return {
      x: (canvasX - panOffsetRef.current.x) / scaleRef.current,
      y: (canvasY - panOffsetRef.current.y) / scaleRef.current
    };
  };

  // Handle Dragging of obstacles or panning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x: canvasX, y: canvasY } = getCanvasCoords(e);
    const { x: worldX, y: worldY } = getWorldCoords(canvasX, canvasY);

    // Check if clicked the robot (within 30 pixels of center)
    const rob = robotRef.current;
    const distToRobot = Math.hypot(worldX - rob.x, worldY - rob.y);
    if (distToRobot < 30) {
      setIsDraggingRobot(true);
      stopSimulationCode();
      setIsPlaying(false);
      dragOffset.current = { x: worldX - rob.x, y: worldY - rob.y };
      return;
    }

    // Check if clicked an obstacle
    for (let obs of obstacles) {
      let isHit = false;
      if (obs.shape === 'circle') {
        const r = obs.w / 2;
        const cx = obs.x + r;
        const cy = obs.y + r;
        const dx = worldX - cx;
        const dy = worldY - cy;
        if (dx * dx + dy * dy <= r * r) {
          isHit = true;
        }
      } else {
        if (worldX >= obs.x && worldX <= obs.x + obs.w && worldY >= obs.y && worldY <= obs.y + obs.h) {
          isHit = true;
        }
      }

      if (isHit) {
        setIsDraggingObstacle(obs.id);
        setSelectedObstacleId(obs.id);
        setIsSidebarOpen(true);
        dragOffset.current = { x: worldX - obs.x, y: worldY - obs.y };
        return;
      }
    }

    // Deselect if clicked empty background
    setSelectedObstacleId(null);

    // Otherwise, start panning!
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panOffsetStartRef.current = { ...panOffsetRef.current };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRobot) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x: canvasX, y: canvasY } = getCanvasCoords(e);
      const { x: worldX, y: worldY } = getWorldCoords(canvasX, canvasY);

      const newX = Math.max(15, Math.min(800 - 15, worldX - dragOffset.current.x));
      const newY = Math.max(15, Math.min(380 - 15, worldY - dragOffset.current.y));

      robotRef.current.x = newX;
      robotRef.current.y = newY;
      robotRef.current.leftSpeed = 0;
      robotRef.current.rightSpeed = 0;
      
      // Update designated starting position
      startPosRef.current = { x: newX, y: newY, angle: robotRef.current.angle };
    } else if (isDraggingObstacle !== null) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x: canvasX, y: canvasY } = getCanvasCoords(e);
      const { x: worldX, y: worldY } = getWorldCoords(canvasX, canvasY);

      setObstacles(prev =>
        prev.map(obs => {
          if (obs.id === isDraggingObstacle) {
            // Constrain within canvas boundaries
            const newX = Math.max(10, Math.min(800 - obs.w - 10, worldX - dragOffset.current.x));
            const newY = Math.max(10, Math.min(380 - obs.h - 10, worldY - dragOffset.current.y));
            return { ...obs, x: newX, y: newY };
          }
          return obs;
        })
      );
    } else if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      panOffsetRef.current = {
        x: panOffsetStartRef.current.x + dx,
        y: panOffsetStartRef.current.y + dy
      };
    }
  };

  const handleMouseUp = () => {
    setIsDraggingObstacle(null);
    setIsDraggingRobot(false);
    setIsPanning(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    const { x: canvasX, y: canvasY } = getCanvasCoords(e);
    const { x: worldX, y: worldY } = getWorldCoords(canvasX, canvasY);

    // Check if clicked the robot (within 30 pixels of center)
    const rob = robotRef.current;
    const distToRobot = Math.hypot(worldX - rob.x, worldY - rob.y);
    if (distToRobot < 30) {
      setIsDraggingRobot(true);
      stopSimulationCode();
      setIsPlaying(false);
      dragOffset.current = { x: worldX - rob.x, y: worldY - rob.y };
      return;
    }

    // Check if touched an obstacle
    for (let obs of obstacles) {
      let isHit = false;
      if (obs.shape === 'circle') {
        const r = obs.w / 2;
        const cx = obs.x + r;
        const cy = obs.y + r;
        const dx = worldX - cx;
        const dy = worldY - cy;
        if (dx * dx + dy * dy <= r * r) {
          isHit = true;
        }
      } else {
        if (worldX >= obs.x && worldX <= obs.x + obs.w && worldY >= obs.y && worldY <= obs.y + obs.h) {
          isHit = true;
        }
      }

      if (isHit) {
        setIsDraggingObstacle(obs.id);
        setSelectedObstacleId(obs.id);
        setIsSidebarOpen(true);
        dragOffset.current = { x: worldX - obs.x, y: worldY - obs.y };
        return;
      }
    }

    // Deselect if touched empty background
    setSelectedObstacleId(null);

    // Otherwise, start panning!
    setIsPanning(true);
    panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    panOffsetStartRef.current = { ...panOffsetRef.current };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    if (isDraggingRobot) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x: canvasX, y: canvasY } = getCanvasCoords(e);
      const { x: worldX, y: worldY } = getWorldCoords(canvasX, canvasY);

      const newX = Math.max(15, Math.min(800 - 15, worldX - dragOffset.current.x));
      const newY = Math.max(15, Math.min(380 - 15, worldY - dragOffset.current.y));

      robotRef.current.x = newX;
      robotRef.current.y = newY;
      robotRef.current.leftSpeed = 0;
      robotRef.current.rightSpeed = 0;
      
      // Update designated starting position
      startPosRef.current = { x: newX, y: newY, angle: robotRef.current.angle };
    } else if (isDraggingObstacle !== null) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x: canvasX, y: canvasY } = getCanvasCoords(e);
      const { x: worldX, y: worldY } = getWorldCoords(canvasX, canvasY);

      setObstacles(prev =>
        prev.map(obs => {
          if (obs.id === isDraggingObstacle) {
            // Constrain within canvas boundaries
            const newX = Math.max(10, Math.min(800 - obs.w - 10, worldX - dragOffset.current.x));
            const newY = Math.max(10, Math.min(380 - obs.h - 10, worldY - dragOffset.current.y));
            return { ...obs, x: newX, y: newY };
          }
          return obs;
        })
      );
    } else if (isPanning) {
      const dx = e.touches[0].clientX - panStartRef.current.x;
      const dy = e.touches[0].clientY - panStartRef.current.y;
      panOffsetRef.current = {
        x: panOffsetStartRef.current.x + dx,
        y: panOffsetStartRef.current.y + dy
      };
    }
  };

  // Setup Wheel Zoom Event Listener with passive: false to prevent background scrolling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const { x: canvasX, y: canvasY } = getCanvasCoords(e);
      const { x: worldX, y: worldY } = getWorldCoords(canvasX, canvasY);

      const factor = e.deltaY < 0 ? 1.15 : 0.85;
      const newScale = Math.max(0.5, Math.min(5.0, scaleRef.current * factor));
      const newPanX = canvasX - worldX * newScale;
      const newPanY = canvasY - worldY * newScale;

      scaleRef.current = newScale;
      panOffsetRef.current = { x: newPanX, y: newPanY };
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleZoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const centerX = 400;
    const centerY = 190;
    const { x: worldX, y: worldY } = getWorldCoords(centerX, centerY);

    const newScale = Math.min(5.0, scaleRef.current * 1.2);
    const newPanX = centerX - worldX * newScale;
    const newPanY = centerY - worldY * newScale;

    scaleRef.current = newScale;
    panOffsetRef.current = { x: newPanX, y: newPanY };
  };

  const handleZoomOut = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const centerX = 400;
    const centerY = 190;
    const { x: worldX, y: worldY } = getWorldCoords(centerX, centerY);

    const newScale = Math.max(0.5, scaleRef.current / 1.2);
    const newPanX = centerX - worldX * newScale;
    const newPanY = centerY - worldY * newScale;

    scaleRef.current = newScale;
    panOffsetRef.current = { x: newPanX, y: newPanY };
  };

  const handleZoomReset = () => {
    scaleRef.current = 1.0;
    panOffsetRef.current = { x: 0, y: 0 };
  };

  // Python-to-JS parser/transpiler for our Spike Virtual machine
  const transpilePythonToJs = (pythonCode: string) => {
    // 1. Rimuove indentazione iniziale comune
    const stripCommonIndent = (codeStr: string): string => {
      const lines = codeStr.split('\n');
      let minIndent = Infinity;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const indent = line.length - line.trimStart().length;
          if (indent < minIndent) {
            minIndent = indent;
          }
        }
      }
      if (minIndent === Infinity || minIndent === 0) return codeStr;
      return lines.map(line => {
        if (line.trim().length === 0) return '';
        return line.substring(Math.min(minIndent, line.length - line.trimStart().length));
      }).join('\n');
    };

    const strippedPython = stripCommonIndent(pythonCode);

    // 2. Sostituzioni Espressioni Python Base
    const translateExpression = (expr: string): string => {
      let e = expr;
      
      e = e.replace(/\bnot\b/g, '!');
      e = e.replace(/\band\b/g, '&&');
      e = e.replace(/\bor\b/g, '||');
      e = e.replace(/\bTrue\b/g, 'true');
      e = e.replace(/\bFalse\b/g, 'false');
      e = e.replace(/\bNone\b/g, 'null');
      
      e = e.replace(/\bint\(/g, 'py_int(');
      e = e.replace(/\bfloat\(/g, 'py_float(');
      e = e.replace(/\bstr\(/g, 'py_str(');
      e = e.replace(/\blen\(/g, 'py_len(');
      e = e.replace(/\babs\(/g, 'py_abs(');
      e = e.replace(/\bround\(/g, 'py_round(');
      e = e.replace(/\bmin\(/g, 'py_min(');
      e = e.replace(/\bmax\(/g, 'py_max(');
      
      // Standard LEGO Spike sensor calls
      e = e.replace(/color_sensor\.color\(\s*port\.([a-zA-Z0-9_]+)\s*\)/g, 'getColor("$1")');
      e = e.replace(/color_sensor\.reflection\(\s*port\.([a-zA-Z0-9_]+)\s*\)/g, 'getReflection("$1")');
      e = e.replace(/distance_sensor\.distance\(\s*port\.([a-zA-Z0-9_]+)\s*\)/g, 'getDistance("$1")');
      e = e.replace(/force_sensor\.force\(\s*port\.([a-zA-Z0-9_]+)\s*\)/g, 'getForce("$1")');
      
      // _safe_sensor wrapper calls
      e = e.replace(/_safe_sensor\(color_sensor\.color,\s*port\.([a-zA-Z0-9_]+)(?:,\s*[^)]*)?\)/g, 'getColor("$1")');
      e = e.replace(/_safe_sensor\(color_sensor\.reflection,\s*port\.([a-zA-Z0-9_]+)(?:,\s*[^)]*)?\)/g, 'getReflection("$1")');
      e = e.replace(/_safe_sensor\(distance_sensor\.distance,\s*port\.([a-zA-Z0-9_]+)(?:,\s*[^)]*)?\)/g, 'getDistance("$1")');
      e = e.replace(/_safe_sensor\(force_sensor\.force,\s*port\.([a-zA-Z0-9_]+)(?:,\s*[^)]*)?\)/g, 'getForce("$1")');
      e = e.replace(/_safe_sensor\(motion_sensor\.yaw_angle\)/g, 'getYaw()');
      e = e.replace(/_safe_sensor\(motion_sensor\.pitch_angle\)/g, 'getPitch()');
      e = e.replace(/_safe_sensor\(motion_sensor\.roll_angle\)/g, 'getRoll()');
      
      // Gyro/tilt angles standard calls
      e = e.replace(/motion_sensor\.tilt_angles\(\)\[0\]/g, 'getYaw()');
      e = e.replace(/motion_sensor\.tilt_angles\(\)\[1\]/g, 'getPitch()');
      e = e.replace(/motion_sensor\.tilt_angles\(\)\[2\]/g, 'getRoll()');
      
      // Replace Python int and float with safe non-reserved JS parameter names
      e = e.replace(/\bint\b/g, 'py_int');
      e = e.replace(/\bfloat\b/g, 'py_float');
      
      return e;
    };

    // 3. Sostituzioni Statements Base
    const translateStatement = (stmt: string): string => {
      let s = stmt;
      
      // replace sleep/delays (standard and internal)
      s = s.replace(/await\s+runloop\.sleep_ms\((.*?)\)/g, 'await sleep($1)');
      s = s.replace(/await\s+custom_sleep\((.*?)\)/g, 'await sleep($1)');
      
      // replace drive pairs (standard & simulator-internal)
      s = s.replace(/await\s+_drive_pair_for_degrees\((.*?),\s*(.*?),\s*(.*?)\)/g, 'await drivePairForDegrees($1, $2, $3)');
      s = s.replace(/_drive_pair_for_degrees\((.*?),\s*(.*?),\s*(.*?)\)/g, 'drivePairForDegrees($1, $2, $3)');
      s = s.replace(/await\s+_drive_pair\((.*?),\s*(.*?)\)/g, 'await drivePair($1, $2)');
      s = s.replace(/_drive_pair\((.*?),\s*(.*?)\)/g, 'drivePair($1, $2)');
      s = s.replace(/_stop_pair\(\)/g, 'stopPair()');
      
      // replace light matrix (standard & simulator-internal)
      s = s.replace(/light_matrix\.write\((.*?)\)/g, 'writeLightMatrix($1)');
      s = s.replace(/_write_light_matrix\((.*?)\)/g, 'writeLightMatrix($1)');
      s = s.replace(/light_matrix\.clear\(\)/g, 'clearLightMatrix()');
      s = s.replace(/_clear_light_matrix\(\)/g, 'clearLightMatrix()');
      s = s.replace(/light_matrix\.show_image\(light_matrix\.(.*?)\)/g, 'showImageLightMatrix("$1")');
      s = s.replace(/_show_image_light_matrix\((.*?)\)/g, 'showImageLightMatrix($1)');
      
      // replace sounds (standard & simulator-internal)
      s = s.replace(/sound\.beep\((.*?),\s*(.*?)\)/g, 'playNote($1, $2)');
      s = s.replace(/sound\.beep\(\)/g, 'beep()');
      s = s.replace(/_play_note\((.*?),\s*(.*?)\)/g, 'playNote($1, $2)');
      s = s.replace(/_beep\(\)/g, 'beep()');
      
      // replace motor controllers (standard & simulator-internal)
      s = s.replace(/await\s+motor\.run_for_degrees\(port\.(.*?),\s*(.*?),\s*(.*?)\)/g, 'await runMotorForDegrees("$1", $2, $3)');
      s = s.replace(/motor\.run\(port\.(.*?),\s*(.*?)\)/g, 'runMotor("$1", $2)');
      s = s.replace(/motor\.stop\(port\.(.*?)\)/g, 'stopMotor("$1")');
      
      s = s.replace(/_run_motor_for_degrees\((.*?),\s*(.*?),\s*(.*?)\)/g, 'runMotorForDegrees($1, $2, $3)');
      s = s.replace(/_run_motor\((.*?),\s*(.*?)\)/g, 'runMotor($1, $2)');
      s = s.replace(/_stop_motor\((.*?)\)/g, 'stopMotor($1)');
      
      // replace motion/gyro (standard & simulator-internal)
      s = s.replace(/motion_sensor\.reset_yaw\((.*?)\)/g, 'resetYaw($1)');
      s = s.replace(/_reset_yaw\((.*?)\)/g, 'resetYaw($1)');
      
      // print statement
      s = s.replace(/print\((.*?)\)/g, 'print($1)');

      // SAFE ASSIGNMENT CHECK
      // Match only when there is a valid variable name on the LHS, followed by a single '=' which is NOT part of '==', '!=', '>=', '<='
      const assignmentMatch = s.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^=].*)$/);
      if (assignmentMatch) {
        const lhs = assignmentMatch[1].trim();
        const rhs = assignmentMatch[2].trim();
        s = `${lhs} = ${translateExpression(rhs)}`;
      } else {
        s = translateExpression(s);
      }

      return s + (s.endsWith('}') || s.endsWith('{') ? '' : ';');
    };

    let jsCode = '';
    
    // Lo stack tiene traccia dei blocchi aperti
    const blockStack: { type: string, indent: number }[] = [];
    
    // 4. Scansione preliminare delle variabili per dichiarazione
    const varRegex = /^[ \t]*([a-zA-Z_][a-zA-Z0-9_]*)\s*=[^=]/;
    const declaredVars = new Set<string>();
    const lines = strippedPython.split('\n');
    for (const line of lines) {
      const match = line.match(varRegex);
      if (match) {
        declaredVars.add(match[1]);
      }
    }
    const declarations = Array.from(declaredVars).map(v => `let ${v} = 0;`).join('\n') + (declaredVars.size > 0 ? '\n' : '');
    jsCode += declarations;

    // 5. Scansione del corpo linea per linea
    for (let i = 0; i < lines.length; i++) {
      const origLine = lines[i];
      const trimmed = origLine.trim();
      
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      
      const indent = origLine.length - origLine.trimStart().length;
      
      // Chiusura blocchi
      while (blockStack.length > 0) {
        const topBlock = blockStack[blockStack.length - 1];
        if (indent <= topBlock.indent) {
           const blockType = topBlock.type;
           const blockIndent = topBlock.indent;
           blockStack.pop();
           
           if (blockType === 'try') {
               if (indent === blockIndent && (trimmed.startsWith('except') || trimmed.startsWith('finally'))) {
                   jsCode += ' '.repeat(blockIndent) + '}\n';
               } else {
                   jsCode += ' '.repeat(blockIndent) + '} catch (e) {}\n';
               }
           } else if (blockType === 'while') {
               jsCode += ' '.repeat(blockIndent + 4) + 'await sleep(10);\n';
               jsCode += ' '.repeat(blockIndent) + '}\n';
           } else {
               jsCode += ' '.repeat(blockIndent) + '}\n';
           }
        } else {
           break;
        }
      }
      
      let translated = trimmed;
      let lineComment = '';
      const hashIndex = translated.indexOf('#');
      if (hashIndex !== -1) {
        lineComment = translated.substring(hashIndex);
        translated = translated.substring(0, hashIndex).trim();
      }
      
      // Control flows JS
      if (translated === 'while True:') {
        translated = 'while (true) {';
        blockStack.push({ type: 'while', indent: indent });
      } else if ((translated.startsWith('while ') || translated.startsWith('while(')) && translated.endsWith(':')) {
        const cond = translated.startsWith('while(') ? translated.substring(5, translated.length - 1) : translated.substring(6, translated.length - 1);
        translated = `while (${translateExpression(cond.trim())}) {`;
        blockStack.push({ type: 'while', indent: indent });
      } else if ((translated.startsWith('if ') || translated.startsWith('if(') || translated.startsWith('se ') || translated.startsWith('se(')) && translated.endsWith(':')) {
        let cond = '';
        if (translated.startsWith('if(')) cond = translated.substring(2, translated.length - 1);
        else if (translated.startsWith('if ')) cond = translated.substring(3, translated.length - 1);
        else if (translated.startsWith('se(')) cond = translated.substring(2, translated.length - 1);
        else cond = translated.substring(3, translated.length - 1);
        translated = `if (${translateExpression(cond.trim())}) {`;
        blockStack.push({ type: 'if', indent: indent });
      } else if ((translated.startsWith('elif ') || translated.startsWith('elif(')) && translated.endsWith(':')) {
        const cond = translated.startsWith('elif(') ? translated.substring(4, translated.length - 1) : translated.substring(5, translated.length - 1);
        translated = `else if (${translateExpression(cond.trim())}) {`;
        blockStack.push({ type: 'if', indent: indent });
      } else if (translated === 'else:') {
        translated = 'else {';
        blockStack.push({ type: 'if', indent: indent });
      } else if (translated.startsWith('async def ') && translated.endsWith(':')) {
        const funcHeader = translated.substring(10, translated.length - 1);
        translated = `async function ${funcHeader} {`;
        blockStack.push({ type: 'def', indent: indent });
      } else if (translated.startsWith('def ') && translated.endsWith(':')) {
        const funcHeader = translated.substring(4, translated.length - 1);
        translated = `function ${funcHeader} {`;
        blockStack.push({ type: 'def', indent: indent });
      } else if (translated.startsWith('for ') && translated.endsWith(':')) {
        const forRangeMatch = translated.match(/^for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+range\((.*)\)\s*:$/);
        if (forRangeMatch) {
          const varName = forRangeMatch[1];
          const rangeArgsStr = forRangeMatch[2].trim();
          const args = rangeArgsStr.split(',').map(a => a.trim());
          let start = '0', stop = '0', step = '1';
          if (args.length === 1) stop = translateExpression(args[0]);
          else if (args.length === 2) { start = translateExpression(args[0]); stop = translateExpression(args[1]); }
          else if (args.length === 3) { start = translateExpression(args[0]); stop = translateExpression(args[1]); step = translateExpression(args[2]); }
          const isNegativeStep = step.startsWith('-') || parseInt(step) < 0;
          const cmp = isNegativeStep ? '>' : '<';
          const increment = step === '1' ? `${varName}++` : (step === '-1' ? `${varName}--` : `${varName} += ${step}`);
          translated = `for (let ${varName} = ${start}; ${varName} ${cmp} ${stop}; ${increment}) {`;
        } else {
          const forInMatch = translated.match(/^for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+(.*)\s*:$/);
          if (forInMatch) {
            const varName = forInMatch[1];
            const iterable = translateExpression(forInMatch[2].trim());
            translated = `for (let ${varName} of ${iterable}) {`;
          }
        }
        blockStack.push({ type: 'for', indent: indent });
      } else if (translated === 'try:') {
        translated = 'try {';
        blockStack.push({ type: 'try', indent: indent });
      } else if (translated.startsWith('except') && translated.endsWith(':')) {
        translated = 'catch (e) {';
        blockStack.push({ type: 'except', indent: indent });
      } else if (translated === 'finally:') {
        translated = 'finally {';
        blockStack.push({ type: 'finally', indent: indent });
      } else if (translated.startsWith('try: ')) {
        const stmt = translated.substring(5).trim();
        translated = `try { ${translateStatement(stmt)}`;
        blockStack.push({ type: 'try', indent: indent });
      } else if (translated === 'pass') {
        translated = '// pass';
      } else if (translated.startsWith('global ')) {
        translated = '// global ' + translated.substring(7);
      } else if (translated.startsWith('import ') || translated.startsWith('from ')) {
        translated = '// ' + translated;
      } else if (translated.startsWith('raise ')) {
        translated = 'throw new Error(String(' + translated.substring(6) + '));';
      } else {
        translated = translateStatement(translated);
      }
      
      jsCode += ' '.repeat(indent) + translated + (lineComment ? ' ' + lineComment.replace('#', '//') : '') + '\n';
    }
    
    // 6. Svuota lo Stack residuo a fine file
    while (blockStack.length > 0) {
      const topBlock = blockStack.pop();
      if (!topBlock) break;
      const { type: blockType, indent: blockIndent } = topBlock;
      
      if (blockType === 'try') {
        jsCode += ' '.repeat(blockIndent) + '} catch (e) {}\n';
      } else if (blockType === 'while') {
        jsCode += ' '.repeat(blockIndent + 4) + 'await sleep(10);\n';
        jsCode += ' '.repeat(blockIndent) + '}\n';
      } else {
        jsCode += ' '.repeat(blockIndent) + '}\n';
      }
    }
    
    console.log("Transpiled JS code:\n", jsCode);
    return jsCode;
  };

  // Extract user code block between lego templates
  const extractUserCode = (fullCode: string) => {
    const startMarker = '# === START_BLOCKLY_CODE ===';
    const endMarker = '# === END_BLOCKLY_CODE ===';
    const startIndex = fullCode.indexOf(startMarker);
    const endIndex = fullCode.indexOf(endMarker);
    
    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
      return fullCode.substring(startIndex + startMarker.length, endIndex).trim();
    }
    return fullCode;
  };

  // Run the code in the simulator
  const runSimulationCode = async () => {
    // Clear trail when starting code execution
    if (robotRef.current) {
      robotRef.current.trail = [];
    }

    if (isRunningCode) {
      stopSimulationCode();
      await new Promise(r => setTimeout(r, 150));
    }

    setConsoleLogs([]);
    const userBlock = extractUserCode(code);
    if (!userBlock || userBlock.length === 0) {
      setConsoleLogs(['[Simulatore] Nessun codice utente da eseguire. Crea dei blocchi prima.']);
      return;
    }

    const jsCode = transpilePythonToJs(userBlock);
    console.log("Transpiled JS code:\n", jsCode);
    setConsoleLogs(prev => [...prev, '[Simulatore] Codice caricato e compilato con successo.']);
    
    setIsRunningCode(true);
    setIsPlaying(true);

    const execId = ++activeExecutionId.current;

    // Simulation SDK mapping
    const sleep = (ms: number) => {
      return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          if (execId !== activeExecutionId.current) {
            reject(new Error('Interrupted'));
          } else {
            resolve();
          }
        }, ms);
      });
    };

    const drivePair = (steering: number, velocity: number) => {
      if (execId !== activeExecutionId.current) return;
      
      // Handle inverse speeds or steering calculations
      let speedL = velocity;
      let speedR = velocity;
      
      if (steering > 0) {
        speedR = Math.round(velocity * (50 - steering) / 50);
      } else if (steering < 0) {
        speedL = Math.round(velocity * (50 + steering) / 50);
      }

      // Scaling down speed values to match virtual pixels/second (using 800/240 pixels per cm, divided by 10)
      const K_speed = (((Math.PI * (wheelDiameter || 5.6)) / 6480) * (800 / 240)) / 10;
      robotRef.current.leftSpeed = speedL * K_speed;
      robotRef.current.rightSpeed = speedR * K_speed;
    };

    const drivePairForDegrees = async (degrees: number, steering: number, velocity: number) => {
      if (execId !== activeExecutionId.current) return;
      drivePair(steering, velocity);
      
      // Calculate delay needed based on wheel specifications
      const avgSpeed = Math.abs(velocity) || 1;
      // Rough estimation: time = degrees / speed scale (multiplied by 10 because speed is divided by 10)
      const durationMs = (Math.abs(degrees) / avgSpeed) * 3000;
      await sleep(durationMs);
      stopPair();
    };

    const stopPair = () => {
      if (execId !== activeExecutionId.current) return;
      robotRef.current.leftSpeed = 0;
      robotRef.current.rightSpeed = 0;
    };

    const runMotor = (port: string, speed: number) => {
      if (execId !== activeExecutionId.current) return;
      // Individual motor control
      const K_speed = (((Math.PI * (wheelDiameter || 5.6)) / 6480) * (800 / 240)) / 10;
      const scaledSpeed = speed * K_speed;
      if (port === 'A' || port === 'C') {
        robotRef.current.leftSpeed = scaledSpeed;
      } else {
        robotRef.current.rightSpeed = scaledSpeed;
      }
    };

    const stopMotor = (port: string) => {
      if (execId !== activeExecutionId.current) return;
      if (port === 'A' || port === 'C') {
        robotRef.current.leftSpeed = 0;
      } else {
        robotRef.current.rightSpeed = 0;
      }
    };

    const runMotorForDegrees = async (port: string, degrees: number, speed: number) => {
      if (execId !== activeExecutionId.current) return;
      runMotor(port, speed);
      const durationMs = (Math.abs(degrees) / (Math.abs(speed) || 1)) * 3000;
      await sleep(durationMs);
      stopMotor(port);
    };

    const writeLightMatrix = (text: any) => {
      if (execId !== activeExecutionId.current) return;
      robotRef.current.matrixText = String(text);
      robotRef.current.matrixImage = '';
      setConsoleLogs(prev => [...prev, `[Schermo] Testo: "${text}"`]);
    };

    const clearLightMatrix = () => {
      if (execId !== activeExecutionId.current) return;
      robotRef.current.matrixText = '';
      robotRef.current.matrixImage = '';
    };

    const showImageLightMatrix = (imageName: string) => {
      if (execId !== activeExecutionId.current) return;
      robotRef.current.matrixText = '';
      robotRef.current.matrixImage = imageName;
      setConsoleLogs(prev => [...prev, `[Schermo] Mostrata immagine: ${imageName}`]);
    };

    const playNote = (note: number, duration: number) => {
      if (execId !== activeExecutionId.current) return;
      triggerBeep(note, duration);
    };

    const beep = () => {
      if (execId !== activeExecutionId.current) return;
      triggerBeep(880, 150);
    };

    const resetYaw = (angle = 0) => {
      if (execId !== activeExecutionId.current) return;
      robotRef.current.yawResetAngle = robotRef.current.angle - angle;
    };

    const getYaw = () => {
      let relative = robotRef.current.angle - robotRef.current.yawResetAngle;
      // normalize -180 to 180 using mathematically correct modulo
      relative = ((((relative + 180) % 360) + 360) % 360) - 180;
      return Math.round(relative);
    };

    const getPitch = () => 0;
    const getRoll = () => 0;

    const getColor = (port: string) => {
      const p = String(port).toUpperCase();
      const reading = sensorReadingsRef.current[p];
      if (reading && reading.type === 'color') {
        return reading.color;
      }
      const fallback = Object.values(sensorReadingsRef.current).find((r: any) => r.type === 'color') as any;
      return fallback ? fallback.color : -1;
    };

    const getReflection = (port: string) => {
      const p = String(port).toUpperCase();
      const reading = sensorReadingsRef.current[p];
      if (reading && reading.type === 'color') {
        return reading.reflection;
      }
      const fallback = Object.values(sensorReadingsRef.current).find((r: any) => r.type === 'color') as any;
      return fallback ? fallback.reflection : 0;
    };

    const getDistance = (port: string) => {
      const p = String(port).toUpperCase();
      const reading = sensorReadingsRef.current[p];
      if (reading && reading.type === 'distance') {
        return Math.round(reading.distance);
      }
      const fallback = Object.values(sensorReadingsRef.current).find((r: any) => r.type === 'distance') as any;
      return fallback ? Math.round(fallback.distance) : 200;
    };

    const getForce = (port: string) => {
      const p = String(port).toUpperCase();
      const reading = sensorReadingsRef.current[p];
      if (reading && reading.type === 'force') {
        return reading.force;
      }
      const fallback = Object.values(sensorReadingsRef.current).find((r: any) => r.type === 'force') as any;
      return fallback ? fallback.force : 0;
    };

    const print = (text: any) => {
      setConsoleLogs(prev => [...prev, `[Print] ${String(text)}`]);
    };

    // Create Async Context Execution
    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      
      const py_int = (val: any) => {
        const num = Number(val);
        return isNaN(num) ? 0 : Math.trunc(num);
      };
      const py_float = (val: any) => {
        const num = Number(val);
        return isNaN(num) ? 0.0 : num;
      };
      const py_str = (val: any) => String(val);
      const py_len = (val: any) => {
        if (val === null || val === undefined) return 0;
        if (typeof val.length === 'number') return val.length;
        if (typeof val.size === 'number') return val.size;
        return String(val).length;
      };
      const py_abs = (val: any) => Math.abs(Number(val));
      const py_round = (val: any, decimals: number = 0) => {
        const factor = Math.pow(10, decimals);
        return Math.round(Number(val) * factor) / factor;
      };
      const py_min = (...args: any[]) => {
        if (args.length === 1 && Array.isArray(args[0])) {
          return Math.min(...args[0].map(Number));
        }
        return Math.min(...args.map(Number));
      };
      const py_max = (...args: any[]) => {
        if (args.length === 1 && Array.isArray(args[0])) {
          return Math.max(...args[0].map(Number));
        }
        return Math.max(...args.map(Number));
      };

      const runnerFn = new AsyncFunction(
        'sleep', 'drivePair', 'drivePairForDegrees', 'stopPair',
        'writeLightMatrix', 'clearLightMatrix', 'showImageLightMatrix',
        'playNote', 'beep', 'runMotor', 'stopMotor', 'runMotorForDegrees',
        'resetYaw', 'getColor', 'getReflection', 'getDistance', 'getForce',
        'getYaw', 'getPitch', 'getRoll', 'print',
        'py_int', 'py_float', 'py_str', 'py_len', 'py_abs', 'py_round', 'py_min', 'py_max',
        'str', 'len', 'abs', 'round', 'min', 'max',
        `try {
          ${jsCode}
        } catch(e) {
          if (e.message !== 'Interrupted') {
             throw e;
          }
        }`
      );

      await runnerFn(
        sleep, drivePair, drivePairForDegrees, stopPair,
        writeLightMatrix, clearLightMatrix, showImageLightMatrix,
        playNote, beep, runMotor, stopMotor, runMotorForDegrees,
        resetYaw, getColor, getReflection, getDistance, getForce,
        getYaw, getPitch, getRoll, print,
        py_int, py_float, py_str, py_len, py_abs, py_round, py_min, py_max,
        py_str, py_len, py_abs, py_round, py_min, py_max
      );

      setConsoleLogs(prev => [...prev, '[Simulatore] Esecuzione completata.']);
    } catch (err: any) {
      if (err.message !== 'Interrupted') {
        console.error("Simulation run error:", err);
        setConsoleLogs(prev => [...prev, `[Errore Simulazione] ${err.message}\n===JSCODE===\n${jsCode}\n===ENDJSCODE===`]);
      }
    } finally {
      if (execId === activeExecutionId.current) {
        setIsRunningCode(false);
        setIsPlaying(false);
        robotRef.current.leftSpeed = 0;
        robotRef.current.rightSpeed = 0;
      }
    }
  };

  const stopSimulationCode = () => {
    activeExecutionId.current++; // Invalidates active running promise
    setIsRunningCode(false);
    robotRef.current.leftSpeed = 0;
    robotRef.current.rightSpeed = 0;
    setConsoleLogs(prev => [...prev, '[Simulatore] Esecuzione interrotta.']);
  };

  // Helper to draw background paths on offscreen canvas for color reading
  const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, forReading: boolean) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Draw grid if not for sensor reading
    if (!forReading) {
      ctx.strokeStyle = '#F0F0F0';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    if (mapType === 'line') {
      // Draw a line track
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      // Round loop track - Shifted 17px (approx 5cm) up
      ctx.moveTo(130, 118);
      ctx.bezierCurveTo(350, 43, 500, 43, 650, 118);
      ctx.bezierCurveTo(750, 183, 750, 263, 650, 298);
      ctx.bezierCurveTo(500, 353, 350, 353, 130, 298);
      ctx.bezierCurveTo(50, 263, 50, 183, 130, 118);
      ctx.stroke();

    } else if (mapType === 'colors') {
      // Draw massive colored areas for reading
      const colors = [
        { hex: '#EF4444', name: 'Rosso', x: 220, y: 70 },
        { hex: '#22C55E', name: 'Verde', x: 380, y: 70 },
        { hex: '#3B82F6', name: 'Blu', x: 540, y: 70 },
        { hex: '#EAB308', name: 'Giallo', x: 220, y: 230 },
        { hex: '#000000', name: 'Nero', x: 380, y: 230 },
        { hex: '#A855F7', name: 'Nessuno/Viola', x: 540, y: 230 },
      ];

      colors.forEach(col => {
        ctx.fillStyle = col.hex;
        ctx.fillRect(col.x, col.y, 110, 110);
        
        if (!forReading) {
          ctx.fillStyle = '#111111';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(col.name, col.x + 10, col.y + 25);
        }
      });
    } else if (mapType === 'maze') {
      // Draw wall lines of maze
      ctx.fillStyle = '#000000';
      // Outer borders are already handles in boundary check, let's draw inner maze walls
      const walls = [
        { x: 0, y: 150, w: 250, h: 20 },
        { x: 250, y: 150, w: 20, h: 150 },
        { x: 150, y: 250, w: 120, h: 20 },
        { x: 400, y: 0, w: 20, h: 220 },
        { x: 400, y: 220, w: 250, h: 20 },
        { x: 550, y: 120, w: 250, h: 20 },
        { x: 150, y: 320, w: 20, h: 100 },
        { x: 500, y: 300, w: 20, h: 100 },
      ];

      walls.forEach(w => {
        ctx.fillRect(w.x, w.y, w.w, w.h);
      });

      // Target area in green
      ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
      ctx.fillRect(680, 280, 100, 100);
      if (!forReading) {
        ctx.fillStyle = '#15803D';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('TRAGUARDO', 690, 335);
      }
    } else if (mapType === 'custom') {
      if (customBgImage) {
        ctx.drawImage(customBgImage, 0, 0, width, height);
      } else if (!forReading) {
        ctx.save();
        ctx.strokeStyle = '#3f3f46';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(40, 40, width - 80, height - 80);
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#a1a1aa';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Nessuna immagine di sfondo caricata.', width / 2, height / 2 - 10);
        
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#71717a';
        ctx.fillText('Clicca su "Carica Sfondo" in alto per selezionare un\'immagine dal computer.', width / 2, height / 2 + 15);
        ctx.restore();
      }
    }
  };

  // Main simulation render & update loop
  useEffect(() => {
    let animId: number;

    const canvas = canvasRef.current;
    const offscreen = offscreenCanvasRef.current;
    if (!canvas || !offscreen) return;

    const ctx = canvas.getContext('2d');
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!ctx || !offCtx) return;

    let lastTime = performance.now();

    // Fixed internal size of 800x380 (representing 240cm x 114cm at 3.333 px/cm)
    const W = 800;
    const H = 380;

    const updateCanvasSize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        const targetW = Math.floor(rect.width);
        const targetH = Math.floor(rect.height);
        
        if (canvas.style.width !== `${targetW}px` || canvas.style.height !== `${targetH}px`) {
          canvas.style.width = `${targetW}px`;
          canvas.style.height = `${targetH}px`;
        }
        
        const internalW = Math.floor(targetW * dpr);
        const internalH = Math.floor(targetH * dpr);
        
        if (canvas.width !== internalW || canvas.height !== internalH) {
          canvas.width = internalW;
          canvas.height = internalH;
        }
      }
    };

    const loop = () => {
      updateCanvasSize();

      const now = performance.now();
      let dt = (now - lastTime) / 1000;
      if (dt > 0.1) dt = 0.1; // Clamp dt to prevent extreme jumps (e.g. after backgrounding the tab)
      lastTime = now;

      const pW = canvas.width;
      const pH = canvas.height;

      // 1. Draw backgrounds
      ctx.fillStyle = '#09090b'; // dark container backdrop
      ctx.fillRect(0, 0, pW, pH);

      // offscreen canvas remains 800x380 for sensor reading accuracy
      offscreen.width = W;
      offscreen.height = H;
      drawBackground(offCtx, W, H, true);

      // Determine fit scaling
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : { width: pW, height: pH };
      const cssW = rect.width;
      const cssH = rect.height;
      
      const scaleX = cssW / 800;
      const scaleY = cssH / 380;
      const baseScale = Math.min(scaleX, scaleY);
      
      const offsetX = (cssW - 800 * baseScale) / 2;
      const offsetY = (cssH - 380 * baseScale) / 2;

      // Apply zoom & pan transformations on the visible canvas
      ctx.save();
      
      // Scale by devicePixelRatio because canvas internal resolution is magnified by dpr
      ctx.scale(dpr, dpr);
      
      // Shift to the centered starting position of the 800x380 map
      ctx.translate(offsetX, offsetY);
      
      // Scale by baseScale to make the 800x380 map fit the viewport
      ctx.scale(baseScale, baseScale);

      // Now apply the USER'S zoom & pan offsets (which operate in the map's coordinate system)
      ctx.translate(panOffsetRef.current.x, panOffsetRef.current.y);
      ctx.scale(scaleRef.current, scaleRef.current);

      drawBackground(ctx, W, H, false);

      // 2. Draggable Obstacles Rendering
      obstacles.forEach(obs => {
        const isSelected = obs.id === selectedObstacleId;
        const isCircle = obs.shape === 'circle';
        const radius = obs.w / 2;
        const cx = obs.x + radius;
        const cy = obs.y + radius;
        const fillColor = obs.pushable ? (obs.color || '#D97706') : '#4B5563';

        if (isCircle) {
          // Render circle shape
          ctx.fillStyle = fillColor;
          ctx.strokeStyle = obs.pushable ? '#78350F' : '#1F2937';
          ctx.lineWidth = obs.pushable ? 2.5 : 3;

          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          if (obs.pushable) {
            // Add detail to look like a circular crate / wooden barrel top
            ctx.strokeStyle = '#92400E';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            // Inner concentric circle
            ctx.arc(cx, cy, radius * 0.7, 0, Math.PI * 2);
            ctx.stroke();

            // Spoke lines / barrel planks
            ctx.beginPath();
            for (let angle = 0; angle < 360; angle += 45) {
              const rad = (angle * Math.PI) / 180;
              ctx.moveTo(cx + Math.cos(rad) * radius * 0.3, cy + Math.sin(rad) * radius * 0.3);
              ctx.lineTo(cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius);
            }
            ctx.stroke();
          } else {
            // Standard Column brick pattern
            ctx.strokeStyle = '#374151';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
            ctx.stroke();

            ctx.beginPath();
            for (let angle = 0; angle < 360; angle += 60) {
              const rad = (angle * Math.PI) / 180;
              ctx.moveTo(cx + Math.cos(rad) * radius * 0.5, cy + Math.sin(rad) * radius * 0.5);
              ctx.lineTo(cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius);
            }
            ctx.stroke();
          }
        } else {
          // Render square / rectangle shape
          ctx.fillStyle = fillColor;
          ctx.strokeStyle = obs.pushable ? '#78350F' : '#1F2937';
          ctx.lineWidth = obs.pushable ? 2.5 : 3;
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

          if (obs.pushable) {
            // Beautiful wooden cargo crate style
            ctx.strokeStyle = '#92400E';
            ctx.lineWidth = 1.5;
            const plankH = obs.h / 3;
            for (let i = 1; i < 3; i++) {
              ctx.beginPath();
              ctx.moveTo(obs.x, obs.y + i * plankH);
              ctx.lineTo(obs.x + obs.w, obs.y + i * plankH);
              ctx.stroke();
            }

            // Cross brace
            ctx.strokeStyle = '#78350F';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(obs.x + 3, obs.y + 3);
            ctx.lineTo(obs.x + obs.w - 3, obs.y + obs.h - 3);
            ctx.moveTo(obs.x + obs.w - 3, obs.y + 3);
            ctx.lineTo(obs.x + 3, obs.y + obs.h - 3);
            ctx.stroke();

            // Corner rivets
            ctx.fillStyle = '#451A03';
            const r = 1.5;
            [[obs.x+4, obs.y+4], [obs.x+obs.w-4, obs.y+4], [obs.x+4, obs.y+obs.h-4], [obs.x+obs.w-4, obs.y+obs.h-4]].forEach(([px, py]) => {
              ctx.beginPath();
              ctx.arc(px, py, r, 0, Math.PI * 2);
              ctx.fill();
            });
          } else {
            // Standard Solid Lego Brick
            ctx.strokeStyle = '#374151';
            ctx.lineWidth = 1;
            for (let ox = obs.x + 10; ox < obs.x + obs.w; ox += 10) {
              ctx.beginPath();
              ctx.moveTo(ox, obs.y);
              ctx.lineTo(ox, obs.y + obs.h);
              ctx.stroke();
            }
            for (let oy = obs.y + 10; oy < obs.y + obs.h; oy += 10) {
              ctx.beginPath();
              ctx.moveTo(obs.x, oy);
              ctx.lineTo(obs.x + obs.w, oy);
              ctx.stroke();
            }
          }
        }

        // Draw yellow outline around selected obstacle
        if (isSelected) {
          ctx.save();
          ctx.strokeStyle = '#F59E0B'; // Yellow orange
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 3]);
          if (isCircle) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.strokeRect(obs.x - 3, obs.y - 3, obs.w + 6, obs.h + 6);
          }
          ctx.restore();
        }
      });

      // 3. Physics Updates (only if playing)
      if (isPlaying) {
        const rob = robotRef.current;

        // Kinematics calculations
        const speedL = rob.leftSpeed;
        const speedR = rob.rightSpeed;
        
        const linearVel = (speedL + speedR) / 2;
        // Adjust rot speed coefficient based on robot wheel distance (scaled to pixels)
        const trackWidth = (wheelDistance || 11.5) * (800 / 240);
        const angularVel = ((speedR - speedL) / trackWidth) * (180 / Math.PI);

        // Convert heading to radians
        const headingRad = (rob.angle * Math.PI) / 180;

        // Apply new speeds to calculate position delta
        const timeScale = dt * 60;
        const nextAngle = rob.angle + angularVel * timeScale;
        
        // Use average heading (RK2 Heun's method) to avoid curving integration drift/errors
        const avgAngle = rob.angle + (angularVel * timeScale) / 2;
        const avgHeadingRad = (avgAngle * Math.PI) / 180;
        
        const nextX = rob.x + linearVel * Math.cos(avgHeadingRad) * timeScale;
        const nextY = rob.y + linearVel * Math.sin(avgHeadingRad) * timeScale;

        // Boundary collision check
        const robotSize = 25; // radius equivalent
        let collides = false;

        // Canvas margins check
        if (nextX < robotSize || nextX > W - robotSize || nextY < robotSize || nextY > H - robotSize) {
          collides = true;
        }

        // Maze Wall/Obstacle check (on offscreen pixel data or geometry)
        if (mapType === 'maze') {
          // Check pixel collision against black walls
          const checkPoints = [
            { x: nextX, y: nextY },
            { x: nextX + robotSize * Math.cos(headingRad), y: nextY + robotSize * Math.sin(headingRad) },
            { x: nextX - robotSize * Math.cos(headingRad), y: nextY - robotSize * Math.sin(headingRad) },
            { x: nextX + robotSize * Math.cos(headingRad + Math.PI/2), y: nextY + robotSize * Math.sin(headingRad + Math.PI/2) },
            { x: nextX + robotSize * Math.cos(headingRad - Math.PI/2), y: nextY + robotSize * Math.sin(headingRad - Math.PI/2) },
          ];

          for (let cp of checkPoints) {
            try {
              const pixel = offCtx.getImageData(Math.round(cp.x), Math.round(cp.y), 1, 1).data;
              if (pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0) { // Black walls
                collides = true;
                break;
              }
            } catch (e) {}
          }
        }

        // Draggable Box Collisions & Pushing
        obstaclesRef.current.forEach(obs => {
          let distSq = 0;
          let cx = 0;
          let cy = 0;
          let rBox = 0;

          const isCircle = obs.shape === 'circle';
          if (isCircle) {
            rBox = obs.w / 2;
            cx = obs.x + rBox;
            cy = obs.y + rBox;
            distSq = (cx - nextX) * (cx - nextX) + (cy - nextY) * (cy - nextY);
          } else {
            cx = Math.max(obs.x, Math.min(nextX, obs.x + obs.w));
            cy = Math.max(obs.y, Math.min(nextY, obs.y + obs.h));
            distSq = (cx - nextX) * (cx - nextX) + (cy - nextY) * (cy - nextY);
          }

          const collisionThreshold = isCircle ? (robotSize + rBox) : robotSize;
          const hasCollided = isCircle ? (distSq < collisionThreshold * collisionThreshold) : (distSq < robotSize * robotSize);

          if (hasCollided) {
            if (obs.pushable) {
              // Let's calculate the push offset!
              const dist = Math.sqrt(distSq);
              let dx = 0;
              let dy = 0;
              
              if (dist > 0.1) {
                const overlap = collisionThreshold - dist;
                // Push direction is away from the robot center
                const pushDirX = (cx - nextX) / dist;
                const pushDirY = (cy - nextY) / dist;
                dx = pushDirX * overlap;
                dy = pushDirY * overlap;
              } else {
                // If perfectly overlapping, push in the direction of heading
                const angleRad = (rob.angle * Math.PI) / 180;
                dx = Math.cos(angleRad) * 2;
                dy = Math.sin(angleRad) * 2;
              }

              // Propose new box position
              const newBoxX = obs.x + dx;
              const newBoxY = obs.y + dy;

              let boxBlocked = false;
              // Boundary check
              if (newBoxX < 5 || newBoxX + obs.w > W - 5 || newBoxY < 5 || newBoxY + obs.h > H - 5) {
                boxBlocked = true;
              }

              // Check other obstacles for collision
              if (!boxBlocked) {
                for (let other of obstaclesRef.current) {
                  if (other.id === obs.id) continue;
                  
                  const otherIsCircle = other.shape === 'circle';
                  const thisIsCircle = obs.shape === 'circle';
                  
                  if (thisIsCircle && otherIsCircle) {
                    const r1 = obs.w / 2;
                    const r2 = other.w / 2;
                    const cx1 = newBoxX + r1;
                    const cy1 = newBoxY + r1;
                    const cx2 = other.x + r2;
                    const cy2 = other.y + r2;
                    const dSq = (cx1 - cx2) * (cx1 - cx2) + (cy1 - cy2) * (cy1 - cy2);
                    if (dSq < (r1 + r2) * (r1 + r2)) {
                      boxBlocked = true;
                      break;
                    }
                  } else if (!thisIsCircle && !otherIsCircle) {
                    // Square-Square AABB collision
                    if (newBoxX < other.x + other.w &&
                        newBoxX + obs.w > other.x &&
                        newBoxY < other.y + other.h &&
                        newBoxY + obs.h > other.y) {
                      boxBlocked = true;
                      break;
                    }
                  } else {
                    // Circle-Square collision
                    const circle = thisIsCircle ? { r: obs.w / 2, x: newBoxX + obs.w/2, y: newBoxY + obs.w/2 } : { r: other.w / 2, x: other.x + other.w/2, y: other.y + other.w/2 };
                    const rect = thisIsCircle ? other : { x: newBoxX, y: newBoxY, w: obs.w, h: obs.h };
                    
                    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
                    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
                    const dSq = (closestX - circle.x) * (closestX - circle.x) + (closestY - circle.y) * (closestY - circle.y);
                    if (dSq < circle.r * circle.r) {
                      boxBlocked = true;
                      break;
                    }
                  }
                }
              }

              if (!boxBlocked) {
                // Update the obstacle's coordinates
                obs.x = newBoxX;
                obs.y = newBoxY;
              } else {
                // Box is blocked, so robot is blocked and collides
                collides = true;
              }
            } else {
              // Solid unpushable obstacle
              collides = true;
            }
          }
        });

        if (!collides) {
          rob.x = nextX;
          rob.y = nextY;
          rob.angle = nextAngle;
          rob.collision = false;
        } else {
          rob.collision = true;
          // rebound slightly
          rob.leftSpeed = 0;
          rob.rightSpeed = 0;
        }

        // Record Trait for trail drawing
        if (trailEnabled && linearVel !== 0) {
          const lastPoint = rob.trail[rob.trail.length - 1];
          if (!lastPoint || Math.hypot(lastPoint.x - rob.x, lastPoint.y - rob.y) > 3) {
            rob.trail.push({ x: rob.x, y: rob.y });
            if (rob.trail.length > 500) rob.trail.shift();
          }
        }
      }

      // 4. Trail Rendering
      if (trailEnabled && robotRef.current.trail.length > 1) {
        ctx.strokeStyle = '#EF4444'; // Red trail
        ctx.lineWidth = 2.5;
        ctx.setLineDash([1, 0]);
        ctx.beginPath();
        ctx.moveTo(robotRef.current.trail[0].x, robotRef.current.trail[0].y);
        for (let i = 1; i < robotRef.current.trail.length; i++) {
          ctx.lineTo(robotRef.current.trail[i].x, robotRef.current.trail[i].y);
        }
        ctx.stroke();
      }

      // 5. Sensor Calculations
      const rob = robotRef.current;
      const headingRad = (rob.angle * Math.PI) / 180;

      // Filter configured active sensors from props
      const activeSensors = (sensors || []).filter(s => s.port && s.type);
      // Fallback to default sensors if none configured
      const displaySensors = activeSensors.length > 0 ? activeSensors : [
        { id: 1, port: 'E', type: 'color' },
        { id: 2, port: 'F', type: 'distance' }
      ];

      const hasDistance = displaySensors.some(s => s.type === 'distance');
      const distanceSensors = displaySensors.filter(s => s.type === 'distance');
      const nonDistanceSensors = displaySensors.filter(s => s.type !== 'distance');

      const getSensorLocalCoords = (sensor: any, idx: number): { localX: number; localY: number } => {
        const colorSensors = displaySensors.filter(s => s.type === 'color');
        const forceSensors = displaySensors.filter(s => s.type === 'force');
        const distanceSensors = displaySensors.filter(s => s.type === 'distance');

        const hasTwoColors = colorSensors.length === 2;
        const hasForce = forceSensors.length > 0;
        const hasDistance = distanceSensors.length > 0;

        // Rule 1: Two color sensors -> opposite corners, brought closer together
        if (sensor.type === 'color') {
          if (hasTwoColors) {
            const colorIdx = colorSensors.findIndex(s => s.port === sensor.port);
            return {
              localX: 25,
              localY: colorIdx === 0 ? -12 : 12
            };
          } else {
            // Single color sensor: if there is a center sensor (force or distance), offset it to avoid overlap
            if (hasForce || hasDistance) {
              return {
                localX: 25,
                localY: -16
              };
            } else {
              return {
                localX: 25,
                localY: 0
              };
            }
          }
        }

        // Rule 2: Force (touch) sensor -> center front
        if (sensor.type === 'force') {
          const forceIdx = forceSensors.findIndex(s => s.port === sensor.port);
          if (forceSensors.length === 1) {
            return {
              localX: 30,
              localY: 0
            };
          } else {
            const spread = 12;
            return {
              localX: 30,
              localY: -spread / 2 + (forceIdx / (forceSensors.length - 1)) * spread
            };
          }
        }

        // Rule 3: Distance sensor -> center, shifted back on the yellow chassis (around x = 14)
        if (sensor.type === 'distance') {
          const distIdx = distanceSensors.findIndex(s => s.port === sensor.port);
          if (distanceSensors.length === 1) {
            return {
              localX: 14,
              localY: 0
            };
          } else {
            const spread = 12;
            return {
              localX: 14,
              localY: -spread / 2 + (distIdx / (distanceSensors.length - 1)) * spread
            };
          }
        }

        return { localX: 28, localY: 0 };
      };

      // Reset readings map for this frame
      const currentReadings: any = {};
      const currentReadingsListForState: any[] = [];

      displaySensors.forEach((sensor, idx) => {
        const { localX, localY } = getSensorLocalCoords(sensor, idx);

        // Map local coordinates to world coordinates
        const sensorX = rob.x + localX * Math.cos(headingRad) - localY * Math.sin(headingRad);
        const sensorY = rob.y + localX * Math.sin(headingRad) + localY * Math.cos(headingRad);

        if (sensor.type === 'color') {
          // Read pixel color from offscreen canvas
          let r = 255, g = 255, b = 255;
          const roundedX = Math.round(sensorX);
          const roundedY = Math.round(sensorY);
          if (roundedX >= 0 && roundedX < W && roundedY >= 0 && roundedY < H) {
            try {
              const p = offCtx.getImageData(roundedX, roundedY, 1, 1).data;
              r = p[0];
              g = p[1];
              b = p[2];
            } catch (e) {}
          }

          // Grayscale calculation for reflection (0-100)
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          const reflection = Math.round((brightness / 255) * 100);

          // Color ID mapping
          // 0=Nero, 3=Blu, 5=Verde, 7=Giallo, 9=Rosso, 10=Bianco, -1=Nessuno
          let colorID = -1;
          let colorName = 'Nessuno';
          let colorHex = '#CCCCCC';

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const chroma = max - min;

          if (max < 45 || (brightness < 65 && chroma < 25)) {
            colorID = 0;
            colorName = 'Nero';
            colorHex = '#000000';
          } else if (max > 185 && chroma < 25) {
            colorID = 10;
            colorName = 'Bianco';
            colorHex = '#FFFFFF';
          } else if (chroma >= 15) {
            let hue = 0;
            if (max === r) {
              hue = ((g - b) / chroma) % 6;
            } else if (max === g) {
              hue = (b - r) / chroma + 2;
            } else {
              hue = (r - g) / chroma + 4;
            }
            hue = Math.round(hue * 60);
            if (hue < 0) hue += 360;

            if (hue >= 340 || hue < 22) {
              colorID = 9;
              colorName = 'Rosso';
              colorHex = '#EF4444';
            } else if (hue >= 22 && hue < 75) {
              colorID = 7;
              colorName = 'Giallo';
              colorHex = '#EAB308';
            } else if (hue >= 75 && hue < 170) {
              colorID = 5;
              colorName = 'Verde';
              colorHex = '#22C55E';
            } else if (hue >= 170 && hue < 260) {
              colorID = 3;
              colorName = 'Blu';
              colorHex = '#3B82F6';
            }
          }

          const val = {
            type: 'color',
            color: colorID,
            colorName,
            colorHex,
            reflection,
            distance: 200,
            force: 0,
            sensorX,
            sensorY,
          };
          currentReadings[sensor.port.toUpperCase()] = val;
          currentReadingsListForState.push({ port: sensor.port, ...val });

          // Sync backwards compatibility fields
          if (idx === 0 || sensor.port.toUpperCase() === 'E') {
            rob.color = colorID;
            rob.reflection = reflection;
          }
        } else if (sensor.type === 'distance') {
          const PIXELS_PER_CM = 800 / 240;
          let detectedDistCm = 200; // max distance 200cm
          const maxDistancePx = 200 * PIXELS_PER_CM;
          // Cast a ray forward along heading
          for (let d = 2 * PIXELS_PER_CM; d < maxDistancePx; d += 2 * PIXELS_PER_CM) {
            const checkX = sensorX + d * Math.cos(headingRad);
            const checkY = sensorY + d * Math.sin(headingRad);

            // boundary check
            if (checkX < 0 || checkX > W || checkY < 0 || checkY > H) {
              detectedDistCm = Math.round(d / PIXELS_PER_CM);
              break;
            }

            // check obstacles collision
            let hit = false;
            obstaclesRef.current.forEach(obs => {
              if (obs.shape === 'circle') {
                const r = obs.w / 2;
                const cx = obs.x + r;
                const cy = obs.y + r;
                const dx = checkX - cx;
                const dy = checkY - cy;
                if (dx * dx + dy * dy <= r * r) {
                  hit = true;
                }
              } else {
                if (checkX >= obs.x && checkX <= obs.x + obs.w && checkY >= obs.y && checkY <= obs.y + obs.h) {
                  hit = true;
                }
              }
            });

            // check maze black wall collision
            if (mapType === 'maze' && !hit) {
              try {
                const pixel = offCtx.getImageData(Math.round(checkX), Math.round(checkY), 1, 1).data;
                if (pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0) {
                  hit = true;
                }
              } catch (e) {}
            }

            if (hit) {
              detectedDistCm = Math.round(d / PIXELS_PER_CM);
              break;
            }
          }

          const finalDistance = Math.max(0, detectedDistCm - 4);

          const val = {
            type: 'distance',
            color: -1,
            colorName: 'Nessuno',
            colorHex: '#CCCCCC',
            reflection: 100,
            distance: finalDistance,
            force: 0,
            sensorX,
            sensorY,
          };
          currentReadings[sensor.port.toUpperCase()] = val;
          currentReadingsListForState.push({ port: sensor.port, ...val });

          // Sync backwards compatibility fields
          if (idx === 0 || sensor.port.toUpperCase() === 'F') {
            rob.distance = finalDistance;
          }
        } else if (sensor.type === 'force') {
          // For force sensor, calculate a distance to simulate physical protrusion collision
          let detectedDist = 200;
          for (let d = 2; d < 15; d += 2) {
            const checkX = sensorX + d * Math.cos(headingRad);
            const checkY = sensorY + d * Math.sin(headingRad);

            if (checkX < 0 || checkX > W || checkY < 0 || checkY > H) {
              detectedDist = d;
              break;
            }

            let hit = false;
            obstaclesRef.current.forEach(obs => {
              if (obs.shape === 'circle') {
                const r = obs.w / 2;
                const cx = obs.x + r;
                const cy = obs.y + r;
                const dx = checkX - cx;
                const dy = checkY - cy;
                if (dx * dx + dy * dy <= r * r) {
                  hit = true;
                }
              } else {
                if (checkX >= obs.x && checkX <= obs.x + obs.w && checkY >= obs.y && checkY <= obs.y + obs.h) {
                  hit = true;
                }
              }
            });

            if (mapType === 'maze' && !hit) {
              try {
                const pixel = offCtx.getImageData(Math.round(checkX), Math.round(checkY), 1, 1).data;
                if (pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0) {
                  hit = true;
                }
              } catch (e) {}
            }

            if (hit) {
              detectedDist = d;
              break;
            }
          }

          const isPressed = rob.collision || (detectedDist < 6);
          const forceVal = isPressed ? 10 : 0;

          const val = {
            type: 'force',
            color: -1,
            colorName: 'Nessuno',
            colorHex: '#CCCCCC',
            reflection: 100,
            distance: 200,
            force: forceVal,
            sensorX,
            sensorY,
          };
          currentReadings[sensor.port.toUpperCase()] = val;
          currentReadingsListForState.push({ port: sensor.port, ...val });
        }
      });

      // Update ref so simulation thread can access immediately
      sensorReadingsRef.current = currentReadings;

      // 6. Draw Robot (Yellow LEGO Spike Prime Hub)
      ctx.save();
      ctx.translate(rob.x, rob.y);
      ctx.rotate(headingRad);

      // Sound Waves indicator
      if (rob.beepActive) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Wheel left & right (Blue bars)
      ctx.fillStyle = '#1D4ED8';
      // Left wheel (top of canvas orientation)
      ctx.fillRect(-15, -28, 30, 6);
      // Right wheel (bottom of canvas orientation)
      ctx.fillRect(-15, 22, 30, 6);

      // Castor ball / small wheels
      ctx.fillStyle = '#9CA3AF';
      ctx.beginPath();
      ctx.arc(-20, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      // Spike Prime Hub Chassis body (Yellow and rounded white borders)
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      
      // Rounded Rectangle
      ctx.beginPath();
      ctx.roundRect(-25, -22, 50, 44, 6);
      ctx.fill();
      ctx.stroke();

      // Top Hub Cover (Yellow Accent panel)
      ctx.fillStyle = '#F59E0B'; // LEGO yellow
      ctx.beginPath();
      ctx.roundRect(-21, -18, 42, 36, 4);
      ctx.fill();

      // Front orientation notch
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(25, -6);
      ctx.lineTo(29, 0);
      ctx.lineTo(25, 6);
      ctx.fill();

      // Draw 5x5 LED matrix inside the center cover
      ctx.fillStyle = '#374151';
      ctx.fillRect(-12, -12, 24, 24);

      // Render Matrix Text/Image on LEGO
      ctx.fillStyle = '#EF4444'; // Red LEDs
      if (rob.matrixText) {
        // Draw active LED representation (middle LED glowing or simply text indicator)
        ctx.font = '9px monospace';
        ctx.fillStyle = '#F87171';
        ctx.fillText(rob.matrixText.substring(0, 1).toUpperCase(), -4, 4);
      } else if (rob.matrixImage) {
        // Simple pixel representations of image icons
        if (rob.matrixImage.includes('HAPPY') || rob.matrixImage.includes('SMILE')) {
          ctx.beginPath();
          ctx.arc(-5, -4, 2, 0, Math.PI * 2);
          ctx.arc(5, -4, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, 2, 4, 0, Math.PI);
          ctx.stroke();
        } else if (rob.matrixImage.includes('HEART')) {
          ctx.fillRect(-6, -6, 5, 5);
          ctx.fillRect(1, -6, 5, 5);
          ctx.fillRect(-6, -1, 12, 5);
          ctx.fillRect(-3, 4, 6, 3);
        } else if (rob.matrixImage.includes('NO')) {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-6, -6); ctx.lineTo(6, 6);
          ctx.moveTo(6, -6); ctx.lineTo(-6, 6);
          ctx.stroke();
        } else if (rob.matrixImage.includes('YES')) {
          ctx.strokeStyle = '#22C55E';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-6, 0); ctx.lineTo(-2, 5); ctx.lineTo(6, -5);
          ctx.stroke();
        } else {
          // generic single pixel
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // 7. Draw Dynamically Configured Sensors (Lego arms on front)
      displaySensors.forEach((sensor, idx) => {
        const { localX, localY } = getSensorLocalCoords(sensor, idx);

        // Calculate world position for drawing
        const sensorX = rob.x + localX * Math.cos(headingRad) - localY * Math.sin(headingRad);
        const sensorY = rob.y + localX * Math.sin(headingRad) + localY * Math.cos(headingRad);
        const reading = currentReadings[sensor.port.toUpperCase()];

        ctx.save();
        ctx.translate(sensorX, sensorY);
        ctx.rotate(headingRad);

        if (sensor.type === 'color') {
          // Draw outer casing (celeste circle with dark gray outline)
          ctx.fillStyle = '#38BDF8';
          ctx.strokeStyle = '#374151';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Draw active color lens
          ctx.fillStyle = reading ? reading.colorHex : '#CCCCCC';
          ctx.beginPath();
          ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (sensor.type === 'distance') {
          // Draw casing (green)
          ctx.fillStyle = '#22C55E';
          ctx.strokeStyle = '#374151';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(-4, -8, 8, 16, 2);
          ctx.fill();
          ctx.stroke();

          // Draw two black "eyes"
          ctx.fillStyle = '#111111';
          ctx.beginPath();
          ctx.arc(0, -4, 2, 0, Math.PI * 2);
          ctx.arc(0, 4, 2, 0, Math.PI * 2);
          ctx.fill();

          // Draw distance ray cone
          const pxPerCm = 800 / 240;
          const lineLength = (reading ? reading.distance : 200) * pxPerCm;
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(lineLength, 0);
          ctx.stroke();
          ctx.setLineDash([1, 0]);
        } else if (sensor.type === 'force') {
          // Draw body (red box)
          ctx.fillStyle = '#EF4444';
          ctx.strokeStyle = '#374151';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(-3, -6, 6, 12, 1);
          ctx.fill();
          ctx.stroke();

          // Draw red button bumper sticking out in front
          const isPressed = reading && reading.force > 0;
          ctx.fillStyle = '#B91C1C'; // Darker red Lego button
          ctx.beginPath();
          if (isPressed) {
            ctx.roundRect(1, -4, 3, 8, 1); // pushed in
          } else {
            ctx.roundRect(3, -4, 3, 8, 1); // sticking out
          }
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
      });

      // Restore zoom & pan transformation
      ctx.restore();

      // 8. Sync state hook to display sensors in sidebar
      let legacyColorName = 'Nessuno';
      let legacyColorHex = '#CCCCCC';
      let legacyReflection = 100;
      let legacyDistance = 200;

      const firstColorReading = Object.values(currentReadings).find((r: any) => r.type === 'color') as any;
      if (firstColorReading) {
        legacyColorName = firstColorReading.colorName;
        legacyColorHex = firstColorReading.colorHex;
        legacyReflection = firstColorReading.reflection;
      }
      const firstDistanceReading = Object.values(currentReadings).find((r: any) => r.type === 'distance') as any;
      if (firstDistanceReading) {
        legacyDistance = firstDistanceReading.distance;
      }

      const K_speed = (((Math.PI * (wheelDiameter || 5.6)) / 6480) * (800 / 240)) / 10;
      
      let displayAngle = rob.angle - rob.yawResetAngle;
      displayAngle = ((((displayAngle + 180) % 360) + 360) % 360) - 180;

      setSensorsDisplay({
        x: Math.round(rob.x),
        y: Math.round(rob.y),
        angle: Math.round(displayAngle),
        leftSpeed: Math.round(K_speed > 0 ? rob.leftSpeed / K_speed : 0),
        rightSpeed: Math.round(K_speed > 0 ? rob.rightSpeed / K_speed : 0),
        distance: Math.round(legacyDistance),
        colorName: legacyColorName,
        colorHex: legacyColorHex,
        reflection: Math.round(legacyReflection),
        collision: rob.collision,
        matrixText: rob.matrixText,
        matrixImage: rob.matrixImage,
      });
      setActiveSensorsReadings(currentReadingsListForState);

      animId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, obstacles, mapType, trailEnabled, wheelDistance, customBgImage, sensors]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    stopSimulationCode();
    setIsPlaying(false);
    resetRobot(true);
  };

  const selectedObstacle = obstacles.find(o => o.id === selectedObstacleId);

  return (
    <div className={`flex-1 flex flex-col h-full min-h-0 bg-neutral-700 text-white overflow-hidden transition-all duration-300 ${
      isFullscreen 
        ? 'fixed inset-0 z-50 w-screen h-screen rounded-none bg-neutral-700' 
        : 'rounded-none'
    }`}>
      {/* Stage Header - Spans full width to keep buttons at the far right border */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-600 z-10 p-3 select-none shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
          </span>
          <span className="font-bold text-sm tracking-wide uppercase text-neutral-200">Simulatore Robot</span>
          <span className="bg-neutral-600 text-neutral-200 text-[10px] font-bold px-2 py-0.5 rounded border border-neutral-550 select-none">
            240 x 114 cm
          </span>
        </div>
        
        <div className="flex items-center gap-2.5">
          {/* Map Selector */}
          <div className="flex items-center gap-1.5 bg-neutral-600/80 border border-neutral-500 rounded-lg px-2 py-1 text-xs">
            <Map className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-neutral-300 hidden sm:inline">Mappa:</span>
            <select
              value={mapType}
              onChange={(e) => setMapType(e.target.value as MapType)}
              className="bg-transparent font-bold text-white outline-none cursor-pointer text-xs"
            >
              <option value="line" className="bg-neutral-700">Tracciato Linea</option>
              <option value="colors" className="bg-neutral-700">Scacchiere Colori</option>
              <option value="maze" className="bg-neutral-700">Labirinto Maze</option>
              <option value="empty" className="bg-neutral-700">Area Libera</option>
              <option value="custom" className="bg-neutral-700">Mappa Personalizzata</option>
            </select>
          </div>

          {/* Custom Background Upload Button */}
          {mapType === 'custom' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-sm border border-blue-500"
              title="Carica immagine di sfondo dal PC"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Carica Sfondo</span>
            </button>
          )}

          {/* Trail toggler */}
          <button
            onClick={() => setTrailEnabled(!trailEnabled)}
            className={`p-1.5 rounded-lg border transition-colors ${trailEnabled ? 'bg-yellow-400/20 border-yellow-500 text-yellow-400' : 'bg-neutral-600 border-neutral-550 text-neutral-300 hover:text-white'}`}
            title="Disegna tracciato robot"
          >
            {trailEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Telemetry Panel toggler */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-1.5 rounded-lg border transition-colors ${isSidebarOpen ? 'bg-neutral-600 border-neutral-550 text-neutral-200 hover:text-white' : 'bg-yellow-400/20 border-yellow-500 text-yellow-400'}`}
            title={isSidebarOpen ? "Nascondi pannello sensori (Ingrandisci area robot)" : "Mostra pannello sensori"}
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Fullscreen toggler */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`p-1.5 rounded-lg border transition-colors ${isFullscreen ? 'bg-blue-600 border-blue-500 text-white' : 'bg-neutral-600 border-neutral-500 text-neutral-300 hover:text-white'}`}
            title={isFullscreen ? "Esci da Schermo Intero (Esc)" : "Schermo Intero"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Simulation Stage (Left part of environment) */}
        <div className="flex-1 flex flex-col relative min-w-0 bg-neutral-700 p-3 pt-0 select-none">
          {/* Canvas Render viewport */}
        <div className="flex-1 bg-neutral-800 border-2 border-neutral-700 rounded-lg overflow-hidden relative flex items-center justify-center">

          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
            className="w-full h-full object-contain cursor-grab active:cursor-grabbing"
          />
          {/* Hidden Canvas for reading pixel colors under the robot sensor */}
          <canvas ref={offscreenCanvasRef} className="hidden" />

          {/* Hidden File Input for uploading custom background */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />



        </div>

        {/* Controls dock */}
        <div className="flex items-center justify-center gap-3 pt-2 border-t border-neutral-800/80 mt-1.5 z-10 w-full">
          <button
            onClick={async () => {
              runSimulationCode();
            }}
            disabled={isRunningCode}
            className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-bold border border-black text-xs shadow-sm transition-all active:scale-95 cursor-pointer ${
              isRunningCode
                ? 'bg-neutral-800 text-neutral-600 border-neutral-700 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white hover:scale-[1.02]'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Esegui codice
          </button>
          
          <button
            onClick={() => {
              stopSimulationCode();
              setIsPlaying(false);
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold border border-black text-xs shadow-sm transition-all active:scale-95 cursor-pointer hover:scale-[1.02]"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop
          </button>

          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold border border-black text-xs shadow-sm transition-all active:scale-95 cursor-pointer hover:scale-[1.02]"
          >
            <Home className="w-3.5 h-3.5" />
            Torna a casa
          </button>
        </div>
      </div>

      {/* Sensor Dashboard & Console Output (Right panel) */}
      {isSidebarOpen && (
        <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-neutral-700 bg-neutral-700 flex flex-col h-full overflow-hidden select-none">
          {/* Telemetry panel */}
          <div className="p-3 pt-[5vh] space-y-2.5 overflow-y-auto text-xs flex-1">
            {/* Wheel speeds */}
            <div className="grid grid-cols-2 gap-2 bg-neutral-800/60 p-2 rounded-lg border border-neutral-600">
              <div>
                <span className="text-neutral-400 block text-[10px]">Motore Sinistro</span>
                <span className="font-mono font-bold text-neutral-100">{sensorsDisplay.leftSpeed} rpm</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">Motore Destro</span>
                <span className="font-mono font-bold text-neutral-100">{sensorsDisplay.rightSpeed} rpm</span>
              </div>
            </div>

            {/* Active dynamically configured sensors */}
            {activeSensorsReadings.map((reading, i) => {
              if (reading.type === 'color') {
                return (
                  <div key={i} className="flex items-center justify-between bg-neutral-800/60 p-2 rounded-lg border border-neutral-600">
                    <div>
                      <span className="text-yellow-400 font-bold block text-[10px]">Sensore Colore [Porta {reading.port.toUpperCase()}]</span>
                      <span className="font-bold flex items-center gap-1.5 text-neutral-100">
                        <span className="w-2.5 h-2.5 rounded-full border border-neutral-600 inline-block" style={{ backgroundColor: reading.colorHex }}></span>
                        {reading.colorName}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-neutral-400 block text-[10px]">Riflessione</span>
                      <span className="font-mono font-bold text-neutral-100">{reading.reflection}%</span>
                    </div>
                  </div>
                );
              } else if (reading.type === 'distance') {
                return (
                  <div key={i} className="flex items-center justify-between bg-neutral-800/60 p-2 rounded-lg border border-neutral-600">
                    <div>
                      <span className="text-blue-400 font-bold block text-[10px]">Sensore Distanza [Porta {reading.port.toUpperCase()}]</span>
                      <span className="font-mono font-bold text-neutral-100">{reading.distance} cm</span>
                    </div>
                    <div className="text-right">
                      <span className="text-neutral-400 block text-[10px]">Impatto</span>
                      <span className={`font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded ${sensorsDisplay.collision ? 'bg-red-500/30 text-red-400 border border-red-500/40' : 'bg-neutral-700 text-neutral-300'}`}>
                        {sensorsDisplay.collision ? 'COLLISIONE' : 'OK'}
                      </span>
                    </div>
                  </div>
                );
              } else if (reading.type === 'force') {
                return (
                  <div key={i} className="flex items-center justify-between bg-neutral-800/60 p-2 rounded-lg border border-neutral-600">
                    <div>
                      <span className="text-red-400 font-bold block text-[10px]">Sensore Forza [Porta {reading.port.toUpperCase()}]</span>
                      <span className="font-bold text-neutral-100">{reading.force > 0 ? 'Premuto' : 'Rilasciato'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-neutral-400 block text-[10px]">Forza</span>
                      <span className="font-mono font-bold text-neutral-100">{reading.force} N</span>
                    </div>
                  </div>
                );
              }
              return null;
            })}

            {activeSensorsReadings.length === 0 && (
              <div className="text-neutral-400 italic text-[11px] p-2 text-center bg-neutral-800/30 rounded-lg border border-neutral-600">
                Nessun sensore configurato. Configurali nella scheda "Setup Robot Spike"!
              </div>
            )}

            {/* Gyro Sensor values */}
            <div className="flex items-center justify-between bg-neutral-800/60 p-2 rounded-lg border border-neutral-600">
              <div>
                <span className="text-neutral-400 block text-[10px]">Angolo Yaw / Gyro</span>
                <span className="font-mono font-bold text-neutral-100">{sensorsDisplay.angle}°</span>
              </div>
              <div className="text-right">
                <span className="text-neutral-400 block text-[10px]">Posizione (X, Y)</span>
                <span className="font-mono text-neutral-300">{(sensorsDisplay.x * 0.3).toFixed(1)} cm, {(sensorsDisplay.y * 0.3).toFixed(1)} cm</span>
              </div>
            </div>

            {/* LED Display output */}
            <div className="flex items-center gap-2.5 bg-neutral-800/60 p-2 rounded-lg border border-neutral-600">
              <div className="w-8 h-8 rounded bg-neutral-800 flex items-center justify-center border border-neutral-600">
                {sensorsDisplay.matrixText ? (
                  <span className="font-mono font-extrabold text-base text-red-500">{sensorsDisplay.matrixText.substring(0, 1).toUpperCase()}</span>
                ) : sensorsDisplay.matrixImage ? (
                  <span className="w-3 h-3 rounded bg-red-500 animate-pulse inline-block" title={sensorsDisplay.matrixImage}></span>
                ) : (
                  <span className="text-[10px] text-neutral-400">SPENTO</span>
                )}
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">Schermo Brick LED</span>
                <span className="text-[11px] font-bold text-neutral-200">
                  {sensorsDisplay.matrixText ? `Scrittura: "${sensorsDisplay.matrixText}"` : sensorsDisplay.matrixImage ? `Icona: ${sensorsDisplay.matrixImage}` : 'Nessuna attività'}
                </span>
              </div>
            </div>
          </div>          {/* Proprietà Oggetto Selezionato */}
          {selectedObstacle && (
            <div className="border-t border-neutral-300 bg-neutral-100 p-3.5 flex flex-col gap-2.5 shrink-0 select-none animate-in fade-in slide-in-from-bottom-2 duration-150 shadow-[0_-4px_15px_rgba(0,0,0,0.2)] relative z-10">
              <div className="font-bold border-b border-neutral-300 pb-1.5 flex justify-between items-center text-[10px] uppercase tracking-wider text-amber-700">
                <span>Caratteristiche {selectedObstacle.pushable ? 'Oggetto Spostabile' : 'Muro'}</span>
                <button onClick={() => setSelectedObstacleId(null)} className="text-neutral-500 hover:text-neutral-700 cursor-pointer p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Shape Selection */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] text-neutral-600 font-semibold">Forma:</span>
                <div className="flex gap-1 bg-neutral-200 p-0.5 rounded border border-neutral-300">
                  <button
                    onClick={() => updateSelectedObstacle({ shape: 'square' })}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${(!selectedObstacle.shape || selectedObstacle.shape === 'square') ? 'bg-amber-500 text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-800'}`}
                  >
                    Quadrata
                  </button>
                  <button
                    onClick={() => updateSelectedObstacle({ shape: 'circle' })}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${(selectedObstacle.shape === 'circle') ? 'bg-amber-500 text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-800'}`}
                  >
                    Tonda
                  </button>
                </div>
              </div>

              {/* Preset Colors & custom picker */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-neutral-600 font-semibold">Colore:</span>
                {selectedObstacle.pushable ? (
                  <div className="flex items-center gap-1">
                    {['#D97706', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'].map(col => (
                      <button
                        key={col}
                        onClick={() => updateSelectedObstacle({ color: col })}
                        className="w-3.5 h-3.5 rounded-full border border-neutral-300 shadow-sm hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                        style={{ backgroundColor: col }}
                      />
                    ))}
                    <input
                      type="color"
                      value={selectedObstacle.color || '#D97706'}
                      onChange={(e) => updateSelectedObstacle({ color: e.target.value })}
                      className="w-4 h-4 rounded p-0 border-0 bg-transparent cursor-pointer ml-1"
                      title="Scegli colore personalizzato (vibrante)"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-full border border-neutral-300 shadow-sm bg-[#4B5563]" />
                    <span className="text-[10px] text-neutral-600">Grigio (fisso per muri)</span>
                  </div>
                )}
              </div>

              {/* Dimensions Sliders */}
              <div className="space-y-1.5 border-t border-neutral-300 pt-2">
                <div className="flex justify-between text-[10px] text-neutral-600 font-medium">
                  <span>{selectedObstacle.shape === 'circle' ? 'Diametro:' : 'Larghezza:'}</span>
                  <span className="font-mono text-amber-700 font-bold">{selectedObstacle.w} px</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="120"
                  value={selectedObstacle.w}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (selectedObstacle.shape === 'circle') {
                      updateSelectedObstacle({ w: val, h: val });
                    } else {
                      updateSelectedObstacle({ w: val });
                    }
                  }}
                  className="w-full accent-amber-600 h-1 bg-neutral-300 rounded-lg appearance-none cursor-pointer"
                />
                {selectedObstacle.shape !== 'circle' && (
                  <>
                    <div className="flex justify-between text-[10px] text-neutral-600 font-medium pt-1">
                      <span>Altezza:</span>
                      <span className="font-mono text-amber-700 font-bold">{selectedObstacle.h} px</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="120"
                      value={selectedObstacle.h}
                      onChange={(e) => updateSelectedObstacle({ h: parseInt(e.target.value) })}
                      className="w-full accent-amber-600 h-1 bg-neutral-300 rounded-lg appearance-none cursor-pointer"
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Sezione Gestione Oggetti Campo */}
          <div className="border-t border-neutral-600 bg-neutral-800/40 p-3 flex flex-col gap-2.5 shrink-0 select-none">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-neutral-350 uppercase">
              <Layers className="w-3.5 h-3.5 text-yellow-500" />
              <span>Oggetti & Campo</span>
            </div>
            
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={addSolidObstacle}
                  className="py-1.5 px-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg transition-colors flex flex-row items-center justify-center gap-1.5 cursor-pointer border border-neutral-550 font-semibold text-[10px]"
                  title="Aggiungi un mattone solido (non spingibile)"
                >
                  <div className="w-3 h-2 bg-neutral-500 rounded border border-neutral-400 shrink-0"></div>
                  <span>+ Muro</span>
                </button>
                
                <button
                  onClick={addPushableObstacle}
                  className="py-1.5 px-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg transition-colors flex flex-row items-center justify-center gap-1.5 cursor-pointer border border-neutral-550 font-semibold text-[10px]"
                  title="Aggiungi un oggetto spostabile che il robot può spingere"
                >
                  <div className="w-2.5 h-2.5 bg-amber-600 rounded-full border border-amber-500 shrink-0"></div>
                  <span>+ Spostabile</span>
                </button>
              </div>

              {/* Pulsanti Esporta ed Importa Campo direttamente sotto */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={exportLayoutToFile}
                  className="py-1.5 px-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg transition-colors flex flex-row items-center justify-center gap-1.5 cursor-pointer border border-neutral-550 font-semibold text-[10px]"
                  title="Esporta il campo come file JSON per condividerlo o conservarlo"
                >
                  <Download className="w-3 h-3 text-yellow-400 shrink-0" />
                  <span>Esporta</span>
                </button>
                
                <button
                  onClick={() => fileImportInputRef.current?.click()}
                  className="py-1.5 px-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg transition-colors flex flex-row items-center justify-center gap-1.5 cursor-pointer border border-neutral-550 font-semibold text-[10px]"
                  title="Importa una configurazione campo da un file JSON precedentemente salvato"
                >
                  <Upload className="w-3 h-3 text-purple-400 shrink-0" />
                  <span>Importa</span>
                </button>
              </div>

              <div className="flex gap-2">
                {selectedObstacleId !== null && (
                  <button
                    onClick={deleteSelectedObstacle}
                    className="flex-1 py-1.5 bg-red-950/80 hover:bg-red-900 text-red-300 hover:text-red-200 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer border border-red-900 font-bold text-[11px]"
                    title="Elimina l'oggetto selezionato"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Elimina</span>
                  </button>
                )}

                {obstacles.length > 0 && (
                  <button
                    onClick={clearAllObstacles}
                    className="flex-1 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-350 hover:text-neutral-200 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer border border-neutral-600 font-medium text-[11px]"
                    title="Rimuovi tutti gli oggetti dal campo"
                  >
                    Svuota campo
                  </button>
                )}
              </div>
            </div>

            {/* Hidden file input for importing layout */}
            <input
              type="file"
              ref={fileImportInputRef}
              onChange={handleFileImport}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
