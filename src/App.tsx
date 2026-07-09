import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Usb, Terminal, ExternalLink, AlertCircle, Square, Blocks, Code, Settings, X, Upload, Save, FolderOpen } from 'lucide-react';
import { motion } from 'motion/react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism.css';
import BlocklyEditor, { BlocklyEditorRef } from './components/BlocklyEditor';
import VirtualEnvironment from './components/VirtualEnvironment';
// @ts-ignore
import logoStaarr from './LogoStaarr.png';

interface MotorConfig {
  id: number;
  port: string;
  isTraction: boolean;
  isInverted: boolean;
}

interface SensorConfig {
  id: number;
  port: string;
  type: string;
  direction?: 'forward' | 'down';
}

const highlightWithBlockly = (code: string) => {
  const html = Prism.highlight(code, Prism.languages.python, 'python');
  
  const startToken = '<span class="token comment"># === START_BLOCKLY_CODE ===</span>';
  const endToken = '<span class="token comment"># === END_BLOCKLY_CODE ===</span>';
  
  let startIndex = html.indexOf(startToken);
  let startLen = startToken.length;
  
  if (startIndex === -1) {
      startIndex = html.indexOf('# === START_BLOCKLY_CODE ===');
      startLen = '# === START_BLOCKLY_CODE ==='.length;
  }
  
  let endIndex = html.indexOf(endToken);
  if (endIndex === -1) {
      endIndex = html.indexOf('# === END_BLOCKLY_CODE ===');
  }
  
  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    const before = html.substring(0, startIndex + startLen);
    const middle = html.substring(startIndex + startLen, endIndex);
    const after = html.substring(endIndex);
    return before + '<span style="background-color: rgba(253, 224, 71, 0.3); display: block; margin: 0 -16px; padding: 0 16px;">' + middle + '</span>' + after;
  }
  
  return html;
};

export default function App() {
  const [port, setPort] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<string>('');
  const [customCode, setCustomCode] = useState<string>('');
  const [blocklyCode, setBlocklyCode] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'blocks' | 'python'>('blocks');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSerialSupported, setIsSerialSupported] = useState(true);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [currentSlot, setCurrentSlot] = useState<number>(0);
  const TOTAL_SLOTS = 6;
  const [isVirtualActive, setIsVirtualActive] = useState(false);
  
  const [motors, setMotors] = useState<MotorConfig[]>(() => {
    const saved = localStorage.getItem('spike_motors');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Errore nel parsing dei motori salvati:", e);
      }
    }
    return [
      { id: 1, port: 'C', isTraction: true, isInverted: true },
      { id: 2, port: 'D', isTraction: true, isInverted: false },
      { id: 3, port: 'E', isTraction: false, isInverted: false },
      { id: 4, port: '', isTraction: false, isInverted: false },
    ];
  });

  const [sensors, setSensors] = useState<SensorConfig[]>(() => {
    const saved = localStorage.getItem('spike_sensors');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Errore nel parsing dei sensori salvati:", e);
      }
    }
    return [
      { id: 1, port: 'A', type: 'force', direction: 'down' },
      { id: 2, port: 'B', type: 'color', direction: 'forward' },
      { id: 3, port: 'F', type: 'distance', direction: 'down' },
      { id: 4, port: '', type: '', direction: 'down' },
    ];
  });

  const [wheelDiameter, setWheelDiameter] = useState<number>(() => {
    const saved = localStorage.getItem('spike_wheel_diameter');
    return saved ? parseFloat(saved) : 5.6;
  });

  const [wheelDistance, setWheelDistance] = useState<number>(() => {
    const saved = localStorage.getItem('spike_wheel_distance');
    return saved ? parseFloat(saved) : 11.5;
  });

  const [maxMotorSpeed, setMaxMotorSpeed] = useState<number>(() => {
    const saved = localStorage.getItem('spike_max_motor_speed');
    return saved ? parseInt(saved) : 100;
  });

  const handleMaxMotorSpeedChange = (val: number) => {
    setMaxMotorSpeed(val);
    localStorage.setItem('spike_max_motor_speed', val.toString());
    localStorage.setItem(`spike_slot_${currentSlot}_max_motor_speed`, val.toString());
  };

  const handleWheelDiameterChange = (val: number) => {
    setWheelDiameter(val);
    localStorage.setItem('spike_wheel_diameter', val.toString());
    localStorage.setItem(`spike_slot_${currentSlot}_wheel_diameter`, val.toString());
  };

  const handleWheelDistanceChange = (val: number) => {
    setWheelDistance(val);
    localStorage.setItem('spike_wheel_distance', val.toString());
    localStorage.setItem(`spike_slot_${currentSlot}_wheel_distance`, val.toString());
  };

  const handleMotorChange = (id: number, field: keyof MotorConfig, value: any) => {
    setMotors(prev => {
      const updated = prev.map(m => m.id === id ? { ...m, [field]: value } : m);
      localStorage.setItem('spike_motors', JSON.stringify(updated));
      localStorage.setItem(`spike_slot_${currentSlot}_motors`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSensorChange = (id: number, field: keyof SensorConfig, value: any) => {
    setSensors(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, [field]: value } : s);
      localStorage.setItem('spike_sensors', JSON.stringify(updated));
      localStorage.setItem(`spike_slot_${currentSlot}_sensors`, JSON.stringify(updated));
      return updated;
    });
  };

  const resetToDefaultSetup = () => {
    const defaultMotors = [
      { id: 1, port: 'C', isTraction: true, isInverted: true },
      { id: 2, port: 'D', isTraction: true, isInverted: false },
      { id: 3, port: 'E', isTraction: false, isInverted: false },
      { id: 4, port: '', isTraction: false, isInverted: false },
    ];
    const defaultSensors = [
      { id: 1, port: 'A', type: 'force', direction: 'down' },
      { id: 2, port: 'B', type: 'color', direction: 'forward' },
      { id: 3, port: 'F', type: 'distance', direction: 'down' },
      { id: 4, port: '', type: '', direction: 'down' },
    ];
    setMotors(defaultMotors);
    setSensors(defaultSensors);
    setWheelDiameter(5.6);
    setWheelDistance(11.5);
    setMaxMotorSpeed(100);

    localStorage.setItem('spike_motors', JSON.stringify(defaultMotors));
    localStorage.setItem('spike_sensors', JSON.stringify(defaultSensors));
    localStorage.setItem('spike_wheel_diameter', '5.6');
    localStorage.setItem('spike_wheel_distance', '11.5');
    localStorage.setItem('spike_max_motor_speed', '100');

    // Also update current slot specifically
    localStorage.setItem(`spike_slot_${currentSlot}_motors`, JSON.stringify(defaultMotors));
    localStorage.setItem(`spike_slot_${currentSlot}_sensors`, JSON.stringify(defaultSensors));
    localStorage.setItem(`spike_slot_${currentSlot}_wheel_diameter`, '5.6');
    localStorage.setItem(`spike_slot_${currentSlot}_wheel_distance`, '11.5');
    localStorage.setItem(`spike_slot_${currentSlot}_max_motor_speed`, '100');
  };

  const handleBlocklyCodeChange = useCallback((code: string) => {
    setBlocklyCode(code);
    setCustomCode(code);
  }, []);

  const blocklyEditorRef = useRef<BlocklyEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileBlockInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Clear all slot workspace and python code from localStorage on app launch/restart
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      localStorage.removeItem(`spike_slot_${i}_workspace`);
      localStorage.removeItem(`spike_slot_${i}_python`);
      localStorage.removeItem(`spike_slot_${i}_motors`);
      localStorage.removeItem(`spike_slot_${i}_sensors`);
      localStorage.removeItem(`spike_slot_${i}_wheel_diameter`);
      localStorage.removeItem(`spike_slot_${i}_wheel_distance`);
      localStorage.removeItem(`spike_slot_${i}_max_motor_speed`);
    }
    localStorage.setItem('spike_current_slot', '0');
    setCurrentSlot(0);
    
    // We delay slightly to ensure blockly is mounted before loading
    setTimeout(() => {
      loadSlotData(0);
    }, 600);
  }, []);

  const loadSlotData = (slot: number) => {
    const savedWorkspace = localStorage.getItem(`spike_slot_${slot}_workspace`);
    if (savedWorkspace && blocklyEditorRef.current) {
        blocklyEditorRef.current.loadWorkspace(JSON.parse(savedWorkspace));
    } else if (blocklyEditorRef.current) {
        blocklyEditorRef.current.loadWorkspace(null); // Clear workspace
    }
    const savedPython = localStorage.getItem(`spike_slot_${slot}_python`);
    if (savedPython) {
        setCustomCode(savedPython);
        setBlocklyCode(savedPython);
    } else {
        setCustomCode('');
        setBlocklyCode('');
    }

    // Load slot-specific robot configuration
    const savedMotors = localStorage.getItem(`spike_slot_${slot}_motors`);
    if (savedMotors) {
      try {
        setMotors(JSON.parse(savedMotors));
      } catch (e) {
        console.error("Errore nel parsing dei motori del slot:", e);
      }
    } else {
      const globalMotors = localStorage.getItem('spike_motors');
      if (globalMotors) {
        try {
          setMotors(JSON.parse(globalMotors));
        } catch (e) {}
      } else {
        setMotors([
          { id: 1, port: 'C', isTraction: true, isInverted: true },
          { id: 2, port: 'D', isTraction: true, isInverted: false },
          { id: 3, port: 'E', isTraction: false, isInverted: false },
          { id: 4, port: '', isTraction: false, isInverted: false },
        ]);
      }
    }

    const savedSensors = localStorage.getItem(`spike_slot_${slot}_sensors`);
    if (savedSensors) {
      try {
        setSensors(JSON.parse(savedSensors));
      } catch (e) {
        console.error("Errore nel parsing dei sensori del slot:", e);
      }
    } else {
      const globalSensors = localStorage.getItem('spike_sensors');
      if (globalSensors) {
        try {
          setSensors(JSON.parse(globalSensors));
        } catch (e) {}
      } else {
        setSensors([
          { id: 1, port: 'A', type: 'force', direction: 'down' },
          { id: 2, port: 'B', type: 'color', direction: 'forward' },
          { id: 3, port: 'F', type: 'distance', direction: 'down' },
          { id: 4, port: '', type: '', direction: 'down' },
        ]);
      }
    }

    const savedWheelDiameter = localStorage.getItem(`spike_slot_${slot}_wheel_diameter`);
    if (savedWheelDiameter) {
      setWheelDiameter(parseFloat(savedWheelDiameter));
    } else {
      const globalWheelDiameter = localStorage.getItem('spike_wheel_diameter');
      setWheelDiameter(globalWheelDiameter ? parseFloat(globalWheelDiameter) : 5.6);
    }

    const savedWheelDistance = localStorage.getItem(`spike_slot_${slot}_wheel_distance`);
    if (savedWheelDistance) {
      setWheelDistance(parseFloat(savedWheelDistance));
    } else {
      const globalWheelDistance = localStorage.getItem('spike_wheel_distance');
      setWheelDistance(globalWheelDistance ? parseFloat(globalWheelDistance) : 11.5);
    }

    const savedMaxMotorSpeed = localStorage.getItem(`spike_slot_${slot}_max_motor_speed`);
    if (savedMaxMotorSpeed) {
      setMaxMotorSpeed(parseInt(savedMaxMotorSpeed));
    } else {
      const globalMaxMotorSpeed = localStorage.getItem('spike_max_motor_speed');
      setMaxMotorSpeed(globalMaxMotorSpeed ? parseInt(globalMaxMotorSpeed) : 100);
    }
  };

  const handleSlotChange = (newSlot: number) => {
    if (newSlot === currentSlot) return;
    // Save current workspace and code
    if (blocklyEditorRef.current) {
      const workspace = blocklyEditorRef.current.saveWorkspace();
      if (workspace) {
         localStorage.setItem(`spike_slot_${currentSlot}_workspace`, JSON.stringify(workspace));
      } else {
         localStorage.removeItem(`spike_slot_${currentSlot}_workspace`);
      }
    }
    localStorage.setItem(`spike_slot_${currentSlot}_python`, activeTab === 'blocks' ? blocklyCode : customCode);
    
    // Save current robot configuration
    localStorage.setItem(`spike_slot_${currentSlot}_motors`, JSON.stringify(motors));
    localStorage.setItem(`spike_slot_${currentSlot}_sensors`, JSON.stringify(sensors));
    localStorage.setItem(`spike_slot_${currentSlot}_wheel_diameter`, wheelDiameter.toString());
    localStorage.setItem(`spike_slot_${currentSlot}_wheel_distance`, wheelDistance.toString());
    localStorage.setItem(`spike_slot_${currentSlot}_max_motor_speed`, maxMotorSpeed.toString());

    // Switch
    setCurrentSlot(newSlot);
    localStorage.setItem('spike_current_slot', newSlot.toString());
    loadSlotData(newSlot);
  };

  const uploadMultiProgramMenu = async () => {
    if (!port || !port.writable || isExecuting) return;
    
    if (blocklyEditorRef.current) {
      const workspace = blocklyEditorRef.current.saveWorkspace();
      if (workspace) localStorage.setItem(`spike_slot_${currentSlot}_workspace`, JSON.stringify(workspace));
    }
    localStorage.setItem(`spike_slot_${currentSlot}_python`, activeTab === 'blocks' ? blocklyCode : customCode);
    
    // Save current robot configuration for the active slot
    localStorage.setItem(`spike_slot_${currentSlot}_motors`, JSON.stringify(motors));
    localStorage.setItem(`spike_slot_${currentSlot}_sensors`, JSON.stringify(sensors));
    localStorage.setItem(`spike_slot_${currentSlot}_wheel_diameter`, wheelDiameter.toString());
    localStorage.setItem(`spike_slot_${currentSlot}_wheel_distance`, wheelDistance.toString());
    localStorage.setItem(`spike_slot_${currentSlot}_max_motor_speed`, maxMotorSpeed.toString());

    const stringToHex = (str: string): string => {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(str);
      return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    };

    const slotsData: { [key: number]: string } = {};
    const activeSlots: number[] = [];
    
    for (let i = 0; i < TOTAL_SLOTS; i++) {
        let code = i === currentSlot ? (activeTab === 'blocks' ? blocklyCode : customCode) : localStorage.getItem(`spike_slot_${i}_python`) || '';
        
        if (code && code.trim().length > 50) {
            code = code.replace('_WAIT_FIRST_TIME = True', '_WAIT_FIRST_TIME = False');
            code = code.replace('_WAIT_FIRST_TIME = False', '_WAIT_FIRST_TIME = False');
            code = code.replace("is_wait_mode = globals().get('_WAIT_FIRST_TIME', False)", "is_wait_mode = False");
            
            slotsData[i] = code;
            activeSlots.push(i);
        }
    }
    
    if (activeSlots.length === 0) {
        alert("Nessun programma trovato da caricare nel menu.");
        return;
    }

    if (port.writable.locked) {
        setLogs(prev => prev + "Porta seriale bloccata. Prova a ricollegare.\n");
        return;
    }

    setIsExecuting(true);
    let writer = null;

    try {
      writer = port.writable.getWriter();
      const encoder = new TextEncoder();

      // Helper to send a piece of code via Paste Mode (Ctrl+E) and execute it (Ctrl+D)
      const sendPasteCode = async (codeToSend: string) => {
        // Stop current running program (Ctrl+C)
        await writer.write(encoder.encode('\x03'));
        await new Promise(r => setTimeout(r, 150));
        
        // Enter Paste Mode (Ctrl+E)
        await writer.write(encoder.encode('\x05'));
        await new Promise(r => setTimeout(r, 150));
        
        // Send the code in chunks
        const encoded = encoder.encode(codeToSend + '\r\n');
        const CHUNK_SIZE = 128;
        const CHUNK_DELAY = 10;
        for (let offset = 0; offset < encoded.length; offset += CHUNK_SIZE) {
          const chunk = encoded.slice(offset, offset + CHUNK_SIZE);
          await writer.write(chunk);
          await new Promise(r => setTimeout(r, CHUNK_DELAY));
        }
        
        // Execute Paste (Ctrl+D)
        await writer.write(encoder.encode('\x04'));
        await new Promise(r => setTimeout(r, 150));
      };

      setLogs(prev => prev + "\n=== INIZIO CARICAMENTO MULTI-PROGRAMMA ===\n");

      // 1. Write each active slot program to its own file in flash memory
      for (const slot of activeSlots) {
        setLogs(prev => prev + `Caricamento Programma ${slot}... `);
        const rawCode = slotsData[slot];
        const hexCode = stringToHex(rawCode);

        // We use hex format to make it safe from newlines/quotes, and write bytes directly
        const writeScript = `import ubinascii
with open('slot_${slot}.py', 'wb') as f:
    f.write(ubinascii.unhexlify('${hexCode}'))
`;
        await sendPasteCode(writeScript);
        // Allow flash write operation to settle
        await new Promise(r => setTimeout(r, 350));
        setLogs(prev => prev + "Completato! ✅\n");
      }

      // 2. Build and upload the selection menu program
      setLogs(prev => prev + "Generazione menu di selezione sul robot... ");
      
      const activeSlotsArrayStr = `[${activeSlots.join(', ')}]`;
      const menuCode = `import hub, utime, sys, gc
from hub import light_matrix, button
try:
    from hub import status_light
except ImportError:
    status_light = None

available_slots = ${activeSlotsArrayStr}
current_index = 0

def show_slot():
    slot = available_slots[current_index]
    light_matrix.write(str(slot))

def check_btn(btn_name):
    try:
        if hasattr(button, 'pressed') and hasattr(button, btn_name): 
            return button.pressed(getattr(button, btn_name))
        
        btn_lower = btn_name.lower()
        if hasattr(button, btn_lower): 
            b = getattr(button, btn_lower)
            if hasattr(b, 'was_pressed'): return b.was_pressed()
            if hasattr(b, 'is_pressed'): return b.is_pressed()
            if hasattr(b, 'pressed'):
                if callable(b.pressed): return b.pressed()
                else: return b.pressed
    except: pass
    return False

try:
    show_slot()
    print("Menu avviato. Usa Sinistra/Destra per navigare, Centrale (o Sinistra+Destra) per selezionare.")
    if status_light:
        try: status_light.on('white')
        except: pass

    while True:
        utime.sleep_ms(50)
        btn_center = check_btn('CENTER') or check_btn('POWER') or (check_btn('LEFT') and check_btn('RIGHT'))
        
        if btn_center:
            light_matrix.clear()
            slot = available_slots[current_index]
            print("Avvio slot", slot)
            
            for _ in range(3):
                light_matrix.write(str(slot))
                utime.sleep_ms(150)
                light_matrix.clear()
                utime.sleep_ms(150)
                
            try:
                gc.collect()
                filename = 'slot_{}.py'.format(slot)
                with open(filename, 'r', encoding='utf-8') as f:
                    source_code = f.read()
                
                prog_globals = {
                    '__name__': '__main__',
                    'hub': hub,
                    'utime': utime,
                    'sys': sys,
                }
                if hasattr(globals, '__builtins__'):
                    prog_globals['__builtins__'] = globals()['__builtins__']
                
                exec(source_code, prog_globals)
                gc.collect()
            except KeyboardInterrupt:
                raise
            except Exception as e:
                print("Errore slot", slot, ":", e)
                try:
                    light_matrix.write("X")
                    utime.sleep_ms(2000)
                except: pass
                
            print("Terminato, ritorno al menu.")
            if status_light:
                try: status_light.on('white')
                except: pass
            utime.sleep_ms(500)
            show_slot()
        elif check_btn('LEFT'):
            current_index = (current_index - 1) % len(available_slots)
            show_slot()
            utime.sleep_ms(300)
        elif check_btn('RIGHT'):
            current_index = (current_index + 1) % len(available_slots)
            show_slot()
            utime.sleep_ms(300)
except KeyboardInterrupt:
    print("Menu interrotto.")
except Exception as root_e:
    print("Errore critico menu:", root_e)
    try:
        light_matrix.write("E")
        utime.sleep_ms(2000)
    except: pass
`;

      await sendPasteCode(menuCode);
      await new Promise(r => setTimeout(r, 200));
      setLogs('');
      setLogs(prev => prev + "[Menu caricato con successo! Usa i tasti Sinistra/Destra del robot per scegliere il programma, premi Centrale per avviarlo!]\n");
    } catch (err: any) {
      console.error(err);
      setLogs(prev => prev + `Errore nel caricamento: ${err.message}\n`);
    } finally {
      if (writer) {
        try {
          writer.releaseLock();
        } catch (e) {}
      }
      setIsExecuting(false);
    }
  };

  const handleSaveProgram = () => {
    let workspaceData = null;
    if (blocklyEditorRef.current) {
      workspaceData = blocklyEditorRef.current.saveWorkspace();
    }
    
    const fileData = {
      type: 'spike-program',
      version: 1,
      motors,
      sensors,
      wheelDiameter,
      wheelDistance,
      maxMotorSpeed,
      workspace: workspaceData,
      pythonCode: customCode
    };
    
    const blob = new Blob([JSON.stringify(fileData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'programma_spike.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadProgramClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        if (data.type !== 'spike-program') {
          alert("Il file selezionato non è un programma Spike valido.");
          return;
        }
        
        const isBlockly = data.workspace && data.workspace.blocks && data.workspace.blocks.blocks && data.workspace.blocks.blocks.length > 0;
        
        if (isBlockly) {
          setActiveTab('blocks');
          setTimeout(() => {
            if (data.workspace && blocklyEditorRef.current) {
              blocklyEditorRef.current.loadWorkspace(data.workspace);
            }
          }, 100);
        } else {
          setActiveTab('python');
          if (blocklyEditorRef.current) {
            blocklyEditorRef.current.loadWorkspace(null);
          }
        }
        
        if (data.motors) {
          setMotors(data.motors);
          localStorage.setItem('spike_motors', JSON.stringify(data.motors));
          localStorage.setItem(`spike_slot_${currentSlot}_motors`, JSON.stringify(data.motors));
        }
        if (data.sensors) {
          setSensors(data.sensors);
          localStorage.setItem('spike_sensors', JSON.stringify(data.sensors));
          localStorage.setItem(`spike_slot_${currentSlot}_sensors`, JSON.stringify(data.sensors));
        }
        if (data.wheelDiameter !== undefined) {
          setWheelDiameter(data.wheelDiameter);
          localStorage.setItem('spike_wheel_diameter', data.wheelDiameter.toString());
          localStorage.setItem(`spike_slot_${currentSlot}_wheel_diameter`, data.wheelDiameter.toString());
        }
        if (data.wheelDistance !== undefined) {
          setWheelDistance(data.wheelDistance);
          localStorage.setItem('spike_wheel_distance', data.wheelDistance.toString());
          localStorage.setItem(`spike_slot_${currentSlot}_wheel_distance`, data.wheelDistance.toString());
        }
        if (data.maxMotorSpeed !== undefined) {
          setMaxMotorSpeed(data.maxMotorSpeed);
          localStorage.setItem('spike_max_motor_speed', data.maxMotorSpeed.toString());
          localStorage.setItem(`spike_slot_${currentSlot}_max_motor_speed`, data.maxMotorSpeed.toString());
        }
        
        if (data.pythonCode !== undefined) {
          setCustomCode(data.pythonCode);
          setBlocklyCode(data.pythonCode);
          localStorage.setItem(`spike_slot_${currentSlot}_python`, data.pythonCode);
        }
        if (data.workspace) {
          localStorage.setItem(`spike_slot_${currentSlot}_workspace`, JSON.stringify(data.workspace));
        } else {
          localStorage.removeItem(`spike_slot_${currentSlot}_workspace`);
        }
        
        alert("Programma caricato con successo!");
      } catch (err) {
        console.error("Errore nel caricamento del file:", err);
        alert("Errore nel caricamento del file. Assicurati che sia un file JSON valido.");
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleSaveBlock = () => {
    if (!blocklyEditorRef.current) return;
    const blockData = blocklyEditorRef.current.saveSelectedBlock();
    if (!blockData) {
      alert("Nessun blocco selezionato. Clicca su un blocco per selezionarlo e riprova.");
      return;
    }
    
    const fileData = {
      type: 'spike-block',
      version: 1,
      blockData
    };
    
    const blob = new Blob([JSON.stringify(fileData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'blocco_spike.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadBlockClick = () => {
    if (fileBlockInputRef.current) {
      fileBlockInputRef.current.click();
    }
  };

  const handleBlockFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        if (data.type !== 'spike-block') {
          alert("Il file selezionato non è un blocco Spike valido.");
          return;
        }
        
        setActiveTab('blocks');
        
        setTimeout(() => {
          if (data.blockData && blocklyEditorRef.current) {
            blocklyEditorRef.current.appendBlock(data.blockData);
          }
        }, 100);
        
      } catch (err) {
        console.error("Errore nel caricamento del file:", err);
        alert("Errore nel caricamento del file. Assicurati che sia un file JSON valido.");
      }
      
      if (fileBlockInputRef.current) {
        fileBlockInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const terminalRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<any>(null);
  const keepReadingRef = useRef<boolean>(false);
  const readLoopPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!('serial' in navigator)) {
      setIsSerialSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!port) return;
    
    keepReadingRef.current = true;

    async function readLoop() {
      while (port && port.readable && keepReadingRef.current) {
        try {
          const reader = port.readable.getReader();
          readerRef.current = reader;
          try {
            while (keepReadingRef.current) {
              const { value, done } = await reader.read();
              if (done) {
                break;
              }
              if (value) {
                const text = new TextDecoder().decode(value);
                setLogs(prev => {
                  const newLogs = prev + text;
                  // Keep only last 5000 characters to prevent memory issues
                  return newLogs.length > 5000 ? newLogs.slice(-5000) : newLogs;
                });
              }
            }
          } catch (error: any) {
            if (keepReadingRef.current) {
              console.error("Errore di lettura:", error);
              if (error.message && error.message.includes("The device has been lost")) {
                setLogs(prev => prev + "\n[Disconnesso: Il dispositivo è stato rimosso]\n");
                keepReadingRef.current = false;
                setIsConnected(false);
                setPort(null);
                break;
              }
            }
          } finally {
            readerRef.current = null;
            try {
              reader.releaseLock();
            } catch (e) {
              // Ignore release errors
            }
          }
        } catch (err) {
          if (keepReadingRef.current) {
            console.error("Errore nell'ottenere il reader:", err);
          }
          break;
        }
      }
    }

    readLoopPromiseRef.current = readLoop();

    return () => {
      keepReadingRef.current = false;
      if (readerRef.current) {
        readerRef.current.cancel().catch(() => {});
      }
    };
  }, [port]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const connect = async () => {
    try {
      const p = await (navigator as any).serial.requestPort();
      await p.open({ baudRate: 115200 });
      setPort(p);
      setIsConnected(true);
      setLogs(prev => prev + "Connesso a LEGO Spike Prime.\n");

      // Svuota lo schermo del robot alla connessione
      try {
        const writer = p.writable.getWriter();
        const encoder = new TextEncoder();
        // Invia Ctrl+C per sicurezza e poi il comando clear
        await writer.write(encoder.encode('\x03\r\nfrom hub import light_matrix\r\nlight_matrix.clear()\r\n'));
        writer.releaseLock();
      } catch (e) {
        console.error("Errore nel reset iniziale dello schermo:", e);
      }
    } catch (err: any) {
      console.error(err);
      setLogs(prev => prev + `Errore di connessione: ${err.message}\n`);
    }
  };

  const disconnect = async () => {
    if (port) {
      try {
        // 1. Interrompi il ciclo impostando keepReadingRef su false
        keepReadingRef.current = false;

        // 2. Cancella il reader attivo per sbloccare la porta
        if (readerRef.current) {
          try {
            await readerRef.current.cancel();
          } catch (e) {
            console.error("Errore nella cancellazione del reader:", e);
          }
        }

        // 3. Attendi che il ciclo di lettura termini in sicurezza e rilasci i lock
        if (readLoopPromiseRef.current) {
          try {
            await readLoopPromiseRef.current;
          } catch (e) {
            console.error("Errore nell'attesa della chiusura del ciclo di lettura:", e);
          }
        }

        // 4. Chiudi la porta seriale
        await port.close();
        setPort(null);
        setIsConnected(false);
        setLogs(prev => prev + "Disconnesso.\n");
      } catch (err: any) {
        console.error(err);
        setLogs(prev => prev + `Errore durante la disconnessione: ${err.message}\n`);
      }
    }
  };

  const executeCode = async (code: string, waitForButton: boolean = false) => {
    if (!port || !port.writable) {
      setLogs(prev => prev + "Errore: Porta seriale non disponibile.\n");
      return;
    }

    if (isExecuting) {
      setLogs(prev => prev + "Invio in corso, attendi...\n");
      return;
    }

    if (port.writable.locked) {
      setLogs(prev => prev + "Porta seriale bloccata. Prova a ricollegare.\n");
      return;
    }

    setIsExecuting(true);
    let writer = null;

    let finalCode = code;
    if (waitForButton) {
      setLogs(prev => prev + "\n[Attesa avvio: Premi il tasto CENTRALE (o Sinistro/Destro) sul robot per avviare il codice. In seguito, premi il tasto Centrale per interrompere!]\n");
      finalCode = finalCode.replace('_WAIT_FIRST_TIME = False', '_WAIT_FIRST_TIME = True');
    }

    try {
      writer = port.writable.getWriter();
      const encoder = new TextEncoder();
      
      // Stop current running program (Ctrl+C)
      await writer.write(encoder.encode('\x03'));
      await new Promise(r => setTimeout(r, 100));
      
      // Enter Paste Mode (Ctrl+E)
      await writer.write(encoder.encode('\x05'));
      await new Promise(r => setTimeout(r, 100));
      
      // Write the code in chunks to prevent UART buffer overflow on the Spike Prime
      const encodedCode = encoder.encode(finalCode + '\r\n');
      const CHUNK_SIZE = 128;
      const CHUNK_DELAY = 10; // ms
      for (let offset = 0; offset < encodedCode.length; offset += CHUNK_SIZE) {
        const chunk = encodedCode.slice(offset, offset + CHUNK_SIZE);
        await writer.write(chunk);
        await new Promise(r => setTimeout(r, CHUNK_DELAY));
      }
      
      // Execute (Ctrl+D)
      await writer.write(encoder.encode('\x04'));
      
      await new Promise(r => setTimeout(r, 200));
      setLogs('');
      if (waitForButton) {
        setLogs(prev => prev + "[Attesa avvio: Premi il tasto CENTRALE (o Sinistro/Destro) sul robot per avviare il codice. In seguito, premi il tasto Centrale per interrompere!]\n");
      }
    } catch (err: any) {
      console.error(err);
      setLogs(prev => prev + `Errore di esecuzione: ${err.message}\n`);
    } finally {
      if (writer) {
        try {
          writer.releaseLock();
        } catch (e) {}
      }
      setIsExecuting(false);
    }
  };

  const stopExecution = async () => {
    if (!port || !port.writable) return;
    
    // Non blocchiamo se isExecuting è true, perché stopExecution è il tasto di emergenza.
    // Tuttavia, se port.writable.locked è true, getWriter fallirà.
    if (port.writable.locked) {
        setLogs(prev => prev + "Impossibile interrompere: porta seriale bloccata.\n");
        return;
    }

    let writer = null;
    try {
      writer = port.writable.getWriter();
      const encoder = new TextEncoder();
      
      // Send multiple Ctrl+C to ensure we break out of loops
      await writer.write(encoder.encode('\x03\x03\r\n'));
      
      // Wait for REPL to become responsive
      await new Promise(r => setTimeout(r, 300));
      
      // Attempt to stop all motors
      const stopCode = `
try:
    import motor_pair
    motor_pair.stop(motor_pair.PAIR_1)
except: pass
try:
    import motor, port
    for p in [port.A, port.B, port.C, port.D, port.E, port.F]:
        try: motor.stop(p)
        except: pass
except: pass
`;
      // Enter Paste Mode
      await writer.write(encoder.encode('\x05'));
      await new Promise(r => setTimeout(r, 100));
      
      // Write the code
      await writer.write(encoder.encode(stopCode + '\r\n'));
      await new Promise(r => setTimeout(r, 100));
      
      // Execute
      await writer.write(encoder.encode('\x04'));

      setLogs(prev => prev + "Esecuzione interrotta. Motori fermati.\n");
    } catch (err: any) {
      console.error(err);
    } finally {
        if (writer) {
            try {
                writer.releaseLock();
            } catch (e) {}
        }
        setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-yellow-300 selection:text-neutral-900">
      {/* Header */}
      <header className="bg-neutral-200 border-b border-neutral-300 sticky top-0 z-10">
        <div className="w-full px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md flex items-center justify-center shadow-sm overflow-hidden bg-white border-2 border-black">
              <img src={logoStaarr} alt="Logo Staarr" className="w-full h-full object-contain" />
            </div>
            <h1 className="font-semibold tracking-tight text-3xl">Robo</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsVirtualActive(!isVirtualActive)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all border-2 active:scale-95 ${isVirtualActive ? 'bg-red-600 hover:bg-red-700 text-white border-black shadow-inner' : 'bg-green-500 hover:bg-green-600 text-white border-black shadow-sm'}`}
              title="Simulatore"
            >
              <span className="relative flex h-2 w-2">
                {isVirtualActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isVirtualActive ? 'bg-white' : 'bg-white'}`}></span>
              </span>
              Simulatore
            </button>
            {!isVirtualActive && (
              <button
                onClick={() => setShowTerminal(!showTerminal)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border-2 ${showTerminal ? 'bg-neutral-300 text-neutral-900 border-black shadow-inner' : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-900 border-black shadow-sm'}`}
                title="Monitor Seriale"
              >
                <Terminal className="w-4 h-4" />
                Monitor seriale
              </button>
            )}
            <button 
              onClick={() => setIsSetupOpen(true)} 
              className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 transition-colors"
              title="Setup Robot"
            >
              <Settings className="w-5 h-5" />
            </button>
            {!isVirtualActive && (
              <>
                <button 
                  onClick={() => setIsSaveModalOpen(true)}
                  className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition-colors"
                  title="Salva"
                >
                  <Save className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsLoadModalOpen(true)}
                  className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition-colors"
                  title="Carica"
                >
                  <FolderOpen className="w-5 h-5" />
                </button>
              </>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".json" 
            />
            <input 
              type="file" 
              ref={fileBlockInputRef} 
              onChange={handleBlockFileChange} 
              className="hidden" 
              accept=".json" 
            />
            {!isVirtualActive && (
              <>
                <div className="w-px h-6 bg-neutral-200 mx-1"></div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500' : 'bg-neutral-300'}`}></span>
                  </span>
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {isConnected ? 'Online' : 'Offline'}
                  </span>
                </div>
                {!isConnected ? (
                  <button
                    onClick={connect}
                    disabled={!isSerialSupported}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors border-2 bg-neutral-200 hover:bg-neutral-300 text-black border-black shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Usb className="w-4 h-4" />
                    Connetti
                  </button>
                ) : (
                  <button
                    onClick={disconnect}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors border-2 bg-neutral-200 hover:bg-neutral-300 text-black border-black shadow-sm"
                  >
                    Disconnetti
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="w-full h-[calc(100vh-4rem)] flex flex-col p-0">
        {!isSerialSupported && (
          <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-xl p-4 flex gap-3 text-sm max-w-6xl mx-auto w-full my-2 mx-auto">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-medium mb-1">Web Serial non supportata</p>
              <p>Il tuo browser non supporta la connessione seriale, oppure l'app è in un iframe restrittivo. Prova ad aprirla in una nuova scheda usando Chrome o Edge.</p>
              <a href={window.location.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 font-medium text-orange-900 hover:underline">
                Apri in nuova scheda <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        <div className={`flex-1 w-full h-full min-h-0 bg-neutral-700 ${isVirtualActive ? 'flex' : 'hidden'}`}>
          <VirtualEnvironment
            code={activeTab === 'blocks' ? blocklyCode : customCode}
            onClose={() => setIsVirtualActive(false)}
            motors={motors}
            sensors={sensors}
            wheelDiameter={wheelDiameter}
            wheelDistance={wheelDistance}
            maxMotorSpeed={maxMotorSpeed}
            isVirtualActive={isVirtualActive}
          />
        </div>

        <div className={`${isVirtualActive ? 'hidden' : 'grid'} grid-cols-1 ${showTerminal ? 'lg:grid-cols-12' : 'lg:grid-cols-1'} flex-1 min-h-0`}>
          
          {/* Left Column: Terminal */}
          {showTerminal && (
            <div className="lg:col-span-4 flex flex-col h-full min-h-0">
              <section className="bg-neutral-900 flex flex-col h-full overflow-hidden border-r border-neutral-800">
                <div className="bg-neutral-950 px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm font-medium text-neutral-300">Terminale Seriale</span>
                  </div>
                  <button 
                    onClick={() => setLogs('')}
                    className="text-xs text-neutral-500 hover:text-neutral-300 font-medium transition-colors"
                  >
                    Pulisci
                  </button>
                </div>
                <div 
                  ref={terminalRef}
                  className="flex-1 p-4 overflow-y-auto font-mono text-xs sm:text-sm text-neutral-300 whitespace-pre-wrap break-all"
                >
                  {logs || (
                    <span className="text-neutral-600 italic">
                      {isConnected ? "Nessun output registrato" : "In attesa di connessione..."}
                    </span>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* Right Column: Editor (Blockly / Python) */}
          <div className={`${showTerminal ? 'lg:col-span-8' : 'lg:col-span-1'} flex flex-col h-full min-h-0`}>
            <section className="bg-white flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('blocks')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border-2 ${activeTab === 'blocks' ? 'bg-neutral-200 shadow-sm border-black text-neutral-900' : 'bg-neutral-200 border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300'}`}
              >
                <Blocks className="w-4 h-4" />
                Blocchi
              </button>
              <button
                onClick={() => setActiveTab('python')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border-2 ${activeTab === 'python' ? 'bg-neutral-200 shadow-sm border-black text-neutral-900' : 'bg-neutral-200 border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300'}`}
              >
                <Code className="w-4 h-4" />
                Python
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-blue-50/70 border border-blue-300 rounded-lg p-1 mr-1 shadow-sm">
                <div className="flex items-center gap-1 px-1.5">
                  <span className="text-xs font-bold text-blue-800 uppercase tracking-wider whitespace-nowrap">Slot:</span>
                  <select 
                    value={currentSlot} 
                    onChange={(e) => handleSlotChange(parseInt(e.target.value))}
                    className="text-sm font-bold bg-white border border-blue-200 text-blue-950 rounded px-2 py-0.5 outline-none focus:border-blue-600 cursor-pointer shadow-sm"
                  >
                    {[...Array(TOTAL_SLOTS)].map((_, i) => (
                      <option key={i} value={i}>Programma {i}</option>
                    ))}
                  </select>
                </div>
                <div className="w-px h-5 bg-blue-200 self-center"></div>
                <button
                  onClick={uploadMultiProgramMenu}
                  disabled={!isConnected || isExecuting}
                  className="flex items-center gap-1.5 bg-blue-800 hover:bg-blue-900 text-white disabled:bg-blue-100 disabled:text-blue-400 border border-blue-900/20 px-2.5 py-1 rounded-md text-sm font-semibold transition-colors disabled:cursor-not-allowed shadow-sm whitespace-nowrap"
                  title="Carica TUTTI i programmi come un menu selezionabile dal robot."
                >
                  <Blocks className="w-3.5 h-3.5" />
                  Carica tutti i codici
                </button>
              </div>
              <div className="w-px h-6 bg-neutral-300 mx-1"></div>
              <button
                onClick={() => executeCode(activeTab === 'blocks' ? blocklyCode : customCode, true)}
                disabled={!isConnected || isExecuting}
                className="flex items-center gap-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-900 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                title="Carica il codice e attendi. Premi il tasto CENTRALE (o Sinistra/Destra) per avviare, e premi in seguito il tasto Centrale per interrompere."
              >
                <Upload className="w-4 h-4" />
                Carica Codice
              </button>
              <button
                onClick={() => executeCode(activeTab === 'blocks' ? blocklyCode : customCode, false)}
                disabled={!isConnected || isExecuting}
                className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-900 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Play className="w-4 h-4 fill-current" />
                Esegui codice
              </button>
              <button
                onClick={stopExecution}
                disabled={!isConnected}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                title="Interrompi l'esecuzione"
              >
                <Square className="w-4 h-4 fill-current" />
                Stop
              </button>
            </div>
          </div>
          
          <div className="flex-1 relative bg-neutral-50 overflow-hidden">
            <div className={`absolute inset-0 w-full h-full ${activeTab === 'blocks' ? 'block' : 'pointer-events-none opacity-0 invisible h-0 overflow-hidden'}`}>
              <BlocklyEditor 
                ref={blocklyEditorRef}
                motors={motors}
                wheelDiameter={wheelDiameter}
                wheelDistance={wheelDistance}
                maxMotorSpeed={maxMotorSpeed}
                isVisible={activeTab === 'blocks'}
                isVirtualActive={isVirtualActive}
                onToggleVirtual={() => setIsVirtualActive(!isVirtualActive)}
                onCodeChange={handleBlocklyCodeChange} 
              />
            </div>
            <div className={`absolute inset-0 w-full h-full ${activeTab === 'python' ? 'block' : 'pointer-events-none opacity-0 invisible h-0 overflow-hidden'} bg-white overflow-y-auto`}>
              <Editor
                value={customCode}
                onValueChange={(code) => setCustomCode(code)}
                highlight={(code) => highlightWithBlockly(code)}
                padding={16}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 14,
                  minHeight: '100%',
                }}
                textareaClassName="focus:outline-none"
                className="w-full font-mono text-sm"
              />
            </div>
          </div>
        </section>
      </div>
      </div>
      </main>

      {/* Setup Modal */}
      {isSetupOpen && (
        <div className="fixed inset-0 bg-neutral-950/70 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-neutral-100 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col border-4 border-black relative z-[10000]">
            {/* Colorful Lego-style header */}
            <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 text-black px-6 py-4 flex items-center justify-between border-b-4 border-black">
              <div className="flex items-center gap-3">
                <Settings className="w-6 h-6 animate-pulse" />
                <h2 className="font-extrabold text-2xl tracking-tight uppercase">Setup Robot Spike</h2>
              </div>
              <button 
                onClick={() => setIsSetupOpen(false)} 
                className="p-1.5 bg-white/40 hover:bg-white/80 active:scale-95 rounded-full text-black transition-all border-2 border-black"
                title="Chiudi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto bg-neutral-50 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* Motori */}
                <div className="flex flex-col">
                  <h3 className="font-extrabold text-base text-amber-800 mb-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 border-2 border-amber-300 w-fit shadow-sm">
                    ⚙️ Motori
                  </h3>
                  <div className="space-y-2 flex-1">
                    {motors.map(motor => (
                      <div 
                        key={`motor-${motor.id}`} 
                        className={`p-2.5 bg-white rounded-xl border-2 transition-all duration-200 shadow-sm hover:shadow-md ${motor.port ? 'border-amber-400 bg-amber-50/10' : 'border-neutral-200'}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-extrabold ${motor.port ? 'text-amber-700' : 'text-neutral-500'}`}>
                            Motore {motor.id}
                          </span>
                          <select 
                            value={motor.port}
                            onChange={(e) => handleMotorChange(motor.id, 'port', e.target.value)}
                            className="text-xs font-bold border-2 border-amber-300 rounded-md p-1 bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                          >
                            <option value="">Porta...</option>
                            <option value="A">Porta A</option>
                            <option value="B">Porta B</option>
                            <option value="C">Porta C</option>
                            <option value="D">Porta D</option>
                            <option value="E">Porta E</option>
                            <option value="F">Porta F</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-neutral-100">
                          <label className={`flex items-center gap-1 text-[11px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer transition-colors border ${motor.isTraction ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:bg-neutral-100'}`}>
                            <input 
                              type="checkbox" 
                              checked={motor.isTraction}
                              onChange={(e) => handleMotorChange(motor.id, 'isTraction', e.target.checked)}
                              className="rounded border-amber-300 text-amber-500 focus:ring-amber-500 w-3 h-3" 
                            />
                            Trazione
                          </label>
                          <label className={`flex items-center gap-1 text-[11px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer transition-colors border ${motor.isInverted ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:bg-neutral-100'}`}>
                            <input 
                              type="checkbox" 
                              checked={motor.isInverted}
                              onChange={(e) => handleMotorChange(motor.id, 'isInverted', e.target.checked)}
                              className="rounded border-amber-300 text-amber-500 focus:ring-amber-500 w-3 h-3" 
                            />
                            Inverti
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sensori */}
                <div className="flex flex-col">
                  <h3 className="font-extrabold text-xs text-emerald-800 mb-1.5 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-100 border-2 border-emerald-300 w-fit shadow-sm">
                    👁️ Sensori
                  </h3>
                  <div className="space-y-1.5 flex-1">
                    {sensors.map(sensor => (
                      <div 
                        key={`sensor-${sensor.id}`} 
                        className={`p-1.5 bg-white rounded-lg border-2 transition-all duration-200 shadow-sm hover:shadow-md ${sensor.port ? 'border-emerald-400 bg-emerald-50/10' : 'border-neutral-200'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[11px] font-extrabold ${sensor.port ? 'text-emerald-700' : 'text-neutral-500'}`}>
                            Sensore {sensor.id}
                          </span>
                          <select 
                            value={sensor.port}
                            onChange={(e) => handleSensorChange(sensor.id, 'port', e.target.value)}
                            className="text-[10px] font-bold border-2 border-emerald-300 rounded-md p-0.5 bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                          >
                            <option value="">Porta...</option>
                            <option value="A">Porta A</option>
                            <option value="B">Porta B</option>
                            <option value="C">Porta C</option>
                            <option value="D">Porta D</option>
                            <option value="E">Porta E</option>
                            <option value="F">Porta F</option>
                          </select>
                        </div>
                        <select 
                          value={sensor.type}
                          onChange={(e) => handleSensorChange(sensor.id, 'type', e.target.value)}
                          className={`w-full text-[10px] font-bold border-2 rounded-md p-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer ${sensor.type ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-neutral-200'}`}
                        >
                          <option value="">Tipo sensore...</option>
                          <option value="color">Colore 🔴🔵</option>
                          <option value="distance">Distanza (Ultrasuoni) 📏</option>
                          <option value="force">Tocco/Forza 🏋️</option>
                        </select>
                        {sensor.type === 'color' && (
                          <div className="mt-1 flex items-center justify-between bg-emerald-50/50 p-1 rounded-md border border-emerald-200/50">
                            <span className="text-[9px] font-extrabold text-emerald-800 uppercase tracking-wider">
                              Sguardo:
                            </span>
                            <select
                              value={sensor.direction || 'down'}
                              onChange={(e) => handleSensorChange(sensor.id, 'direction', e.target.value)}
                              className="text-[9px] font-extrabold border-2 border-emerald-300 rounded-md px-1 py-0 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer text-emerald-800"
                            >
                              <option value="down">In basso ⬇️</option>
                              <option value="forward">In avanti ➡️</option>
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dimensioni Robot */}
                <div className="flex flex-col">
                  <h3 className="font-extrabold text-base text-blue-800 mb-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100 border-2 border-blue-300 w-fit shadow-sm">
                    📐 Dimensioni
                  </h3>
                  <div className="p-3 bg-white rounded-xl border-2 border-blue-300 shadow-sm space-y-3 flex-1">
                    <div className="space-y-1">
                      <label className="block text-xs font-extrabold text-blue-800">
                        Diametro ruota (cm)
                      </label>
                      <div className="relative rounded-md shadow-sm flex border-2 border-blue-300 overflow-hidden">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={wheelDiameter}
                          onChange={(e) => handleWheelDiameterChange(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-bold p-1.5 bg-blue-50/30 focus:outline-none"
                          placeholder="es. 5.6"
                        />
                        <div className="bg-blue-100 border-l-2 border-blue-300 px-2 flex items-center justify-center">
                          <span className="text-blue-800 text-[10px] font-bold font-mono">cm</span>
                        </div>
                      </div>
                      <p className="text-[10px] font-medium leading-tight text-neutral-500">Usato per la distanza percorsa.</p>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-dashed border-neutral-200">
                      <label className="block text-xs font-extrabold text-blue-800">
                        Distanza ruote (cm)
                      </label>
                      <div className="relative rounded-md shadow-sm flex border-2 border-blue-300 overflow-hidden">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={wheelDistance}
                          onChange={(e) => handleWheelDistanceChange(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-bold p-1.5 bg-blue-50/30 focus:outline-none"
                          placeholder="es. 11.5"
                        />
                        <div className="bg-blue-100 border-l-2 border-blue-300 px-2 flex items-center justify-center">
                          <span className="text-blue-800 text-[10px] font-bold font-mono">cm</span>
                        </div>
                      </div>
                      <p className="text-[10px] font-medium leading-tight text-neutral-500">Distanza interasse per le curve.</p>
                    </div>
                  </div>
                </div>

                {/* Velocità massima motori */}
                <div className="flex flex-col">
                  <h3 className="font-extrabold text-base text-rose-800 mb-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 border-2 border-rose-300 w-fit shadow-sm">
                    ⚡ Velocità
                  </h3>
                  <div className="p-3 bg-white rounded-xl border-2 border-rose-300 shadow-sm space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <label className="block text-xs font-extrabold text-rose-800">
                        Valore massimo (0-1000)
                      </label>
                      <div className="relative rounded-md shadow-sm border-2 border-rose-300 overflow-hidden">
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          value={maxMotorSpeed}
                          onChange={(e) => handleMaxMotorSpeedChange(parseInt(e.target.value) || 0)}
                          className="w-full text-center text-sm font-extrabold p-1.5 bg-rose-50/30 focus:outline-none text-rose-700"
                          placeholder="es. 100"
                        />
                      </div>
                      <div>
                        <input 
                          type="range"
                          min="0"
                          max="1000"
                          value={maxMotorSpeed}
                          onChange={(e) => handleMaxMotorSpeedChange(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-rose-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                        />
                      </div>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 p-2 rounded-lg text-[10px] text-rose-900 font-medium space-y-0.5">
                      <p>ℹ️ Velocità di riferimento.</p>
                      <p>Standard LEGO: 100</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t-4 border-black bg-neutral-100 flex justify-between items-center gap-3">
              <button 
                onClick={resetToDefaultSetup}
                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 active:scale-95 text-neutral-800 font-bold rounded-xl border-2 border-neutral-400 hover:border-black transition-all text-xs uppercase tracking-wider"
                title="Ripristina la configurazione predefinita di fabbrica"
              >
                Ripristina Default
              </button>
              <button 
                onClick={() => setIsSetupOpen(false)} 
                className="px-6 py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 active:scale-95 text-black font-extrabold rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-sm uppercase tracking-wider"
              >
                Salva e Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Salva */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsSaveModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-neutral-800">Cosa vuoi salvare?</h2>
              <button 
                onClick={() => setIsSaveModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <button 
                onClick={() => {
                  handleSaveProgram();
                  setIsSaveModalOpen(false);
                }}
                className="w-full flex items-center gap-3 p-4 border border-neutral-200 rounded-xl hover:bg-yellow-50 hover:border-yellow-400 transition-colors text-left"
              >
                <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-neutral-800">Salva Intero Programma</div>
                  <div className="text-xs text-neutral-500">Salva tutti i blocchi, il codice Python e la configurazione del robot.</div>
                </div>
              </button>
              <button 
                onClick={() => {
                  handleSaveBlock();
                  setIsSaveModalOpen(false);
                }}
                className="w-full flex items-center gap-3 p-4 border border-neutral-200 rounded-xl hover:bg-yellow-50 hover:border-yellow-400 transition-colors text-left"
              >
                <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
                  <Blocks className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-neutral-800">Salva Blocco Selezionato</div>
                  <div className="text-xs text-neutral-500">Salva solo il blocco o gruppo di blocchi attualmente selezionato.</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Carica */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsLoadModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-neutral-800">Cosa vuoi caricare?</h2>
              <button 
                onClick={() => setIsLoadModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <button 
                onClick={() => {
                  handleLoadProgramClick();
                  setIsLoadModalOpen(false);
                }}
                className="w-full flex items-center gap-3 p-4 border border-neutral-200 rounded-xl hover:bg-yellow-50 hover:border-yellow-400 transition-colors text-left"
              >
                <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-neutral-800">Carica Programma</div>
                  <div className="text-xs text-neutral-500">Sostituisce il progetto attuale con uno salvato precedentemente.</div>
                </div>
              </button>
              <button 
                onClick={() => {
                  handleLoadBlockClick();
                  setIsLoadModalOpen(false);
                }}
                className="w-full flex items-center gap-3 p-4 border border-neutral-200 rounded-xl hover:bg-yellow-50 hover:border-yellow-400 transition-colors text-left"
              >
                <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
                  <Blocks className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-neutral-800">Carica Blocco</div>
                  <div className="text-xs text-neutral-500">Aggiunge un blocco salvato al progetto attuale.</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
