import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as Blockly from 'blockly';
import * as It from 'blockly/msg/it';
import { pythonGenerator } from 'blockly/python';

pythonGenerator.INDENT = '    ';

import { Plus, Minus, Trash2 } from 'lucide-react';

Blockly.setLocale(It as any);

// Register spike_repeat_forever as a recognized loop type in Blockly
try {
  if ((Blockly as any).Constants && (Blockly as any).Constants.Loops && (Blockly as any).Constants.Loops.LOOP_TYPES) {
    if (!(Blockly as any).Constants.Loops.LOOP_TYPES.includes('spike_repeat_forever')) {
      (Blockly as any).Constants.Loops.LOOP_TYPES.push('spike_repeat_forever');
    }
  }
} catch (e) {
  console.error("Error setting up loop types", e);
}

// Define custom blocks
Blockly.defineBlocksWithJsonArray([
  {
    "type": "spike_start",
    "message0": "Quando il programma inizia",
    "nextStatement": null,
    "colour": "#00008B",
    "tooltip": "Inizio del programma",
    "helpUrl": ""
  },
  {
    "type": "spike_light_matrix_write",
    "message0": "Scrivi sullo schermo %1",
    "args0": [
      {
        "type": "input_value",
        "name": "TEXT",
        "check": "String"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#FF6B6B",
    "inputsInline": true,
    "tooltip": "Scrivi un testo sullo schermo del Brick",
    "helpUrl": ""
  },
  {
    "type": "spike_light_matrix_write_number",
    "message0": "Scrivi numero sullo schermo %1",
    "args0": [
      {
        "type": "input_value",
        "name": "NUMBER",
        "check": "Number"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#FF6B6B",
    "inputsInline": true,
    "tooltip": "Scrivi un numero sullo schermo del Brick",
    "helpUrl": ""
  },
  {
    "type": "spike_sound_beep",
    "message0": "Suona un Beep",
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#555555",
    "inputsInline": true,
    "tooltip": "Emette un suono",
    "helpUrl": ""
  },
  {
    "type": "spike_sound_play_note",
    "message0": "Suona nota %1 per %2 secondi",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "NOTE",
        "options": [
          ["Do 4 (C4)", "261"],
          ["Do# 4 (C#4)", "277"],
          ["Re 4 (D4)", "293"],
          ["Re# 4 (D#4)", "311"],
          ["Mi 4 (E4)", "329"],
          ["Fa 4 (F4)", "349"],
          ["Fa# 4 (F#4)", "370"],
          ["Sol 4 (G4)", "392"],
          ["Sol# 4 (G#4)", "415"],
          ["La 4 (A4)", "440"],
          ["La# 4 (A#4)", "466"],
          ["Si 4 (B4)", "493"],
          ["Do 5 (C5)", "523"]
        ]
      },
      {
        "type": "input_value",
        "name": "DURATION",
        "check": "Number"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#555555",
    "inputsInline": true,
    "tooltip": "Suona una nota musicale per un tempo specificato",
    "helpUrl": ""
  },
  {
    "type": "spike_print",
    "message0": "Stampa nel terminale seriale %1",
    "args0": [
      {
        "type": "input_value",
        "name": "TEXT"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#FF6B6B",
    "inputsInline": true,
    "tooltip": "Stampa un valore nel terminale seriale",
    "helpUrl": ""
  },
  {
    "type": "spike_motor_run",
    "message0": "Avvia motore sulla porta %1 a velocità %2",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"], ["E", "E"], ["F", "F"]
        ]
      },
      {
        "type": "input_value",
        "name": "SPEED",
        "check": "Number"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#C71585",
    "inputsInline": true,
    "tooltip": "Avvia il motore a velocità costante indefinitamente",
    "helpUrl": ""
  },
  {
    "type": "spike_motor_stop",
    "message0": "Ferma motore sulla porta %1",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"], ["E", "E"], ["F", "F"]
        ]
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#C71585",
    "inputsInline": true,
    "tooltip": "Ferma il motore",
    "helpUrl": ""
  },
  {
    "type": "spike_color_sensor",
    "message0": "Colore letto sulla porta %1",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"], ["E", "E"], ["F", "F"]
        ]
      }
    ],
    "output": null,
    "colour": "#228B22",
    "inputsInline": true,
    "tooltip": "Legge il colore dal sensore",
    "helpUrl": ""
  },
  {
    "type": "spike_distance_sensor",
    "message0": "Distanza letta sulla porta %1",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"], ["E", "E"], ["F", "F"]
        ]
      }
    ],
    "output": "Number",
    "colour": "#228B22",
    "inputsInline": true,
    "tooltip": "Legge la distanza in cm",
    "helpUrl": ""
  },
  {
    "type": "spike_force_sensor",
    "message0": "Tocco/Forza sulla porta %1",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"], ["E", "E"], ["F", "F"]
        ]
      }
    ],
    "output": "Number",
    "colour": "#228B22",
    "inputsInline": true,
    "tooltip": "Legge la pressione del sensore di tocco/forza",
    "helpUrl": ""
  },
  {
    "type": "spike_wait",
    "message0": "Attendi %1 secondi",
    "args0": [
      {
        "type": "input_value",
        "name": "SECONDS",
        "check": "Number"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 210,
    "inputsInline": true,
    "tooltip": "Attendi per un certo numero di secondi",
    "helpUrl": ""
  },
  {
    "type": "spike_motor_run_for",
    "message0": "Muovi motore sulla porta %1 per %2 %3 a velocità %4",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"], ["E", "E"], ["F", "F"]
        ]
      },
      {
        "type": "input_value",
        "name": "VALUE",
        "check": "Number"
      },
      {
        "type": "field_dropdown",
        "name": "UNIT",
        "options": [
          ["gradi", "DEGREES"],
          ["rotazioni", "ROTATIONS"],
          ["centimetri (cm)", "CM"],
          ["secondi", "SECONDS"]
        ]
      },
      {
        "type": "input_value",
        "name": "SPEED",
        "check": "Number"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#C71585",
    "inputsInline": true,
    "tooltip": "Fai ruotare il motore per gradi, rotazioni, centimetri o secondi",
    "helpUrl": ""
  },
  {
    "type": "spike_robot_move",
    "message0": "Avvia movimento robot con sterzata %1 a velocità %2",
    "args0": [
      {
        "type": "input_value",
        "name": "STEERING",
        "check": "Number"
      },
      {
        "type": "input_value",
        "name": "SPEED",
        "check": "Number"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#FF0000",
    "inputsInline": true,
    "tooltip": "Avvia il movimento del robot con la sterzata (da -100 a +100) e velocità indicate",
    "helpUrl": ""
  },
  {
    "type": "spike_robot_move_for",
    "message0": "Muovi robot con sterzata %1 per %2 %3 a velocità %4",
    "args0": [
      {
        "type": "input_value",
        "name": "STEERING",
        "check": "Number"
      },
      {
        "type": "input_value",
        "name": "VALUE",
        "check": "Number"
      },
      {
        "type": "field_dropdown",
        "name": "UNIT",
        "options": [
          ["secondi", "SECONDS"],
          ["gradi motore", "DEGREES"],
          ["rotazioni motore", "ROTATIONS"],
          ["centimetri (cm)", "CM"],
          ["gradi robot", "ROBOT_DEGREES"]
        ]
      },
      {
        "type": "input_value",
        "name": "SPEED",
        "check": "Number"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#FF0000",
    "inputsInline": true,
    "tooltip": "Muove il robot nella direzione specificata per la durata o distanza indicate",
    "helpUrl": ""
  },
  {
    "type": "spike_robot_stop",
    "message0": "Ferma movimento robot",
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#FF0000",
    "inputsInline": true,
    "tooltip": "Ferma il movimento dei motori di trazione",
    "helpUrl": ""
  },
  {
    "type": "spike_robot_spin_degrees",
    "message0": "Fai ruotare il robot verso %1 di %2 gradi a velocità %3",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "DIRECTION",
        "options": [
          ["destra", "RIGHT"],
          ["sinistra", "LEFT"]
        ]
      },
      {
        "type": "input_value",
        "name": "DEGREES",
        "check": "Number"
      },
      {
        "type": "input_value",
        "name": "SPEED",
        "check": "Number"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#FF0000",
    "inputsInline": true,
    "tooltip": "Ruota il robot su se stesso dei gradi indicati, in base a diametro e distanza ruote",
    "helpUrl": ""
  },
  {
    "type": "spike_gyro_get_angle",
    "message0": "Angolo di orientamento %1",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "AXIS",
        "options": [
          ["Imbardata (Yaw)", "YAW"],
          ["Valore assoluto di Yaw (Imbardata)", "YAW_ABS"],
          ["Beccheggio (Pitch)", "PITCH"],
          ["Rollio (Roll)", "ROLL"]
        ]
      }
    ],
    "output": "Number",
    "colour": 180,
    "inputsInline": true,
    "tooltip": "Legge l'angolo di orientamento corrente (Yaw, Pitch o Roll) dal Brick in gradi (-180 a 180)",
    "helpUrl": ""
  },
  {
    "type": "spike_gyro_reset_yaw",
    "message0": "Resetta Yaw (Imbardata) a %1 gradi",
    "args0": [
      {
        "type": "input_value",
        "name": "ANGLE",
        "check": "Number"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180,
    "inputsInline": true,
    "tooltip": "Resetta l'angolo di imbardata (Yaw) al valore inserito",
    "helpUrl": ""
  },
  {
    "type": "spike_gyro_wait_angle",
    "message0": "Attendi fino a quando %1 %2 %3 gradi",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "AXIS",
        "options": [
          ["Yaw (Imbardata)", "YAW"],
          ["Valore assoluto di Yaw", "YAW_ABS"],
          ["Pitch (Beccheggio)", "PITCH"],
          ["Roll (Rollio)", "ROLL"]
        ]
      },
      {
        "type": "field_dropdown",
        "name": "COMP",
        "options": [
          [">", ">"],
          ["<", "<"],
          [">=", ">="],
          ["<=", "<="],
          ["==", "=="]
        ]
      },
      {
        "type": "input_value",
        "name": "ANGLE",
        "check": "Number"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 180,
    "inputsInline": true,
    "tooltip": "Sospende l'esecuzione del programma fino a quando l'angolo dell'asse selezionato (Yaw, Pitch o Roll) non soddisfa la condizione",
    "helpUrl": ""
  },
  {
    "type": "spike_light_matrix_clear",
    "message0": "Cancella schermo",
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#FF6B6B",
    "inputsInline": true,
    "tooltip": "Spegne tutti i LED sullo schermo del Brick",
    "helpUrl": ""
  },
  {
    "type": "spike_light_matrix_show_image",
    "message0": "Mostra immagine %1 sullo schermo",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "IMAGE",
        "options": [
          ["Felice", "IMAGE_HAPPY"],
          ["Cuore", "IMAGE_HEART"],
          ["Sì", "IMAGE_YES"],
          ["No", "IMAGE_NO"],
          ["Sorriso", "IMAGE_SMILE"],
          ["Triste", "IMAGE_SAD"],
          ["Rabbia", "IMAGE_ANGRY"],
          ["Sorpreso", "IMAGE_SURPRISED"],
          ["Freccia Nord", "IMAGE_ARROW_N"],
          ["Freccia Est", "IMAGE_ARROW_E"],
          ["Freccia Sud", "IMAGE_ARROW_S"],
          ["Freccia Ovest", "IMAGE_ARROW_W"]
        ]
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": "#FF6B6B",
    "inputsInline": true,
    "tooltip": "Mostra un'immagine predefinita sullo schermo del Brick",
    "helpUrl": ""
  },
  {
    "type": "spike_hub_button_pressed",
    "message0": "Pulsante del Brick %1 è premuto?",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "BUTTON",
        "options": [
          ["Sinistro", "LEFT"],
          ["Destro", "RIGHT"]
        ]
      }
    ],
    "output": "Boolean",
    "colour": "#FF6B6B",
    "inputsInline": true,
    "tooltip": "Ritorna vero se il pulsante selezionato del Brick è premuto",
    "helpUrl": ""
  },
  {
    "type": "spike_color_sensor_reflection",
    "message0": "Percentuale luce riflessa sulla porta %1",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"], ["E", "E"], ["F", "F"]
        ]
      }
    ],
    "output": "Number",
    "colour": "#228B22",
    "inputsInline": true,
    "tooltip": "Ritorna l'intensità di luce riflessa (da 0 a 100) del sensore di colore",
    "helpUrl": ""
  },
  {
    "type": "spike_color",
    "message0": "Colore %1",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "COLOR",
        "options": [
          ["Nero (0)", "0"],
          ["Magenta (1)", "1"],
          ["Blu (3)", "3"],
          ["Ciano (4)", "4"],
          ["Verde (5)", "5"],
          ["Giallo (7)", "7"],
          ["Rosso (9)", "9"],
          ["Bianco (10)", "10"],
          ["Nessuno (-1)", "-1"]
        ]
      }
    ],
    "output": "Number",
    "colour": "#8B4513",
    "inputsInline": true,
    "tooltip": "Seleziona un colore",
    "helpUrl": ""
  },
  {
    "type": "spike_color_sensor_color",
    "message0": "Colore rilevato sulla porta %1",
    "args0": [
      {
        "type": "field_dropdown",
        "name": "PORT",
        "options": [
          ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"], ["E", "E"], ["F", "F"]
        ]
      }
    ],
    "output": "Number",
    "colour": "#8B4513",
    "inputsInline": true,
    "tooltip": "Ritorna l'ID del colore rilevato (0-10) o -1 se nessun colore",
    "helpUrl": ""
  },
  {
    "type": "spike_repeat_forever",
    "message0": "ripeti per sempre %1 %2",
    "args0": [
      {
        "type": "input_dummy"
      },
      {
        "type": "input_statement",
        "name": "DO"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "colour": 120,
    "tooltip": "Esegue i blocchi all'interno all'infinito",
    "helpUrl": ""
  }
]);

// Define Python generators for custom blocks
function isMotorInverted(portName: string): boolean {
  try {
    const saved = localStorage.getItem('spike_motors');
    if (saved) {
      const motors = JSON.parse(saved);
      const config = motors.find((m: any) => m.port === portName);
      if (config) {
        return !!config.isInverted;
      }
    }
  } catch (e) {
    console.error("Errore nel leggere motori per inversione:", e);
  }
  return false;
}

function getWheelSpecs() {
  try {
    const diamSaved = localStorage.getItem('spike_wheel_diameter');
    const distSaved = localStorage.getItem('spike_wheel_distance');
    return {
      diameter: diamSaved ? parseFloat(diamSaved) : 5.6,
      distance: distSaved ? parseFloat(distSaved) : 11.5
    };
  } catch (e) {
    console.error("Errore nel leggere specifiche ruote:", e);
  }
  return { diameter: 5.6, distance: 11.5 };
}

function getMaxMotorSpeed(): number {
  try {
    const saved = localStorage.getItem('spike_max_motor_speed');
    return saved ? Math.max(1, parseInt(saved)) : 100;
  } catch (e) {
    console.error("Errore nel leggere velocità massima motori:", e);
  }
  return 100;
}

pythonGenerator.forBlock['spike_start'] = function(block: any, generator: any) {
  return '';
};

pythonGenerator.forBlock['spike_motor_run_for'] = function(block: any, generator: any) {
  const port = block.getFieldValue('PORT');
  const value = generator.valueToCode(block, 'VALUE', generator.ORDER_NONE) || '1';
  const unit = block.getFieldValue('UNIT');
  const speed = generator.valueToCode(block, 'SPEED', generator.ORDER_NONE) || '50';
  const maxSpeed = getMaxMotorSpeed();
  const scaledSpeed = `int(float(${speed}) * 1000 / ${maxSpeed})`;
  const finalSpeed = isMotorInverted(port) ? `-(${scaledSpeed})` : scaledSpeed;

  if (unit === 'SECONDS') {
    return `motor.run(port.${port}, ${finalSpeed})\nawait runloop.sleep_ms(int(float(${value}) * 1000))\nmotor.stop(port.${port})\n`;
  } else if (unit === 'DEGREES') {
    return `await motor.run_for_degrees(port.${port}, ${value}, ${finalSpeed})\n`;
  } else if (unit === 'ROTATIONS') {
    return `await motor.run_for_degrees(port.${port}, int(float(${value}) * 360), ${finalSpeed})\n`;
  } else { // CM
    const specs = getWheelSpecs();
    const degrees = `int(float(${value}) * 360 / (3.14159 * ${specs.diameter}))`;
    return `await motor.run_for_degrees(port.${port}, ${degrees}, ${finalSpeed})\n`;
  }
};

pythonGenerator.forBlock['spike_light_matrix_write'] = function(block: any, generator: any) {
  const text = generator.valueToCode(block, 'TEXT', generator.ORDER_NONE) || '""';
  return `light_matrix.write(${text})\nawait runloop.sleep_ms(50)\n`;
};

pythonGenerator.forBlock['spike_light_matrix_write_number'] = function(block: any, generator: any) {
  const num = generator.valueToCode(block, 'NUMBER', generator.ORDER_NONE) || '0';
  return `light_matrix.write(str(${num}))\nawait runloop.sleep_ms(50)\n`;
};

pythonGenerator.forBlock['spike_sound_beep'] = function(block: any, generator: any) {
  return `sound.beep()\n`;
};

pythonGenerator.forBlock['spike_sound_play_note'] = function(block: any, generator: any) {
  const note = block.getFieldValue('NOTE');
  const duration = generator.valueToCode(block, 'DURATION', generator.ORDER_NONE) || '0.5';
  return `sound.beep(${note}, int(float(${duration}) * 1000))\nawait runloop.sleep_ms(int(float(${duration}) * 1000))\n`;
};

pythonGenerator.forBlock['spike_print'] = function(block: any, generator: any) {
  const text = generator.valueToCode(block, 'TEXT', generator.ORDER_NONE) || '""';
  return `print(${text})\n`;
};

pythonGenerator.forBlock['spike_motor_run'] = function(block: any, generator: any) {
  const port = block.getFieldValue('PORT');
  const speed = generator.valueToCode(block, 'SPEED', generator.ORDER_NONE) || '50';
  const maxSpeed = getMaxMotorSpeed();
  const scaledSpeed = `int(float(${speed}) * 1000 / ${maxSpeed})`;
  const finalSpeed = isMotorInverted(port) ? `-(${scaledSpeed})` : scaledSpeed;
  return `motor.run(port.${port}, ${finalSpeed})\n`;
};

pythonGenerator.forBlock['spike_motor_stop'] = function(block: any, generator: any) {
  const port = block.getFieldValue('PORT');
  return `motor.stop(port.${port})\n`;
};

pythonGenerator.forBlock['spike_color_sensor'] = function(block: any, generator: any) {
  const port = block.getFieldValue('PORT');
  const code = `_safe_sensor(color_sensor.color, port.${port})`;
  return [code, generator.ORDER_ATOMIC];
};

pythonGenerator.forBlock['spike_distance_sensor'] = function(block: any, generator: any) {
  const port = block.getFieldValue('PORT');
  const code = `(_safe_sensor(distance_sensor.distance, port.${port}, -10) / 10)`; // converted from mm to cm for physical robot
  return [code, generator.ORDER_ATOMIC];
};

pythonGenerator.forBlock['spike_force_sensor'] = function(block: any, generator: any) {
  const port = block.getFieldValue('PORT');
  const code = `(_safe_sensor(force_sensor.force, port.${port}, 0) / 10)`; // converted from raw 0-100 to 0-10
  return [code, generator.ORDER_ATOMIC];
};

pythonGenerator.forBlock['spike_wait'] = function(block: any, generator: any) {
  const seconds = generator.valueToCode(block, 'SECONDS', generator.ORDER_NONE) || '1';
  return `await runloop.sleep_ms(int(float(${seconds}) * 1000))\n`;
};

pythonGenerator.forBlock['spike_light_matrix_clear'] = function(block: any, generator: any) {
  return `light_matrix.clear()\n`;
};

pythonGenerator.forBlock['spike_light_matrix_show_image'] = function(block: any, generator: any) {
  const image = block.getFieldValue('IMAGE');
  return `light_matrix.show_image(light_matrix.${image})\n`;
};

pythonGenerator.forBlock['spike_hub_button_pressed'] = function(block: any, generator: any) {
  const btn = block.getFieldValue('BUTTON');
  const code = `(button.pressed(button.${btn}) if hasattr(button, '${btn}') else (button.${btn.toLowerCase()}.is_pressed() if hasattr(button, '${btn.toLowerCase()}') else False))`;
  return [code, generator.ORDER_ATOMIC];
};

pythonGenerator.forBlock['spike_color_sensor_reflection'] = function(block: any, generator: any) {
  const port = block.getFieldValue('PORT');
  const code = `_safe_sensor(color_sensor.reflection, port.${port}, 0)`;
  return [code, generator.ORDER_ATOMIC];
};

pythonGenerator.forBlock['spike_color'] = function(block: any, generator: any) {
  const color = block.getFieldValue('COLOR');
  return [color, generator.ORDER_ATOMIC];
};

pythonGenerator.forBlock['spike_color_sensor_color'] = function(block: any, generator: any) {
  const port = block.getFieldValue('PORT');
  const code = `_safe_sensor(color_sensor.color, port.${port}, -1)`;
  return [code, generator.ORDER_ATOMIC];
};

function getTractionConfig() {
  try {
    const saved = localStorage.getItem('spike_motors');
    if (saved) {
      const motors = JSON.parse(saved);
      const traction = motors.filter((m: any) => m.isTraction && m.port);
      const left = traction[0] || { port: 'A', isInverted: false };
      const right = traction[1] || { port: 'B', isInverted: false };
      return {
        leftPort: left.port,
        rightPort: right.port,
        leftInverted: !!left.isInverted,
        rightInverted: !!right.isInverted
      };
    }
  } catch (e) {
    console.error("Errore nel leggere config trazione:", e);
  }
  return { leftPort: 'A', rightPort: 'B', leftInverted: false, rightInverted: false };
}

pythonGenerator.forBlock['spike_robot_move'] = function(block: any, generator: any) {
  const steering = generator.valueToCode(block, 'STEERING', generator.ORDER_NONE) || '0';
  const speed = generator.valueToCode(block, 'SPEED', generator.ORDER_NONE) || '50';
  const config = getTractionConfig();
  const maxSpeed = getMaxMotorSpeed();
  const scaledSpeed = `int(float(${speed}) * 1000 / ${maxSpeed})`;
  
  return `_drive_pair(int(${steering}), ${scaledSpeed})\n`;
};

pythonGenerator.forBlock['spike_robot_move_for'] = function(block: any, generator: any) {
  const steering = generator.valueToCode(block, 'STEERING', generator.ORDER_NONE) || '0';
  const value = generator.valueToCode(block, 'VALUE', generator.ORDER_NONE) || '1';
  const unit = block.getFieldValue('UNIT');
  const speed = generator.valueToCode(block, 'SPEED', generator.ORDER_NONE) || '50';
  const config = getTractionConfig();
  const maxSpeed = getMaxMotorSpeed();
  const scaledSpeed = `int(float(${speed}) * 1000 / ${maxSpeed})`;
  
  const finalSpeed = `int(${scaledSpeed})`;
  
  if (unit === 'SECONDS') {
    return `_drive_pair(int(${steering}), ${finalSpeed})\nawait runloop.sleep_ms(int(float(${value}) * 1000))\n_stop_pair()\n`;
  } else if (unit === 'DEGREES') {
    return `await _drive_pair_for_degrees(int(${value}), int(${steering}), ${finalSpeed})\n`;
  } else if (unit === 'ROTATIONS') {
    return `await _drive_pair_for_degrees(int(float(${value}) * 360), int(${steering}), ${finalSpeed})\n`;
  } else if (unit === 'ROBOT_DEGREES') {
    const specs = getWheelSpecs();
    const degrees = `int(float(${value}) * ${specs.distance} / ${specs.diameter})`;
    return `await _drive_pair_for_degrees(${degrees}, int(${steering}), ${finalSpeed})\n`;
  } else { // CM
    const specs = getWheelSpecs();
    const degrees = `int(float(${value}) * 360 / (3.14159 * ${specs.diameter}))`;
    return `await _drive_pair_for_degrees(${degrees}, int(${steering}), ${finalSpeed})\n`;
  }
};

pythonGenerator.forBlock['spike_robot_stop'] = function(block: any, generator: any) {
  return `_stop_pair()\n`;
};

pythonGenerator.forBlock['spike_robot_spin_degrees'] = function(block: any, generator: any) {
  const direction = block.getFieldValue('DIRECTION');
  const degreesInput = generator.valueToCode(block, 'DEGREES', generator.ORDER_NONE) || '90';
  const speed = generator.valueToCode(block, 'SPEED', generator.ORDER_NONE) || '50';
  
  const specs = getWheelSpecs();
  const maxSpeed = getMaxMotorSpeed();
  const scaledSpeed = `int(float(${speed}) * 1000 / ${maxSpeed})`;
  
  const steering = direction === 'RIGHT' ? '100' : '-100';
  const wheelDegrees = `int(float(${degreesInput}) * ${specs.distance} / ${specs.diameter})`;
  
  return `await _drive_pair_for_degrees(${wheelDegrees}, ${steering}, ${scaledSpeed})\n`;
};

pythonGenerator.forBlock['spike_gyro_get_angle'] = function(block: any, generator: any) {
  const axis = block.getFieldValue('AXIS');
  let index = '0';
  if (axis === 'YAW' || axis === 'YAW_ABS') index = '0';
  else if (axis === 'PITCH') index = '1';
  else if (axis === 'ROLL') index = '2';
  
  if (axis === 'YAW_ABS') {
    const code = `abs(int(motion_sensor.tilt_angles()[0] / 10))`;
    return [code, generator.ORDER_ATOMIC];
  }
  const code = `int(motion_sensor.tilt_angles()[${index}] / 10)`;
  return [code, generator.ORDER_ATOMIC];
};

pythonGenerator.forBlock['spike_gyro_reset_yaw'] = function(block: any, generator: any) {
  const angle = generator.valueToCode(block, 'ANGLE', generator.ORDER_NONE) || '0';
  return `motion_sensor.reset_yaw(int(${angle} * 10))\n`;
};

pythonGenerator.forBlock['spike_gyro_wait_angle'] = function(block: any, generator: any) {
  const axis = block.getFieldValue('AXIS');
  const comp = block.getFieldValue('COMP');
  const angle = generator.valueToCode(block, 'ANGLE', generator.ORDER_NONE) || '90';
  let index = '0';
  if (axis === 'YAW' || axis === 'YAW_ABS') index = '0';
  else if (axis === 'PITCH') index = '1';
  else if (axis === 'ROLL') index = '2';
  
  if (axis === 'YAW_ABS') {
    return `while not (abs(int(motion_sensor.tilt_angles()[0] / 10)) ${comp} int(${angle})):\n    await runloop.sleep_ms(10)\n`;
  }
  return `while not (int(motion_sensor.tilt_angles()[${index}] / 10) ${comp} int(${angle})):\n    await runloop.sleep_ms(10)\n`;
};

pythonGenerator.forBlock['spike_repeat_forever'] = function(block: any, generator: any) {
  const branch = generator.statementToCode(block, 'DO');
  let branchCode = branch;
  if (!branchCode.trim()) {
    branchCode = '    pass\n';
  }
  return `while True:\n${branchCode}`;
};

pythonGenerator.forBlock['controls_flow_statements'] = function(block: any, generator: any) {
  const flow = block.getFieldValue('FLOW');
  switch (flow) {
    case 'BREAK':
      return 'break\n';
    case 'CONTINUE':
      return 'continue\n';
  }
  return '';
};

pythonGenerator.forBlock['math_change'] = function(block: any, generator: any) {
  const argument0 = generator.valueToCode(block, 'DELTA', (pythonGenerator as any).ORDER_ADDITIVE) || '0';
  const varName = generator.getVariableName(block.getFieldValue('VAR'));
  return varName + ' = (' + varName + ' if isinstance(' + varName + ', (int, float)) else 0) + ' + argument0 + '\n';
};

const toolbox = {
  "kind": "categoryToolbox",
  "contents": [
    {
      "kind": "category",
      "name": "Eventi",
      "colour": "#00008B",
      "contents": [
        { "kind": "block", "type": "spike_start" }
      ]
    },
    {
      "kind": "category",
      "name": "Brick/schermo",
      "colour": "#FF6B6B",
      "contents": [
        {
          "kind": "block",
          "type": "spike_light_matrix_write",
          "inputs": {
            "TEXT": {
              "block": {
                "type": "text",
                "fields": { "TEXT": "Ciao" }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "spike_light_matrix_write_number",
          "inputs": {
            "NUMBER": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 123 }
              }
            }
          }
        },
        { "kind": "block", "type": "spike_light_matrix_clear" },
        { "kind": "block", "type": "spike_light_matrix_show_image" },
        {
          "kind": "block",
          "type": "spike_print",
          "inputs": {
            "TEXT": {
              "block": {
                "type": "text",
                "fields": { "TEXT": "Log..." }
              }
            }
          }
        },
        { "kind": "block", "type": "spike_hub_button_pressed" },
        { "kind": "block", "type": "text" }
      ]
    },
    {
      "kind": "category",
      "name": "Musica",
      "colour": "#555555",
      "contents": [
        {
          "kind": "block",
          "type": "spike_sound_play_note",
          "inputs": {
            "DURATION": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 0.5 }
              }
            }
          }
        },
        { "kind": "block", "type": "spike_sound_beep" }
      ]
    },
    {
      "kind": "category",
      "name": "Motori",
      "colour": "#C71585",
      "contents": [
        {
          "kind": "block",
          "type": "spike_motor_run_for",
          "inputs": {
            "VALUE": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 90 }
              }
            },
            "SPEED": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 50 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "spike_motor_run",
          "inputs": {
            "SPEED": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 50 }
              }
            }
          }
        },
        { "kind": "block", "type": "spike_motor_stop" }
      ]
    },
    {
      "kind": "category",
      "name": "Sensori",
      "colour": "#228B22",
      "contents": [
        { "kind": "block", "type": "spike_color_sensor" },
        { "kind": "block", "type": "spike_color_sensor_reflection" },
        { "kind": "block", "type": "spike_distance_sensor" },
        { "kind": "block", "type": "spike_force_sensor" }
      ]
    },
    {
      "kind": "category",
      "name": "Colori",
      "colour": "#8B4513",
      "contents": [
        { "kind": "block", "type": "spike_color" },
        { "kind": "block", "type": "spike_color_sensor_color" }
      ]
    },
    {
      "kind": "category",
      "name": "Giroscopio",
      "colour": 180,
      "contents": [
        { "kind": "block", "type": "spike_gyro_get_angle" },
        {
          "kind": "block",
          "type": "spike_gyro_reset_yaw",
          "inputs": {
            "ANGLE": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 0 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "spike_gyro_wait_angle",
          "inputs": {
            "ANGLE": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 90 }
              }
            }
          }
        }
      ]
    },
    {
      "kind": "category",
      "name": "Robot",
      "colour": "#FF0000",
      "contents": [
        {
          "kind": "block",
          "type": "spike_robot_move",
          "inputs": {
            "STEERING": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 0 }
              }
            },
            "SPEED": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 50 }
              }
            }
          }
        },
        {
          "kind": "block",
          "type": "spike_robot_move_for",
          "inputs": {
            "STEERING": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 0 }
              }
            },
            "VALUE": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 10 }
              }
            },
            "SPEED": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 50 }
              }
            }
          }
        },
        { "kind": "block", "type": "spike_robot_stop" },
        {
          "kind": "block",
          "type": "spike_robot_spin_degrees",
          "inputs": {
            "DEGREES": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 90 }
              }
            },
            "SPEED": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 50 }
              }
            }
          }
        }
      ]
    },
    {
      "kind": "category",
      "name": "Logica",
      "colour": "#FFA500",
      "contents": [
        { "kind": "block", "type": "controls_if", "colour": 40 },
        {
          "kind": "block",
          "type": "controls_if",
          "extraState": {
            "hasElse": true
          },
          "mutation": {
            "else": "1"
          },
          "colour": 40
        },
        {
          "kind": "block",
          "type": "controls_if",
          "extraState": {
            "hasElse": true,
            "elseIfCount": 1
          },
          "mutation": {
            "else": "1",
            "elseif": "1"
          },
          "colour": 40
        },
        { "kind": "block", "type": "logic_compare", "colour": 40 },
        { "kind": "block", "type": "logic_operation", "colour": 40 },
        { "kind": "block", "type": "logic_negate", "colour": 40 },
        { "kind": "block", "type": "logic_boolean", "colour": 40 }
      ]
    },
    {
      "kind": "category",
      "name": "Cicli/tempo",
      "colour": 120,
      "contents": [
        {
          "kind": "block",
          "type": "spike_wait",
          "inputs": {
            "SECONDS": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 1 }
              }
            }
          }
        },
        { "kind": "block", "type": "spike_repeat_forever" },
        { "kind": "block", "type": "controls_repeat_ext" },
        { "kind": "block", "type": "controls_whileUntil" },
        { "kind": "block", "type": "controls_for" },
        { "kind": "block", "type": "controls_flow_statements" }
      ]
    },
    {
      "kind": "category",
      "name": "Matematica",
      "colour": "#1D4ED8",
      "contents": [
        { "kind": "block", "type": "math_number", "colour": "#1D4ED8" },
        { "kind": "block", "type": "math_arithmetic", "colour": "#1D4ED8" },
        { "kind": "block", "type": "math_single", "colour": "#1D4ED8" },
        {
          "kind": "block",
          "type": "math_random_int",
          "colour": "#1D4ED8",
          "inputs": {
            "FROM": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 1 }
              }
            },
            "TO": {
              "block": {
                "type": "math_number",
                "fields": { "NUM": 100 }
              }
            }
          }
        }
      ]
    },
    {
      "kind": "category",
      "name": "Testo",
      "colour": "#000000",
      "contents": [
        { "kind": "block", "type": "text", "colour": "#000000" },
        { "kind": "block", "type": "text_join", "colour": "#000000" }
      ]
    },
    {
      "kind": "category",
      "name": "Variabili",
      "custom": "VARIABLE",
      "colour": "#EAB308"
    },
    {
      "kind": "category",
      "name": "Funzioni",
      "custom": "PROCEDURE",
      "colour": 290
    }
  ]
};

export interface BlocklyEditorRef {
  saveWorkspace: () => any;
  loadWorkspace: (state: any) => void;
  saveSelectedBlock: () => any;
  appendBlock: (state: any) => void;
}

interface BlocklyEditorProps {
  onCodeChange: (code: string) => void;
  motors?: any[];
  wheelDiameter?: number;
  wheelDistance?: number;
  maxMotorSpeed?: number;
  isVisible?: boolean;
  isVirtualActive?: boolean;
  onToggleVirtual?: () => void;
}

const generateCodeFromWorkspace = (workspace: Blockly.WorkspaceSvg) => {
  pythonGenerator.init(workspace);
  let code = '';
  const blocks = workspace.getTopBlocks(true);
  
  // Find the non-procedure block with the most descendants (the main program stack)
  // Give priority to the 'spike_start' block if it exists
  let mainBlock: Blockly.Block | null = null;
  let maxDescendants = -1;
  let hasStartBlock = false;
  
  for (const block of blocks) {
    if (block.type === 'spike_start') {
      mainBlock = block;
      hasStartBlock = true;
      break;
    }
  }

  if (!hasStartBlock) {
    for (const block of blocks) {
      const isProcedure = block.type === 'procedures_defnoreturn' || block.type === 'procedures_defreturn';
      if (!isProcedure) {
        const descendantCount = block.getDescendants(false).length;
        if (descendantCount > maxDescendants) {
          maxDescendants = descendantCount;
          mainBlock = block;
        }
      }
    }
  }
  
  for (let x = 0; x < blocks.length; x++) {
    const block = blocks[x];
    const isProcedure = block.type === 'procedures_defnoreturn' || block.type === 'procedures_defreturn';
    if (isProcedure || block === mainBlock) {
      let line = pythonGenerator.blockToCode(block);
      if (Array.isArray(line)) {
        line = line[0];
      }
      if (line) {
        if (block.outputConnection) {
          line = (pythonGenerator as any).scrubNakedValue(line as string);
        }
        code += line;
      }
    }
  }
  
  code = pythonGenerator.finish(code);
  code = code.replace(/^\s+\n/, '');
  code = code.replace(/\n\s+$/, '\n');
  code = code.replace(/[ \t]+\n/g, '\n');
  return code;
};

const BlocklyEditor = forwardRef<BlocklyEditorRef, BlocklyEditorProps>(
  ({ onCodeChange, motors, wheelDiameter, wheelDistance, maxMotorSpeed, isVisible, isVirtualActive, onToggleVirtual }, ref) => {
    const blocklyDiv = useRef<HTMLDivElement>(null);
    const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
    const [currentCode, setCurrentCode] = useState("");

    const [promptData, setPromptData] = useState<{
      message: string;
      defaultValue: string;
      callback: (value: string | null) => void;
    } | null>(null);
    const [promptValue, setPromptValue] = useState("");
    const promptInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (promptData) {
        setPromptValue(promptData.defaultValue);
        setTimeout(() => {
          if (promptInputRef.current) {
            promptInputRef.current.focus();
            promptInputRef.current.select();
          }
        }, 50);
      }
    }, [promptData]);

    const handlePromptSubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (promptData) {
        promptData.callback(promptValue);
        setPromptData(null);
      }
    };

    const handlePromptCancel = () => {
      if (promptData) {
        promptData.callback(null);
        setPromptData(null);
      }
    };

    useEffect(() => {
      if (isVisible && workspaceRef.current) {
        setTimeout(() => {
          if (workspaceRef.current) {
            Blockly.svgResize(workspaceRef.current);
          }
        }, 50);
      }
    }, [isVisible]);

    const selectedBlockRef = useRef<Blockly.Block | null>(null);

    useImperativeHandle(ref, () => ({
      saveWorkspace() {
        if (workspaceRef.current) {
          return Blockly.serialization.workspaces.save(workspaceRef.current);
        }
        return null;
      },
      loadWorkspace(state: any) {
        if (workspaceRef.current) {
          try {
            if (state && Object.keys(state).length > 0) {
              workspaceRef.current.clear();
              Blockly.serialization.workspaces.load(state, workspaceRef.current);
            } else {
              workspaceRef.current.clear();
              try {
                const block = workspaceRef.current.newBlock('spike_start');
                block.initSvg();
                block.render();
                block.moveBy(40, 40);
              } catch (e) {
                console.error("Errore durante la creazione del blocco di default:", e);
              }
            }
          } catch (error) {
            console.error("Errore nel caricamento del workspace:", error);
            alert("Impossibile caricare il file. Assicurati che sia un file di programma Spike valido.");
          }
        }
      },
      saveSelectedBlock() {
        let selected = Blockly.common.getSelected() as any as Blockly.Block;
        if (!selected) {
           selected = selectedBlockRef.current as Blockly.Block;
        }
        if (!selected) return null;
        try {
          return Blockly.serialization.blocks.save(selected);
        } catch (err) {
          console.error("Errore salvataggio blocco", err);
          return null;
        }
      },
      appendBlock(state: any) {
        if (workspaceRef.current && state) {
          try {
            Blockly.serialization.blocks.append(state, workspaceRef.current, {recordUndo: true});
          } catch (error) {
            console.error("Errore nell'aggiungere il blocco:", error);
            alert("Impossibile aggiungere i blocchi dal file.");
          }
        }
      }
    }));

  // Helper per generare il codice completo
  const generateFullCode = useCallback((code: string) => {
    const config = getTractionConfig();
    let indentedCode = code ? code.split('\n').map(line => line ? `    ${line}` : '').join('\n') : '    pass';
    indentedCode = indentedCode.replace(/runloop.sleep_ms/g, 'custom_sleep');
    return `import motor
import motor_pair
import color_sensor
import distance_sensor
import force_sensor
from hub import port, light_matrix, sound, motion_sensor, button
try:
    from hub import status_light
except ImportError:
    status_light = None
import utime
import runloop
import sys

__stop_flag = False
_is_running_user_code = False
_WAIT_FIRST_TIME = False

_LEFT_PORT = port.${config.leftPort}
_RIGHT_PORT = port.${config.rightPort}
_LEFT_INVERTED = ${config.leftInverted ? 'True' : 'False'}
_RIGHT_INVERTED = ${config.rightInverted ? 'True' : 'False'}

def _drive_pair(steering, velocity):
    if not _LEFT_INVERTED and not _RIGHT_INVERTED:
        motor_pair.move(motor_pair.PAIR_1, steering, velocity=velocity)
        return

    if _LEFT_INVERTED and _RIGHT_INVERTED:
        motor_pair.move(motor_pair.PAIR_1, -steering, velocity=-velocity)
        return

    left_vel = velocity
    right_vel = velocity
    if steering > 0:
        right_vel = int(velocity * (50 - steering) / 50)
    elif steering < 0:
        left_vel = int(velocity * (50 + steering) / 50)
        
    if _LEFT_INVERTED:
        left_vel = -left_vel
    if _RIGHT_INVERTED:
        right_vel = -right_vel

    try: motor.run(_LEFT_PORT, left_vel)
    except: pass
    try: motor.run(_RIGHT_PORT, right_vel)
    except: pass

async def _drive_pair_for_degrees(degrees, steering, velocity):
    if globals().get('__stop_flag', False):
        raise Exception("Programma Interrotto")

    if not _LEFT_INVERTED and not _RIGHT_INVERTED:
        await motor_pair.move_for_degrees(motor_pair.PAIR_1, degrees, steering, velocity=velocity)
        if globals().get('__stop_flag', False):
            raise Exception("Programma Interrotto")
        return

    if _LEFT_INVERTED and _RIGHT_INVERTED:
        await motor_pair.move_for_degrees(motor_pair.PAIR_1, degrees, -steering, velocity=-velocity)
        if globals().get('__stop_flag', False):
            raise Exception("Programma Interrotto")
        return

    left_vel = velocity
    right_vel = velocity
    if steering > 0:
        right_vel = int(velocity * (50 - steering) / 50)
    elif steering < 0:
        left_vel = int(velocity * (50 + steering) / 50)
        
    if _LEFT_INVERTED:
        left_vel = -left_vel
    if _RIGHT_INVERTED:
        right_vel = -right_vel

    try: motor.reset_relative_position(_LEFT_PORT, 0)
    except: pass
    try: motor.reset_relative_position(_RIGHT_PORT, 0)
    except: pass

    try: motor.run(_LEFT_PORT, left_vel)
    except: pass
    try: motor.run(_RIGHT_PORT, right_vel)
    except: pass

    target = abs(degrees)
    try:
        while True:
            if globals().get('__stop_flag', False):
                break
            pos_left = 0
            pos_right = 0
            try: pos_left = abs(motor.relative_position(_LEFT_PORT))
            except: pass
            try: pos_right = abs(motor.relative_position(_RIGHT_PORT))
            except: pass
            
            if pos_left >= target or pos_right >= target:
                break
            await runloop.sleep_ms(10)
    finally:
        try: motor.stop(_LEFT_PORT)
        except: pass
        try: motor.stop(_RIGHT_PORT)
        except: pass

    if globals().get('__stop_flag', False):
        raise Exception("Programma Interrotto")

def _stop_pair():
    try: motor_pair.stop(motor_pair.PAIR_1)
    except: pass
    try: motor.stop(_LEFT_PORT)
    except: pass
    try: motor.stop(_RIGHT_PORT)
    except: pass

def _safe_sensor(func, port_val, def_val=-1):
    try:
        return func(port_val)
    except OSError:
        return def_val

async def custom_sleep(ms):
    if globals().get('__stop_flag', False):
        raise Exception("Programma Interrotto")
    await runloop.sleep_ms(ms)

async def _monitor_stop_button():
    from hub import button, port
    import runloop
    import sys
    try:
        # Attendi che il tasto di avvio venga rilasciato prima di iniziare a monitorare lo stop
        await runloop.sleep_ms(400)
        while True:
            pressed = False
            if hasattr(button, 'CENTER') and button.pressed(button.CENTER):

                pressed = True
            if hasattr(button, 'POWER') and button.pressed(button.POWER):

                pressed = True
            try:
                if hasattr(button, 'center') and button.center.is_pressed():

                    pressed = True
            except:
                pass
            if hasattr(button, 'center') and button.pressed(button.center):

                pressed = True
            if hasattr(button, 'power') and button.pressed(button.power):

                pressed = True
            
            if pressed and globals().get('_is_running_user_code', False):
                # Interrompi immediatamente tutti i motori
                global __stop_flag
                __stop_flag = True
                try:
                    import motor_pair
                    motor_pair.stop(motor_pair.PAIR_1)
                except:
                    pass
                try:
                    import motor
                    for p in ['A', 'B', 'C', 'D', 'E', 'F']:
                        try: motor.stop(getattr(port, p))
                        except: pass
                except:
                    pass
            await runloop.sleep_ms(50)
    except:
        pass

# Gestione motori di trazione
try:
    motor_pair.unpair(motor_pair.PAIR_1)
except:
    pass
try:
    motor_pair.pair(motor_pair.PAIR_1, port.${config.leftPort}, port.${config.rightPort})
except:
    pass

# Robot specs: diameter=${wheelDiameter || 5.6}cm, wheel_distance=${wheelDistance || 11.5}cm

async def _run_user_code():
    # === START_BLOCKLY_CODE ===
${indentedCode}
    # === END_BLOCKLY_CODE ===

async def main():
    global __stop_flag
    global _is_running_user_code
    from hub import button, light_matrix
    try:
        from hub import status_light
    except ImportError:
        status_light = None
    import runloop
    import sys

    # Svuota lo schermo all'avvio del programma
    try:
        light_matrix.clear()
    except:
        pass

    try:
        if hasattr(runloop, 'create_task'):
            runloop.create_task(_monitor_stop_button())
        else:
            import asyncio
            asyncio.create_task(_monitor_stop_button())
    except Exception as e:
        print("Errore monitor stop:", e)

    is_wait_mode = globals().get('_WAIT_FIRST_TIME', False)
    first_run = True
    
    while True:
        # Se siamo in modalità attesa (Upload) o non è il primo giro, attendiamo il tasto
        if (first_run and is_wait_mode) or not first_run:
            # Mostra lo stato: 'C' per il primo avvio dopo caricamento, 'R' per le ripetizioni
            if first_run and is_wait_mode:
                if status_light:
                    try:
                        status_light.on('red')
                    except:
                        pass
                try:
                    light_matrix.write("C")
                except:
                    try:
                        light_matrix.show("C")
                    except:
                        pass
                
                # Segnale acustico di caricamento completato in attesa
                try:
                    sound.beep(1000, 100, 100)
                except:
                    try:
                        sound.beep()
                    except:
                        pass
                await runloop.sleep_ms(200)
                try:
                    sound.beep(1000, 100, 100)
                except:
                    try:
                        sound.beep()
                    except:
                        pass
            elif not first_run:
                try:
                    light_matrix.clear()
                except:
                    pass
                if status_light:
                    try:
                        status_light.on('white')
                    except:
                        pass

            # Attendi la pressione del tasto
            while True:
                start_pressed = False
                if hasattr(button, 'LEFT') and button.pressed(button.LEFT):

                    start_pressed = True
                if hasattr(button, 'RIGHT') and button.pressed(button.RIGHT):

                    start_pressed = True
                if hasattr(button, 'CENTER') and button.pressed(button.CENTER):

                    start_pressed = True
                if hasattr(button, 'POWER') and button.pressed(button.POWER):

                    start_pressed = True
                try:
                    if hasattr(button, 'left') and button.left.is_pressed():

                        start_pressed = True
                    if hasattr(button, 'right') and button.right.is_pressed():

                        start_pressed = True
                    if hasattr(button, 'center') and button.center.is_pressed():

                        start_pressed = True
                except:
                    pass
                if hasattr(button, 'center') and button.pressed(button.center):

                    start_pressed = True
                if hasattr(button, 'power') and button.pressed(button.power):

                    start_pressed = True
                
                if start_pressed:
                    break
                await runloop.sleep_ms(50)

            # Attendi il rilascio del tasto
            for _ in range(50):
                still_pressed = False
                if hasattr(button, 'LEFT') and button.pressed(button.LEFT):

                    still_pressed = True
                if hasattr(button, 'RIGHT') and button.pressed(button.RIGHT):

                    still_pressed = True
                if hasattr(button, 'CENTER') and button.pressed(button.CENTER):

                    still_pressed = True
                try:
                    if hasattr(button, 'left') and button.left.is_pressed():

                        still_pressed = True
                    if hasattr(button, 'right') and button.right.is_pressed():

                        still_pressed = True
                    if hasattr(button, 'center') and button.center.is_pressed():

                        still_pressed = True
                except:
                    pass
                if hasattr(button, 'center') and button.pressed(button.center):

                    still_pressed = True
                if not still_pressed:
                    break
                await runloop.sleep_ms(20)

            # Dopo la pressione del tasto, puliamo
            try:
                light_matrix.clear()
            except:
                pass
            if status_light:
                try:
                    status_light.on('white')
                except:
                    pass
            await runloop.sleep_ms(100)

        # Resetta i flag e avvia il codice
        __stop_flag = False
        _is_running_user_code = True

        try:
            await _run_user_code()
        except BaseException as e:
            print("Interruzione o errore:", e)
        
        # Se abbiamo eseguito via tasto (o eravamo in wait mode), assicuriamo lo schermo spento
        if is_wait_mode or not first_run:
            try:
                light_matrix.clear()
            except:
                pass
            await runloop.sleep_ms(50)

        _is_running_user_code = False
        _stop_pair()

        if not is_wait_mode:
            break

        first_run = False
        await runloop.sleep_ms(500)

runloop.run(main())
`;
  }, [wheelDiameter, wheelDistance]);

  // Trigger regeneration when motors configuration, wheel parameters, maxMotorSpeed or currentCode changes
  useEffect(() => {
    if (workspaceRef.current) {
      let code = generateCodeFromWorkspace(workspaceRef.current);
      const defs = code.match(/^def ([a-zA-Z0-9_]+)\(/gm);
      if (defs) {
        const funcNames = defs.map(d => d.replace('def ', '').replace('(', '').trim());
        code = code.replace(/^def /gm, 'async def ');
        funcNames.forEach(name => {
          const regex = new RegExp(`\\b${name}\\s*\\(`, 'g');
          code = code.replace(regex, (match, offset, string) => {
            const textBefore = string.substring(0, offset);
            if (textBefore.endsWith('def ') || textBefore.endsWith('async def ') || textBefore.endsWith('.')) {
              return match;
            }
            return `await ${match}`;
          });
        });
      }
      
      if (code !== currentCode) {
        setCurrentCode(code);
      }
      onCodeChange(generateFullCode(code));
    }
  }, [motors, wheelDiameter, wheelDistance, maxMotorSpeed, onCodeChange, generateFullCode, currentCode]);

  useEffect(() => {
    if (blocklyDiv.current && !workspaceRef.current) {
      // Change Logica blocks color
      const logicBlocks = ['controls_if', 'logic_compare', 'logic_operation', 'logic_negate', 'logic_boolean'];
      logicBlocks.forEach(type => {
        if (Blockly.Blocks[type]) {
            if (Blockly.Blocks[type].init) {
                const originalInit = Blockly.Blocks[type].init;
                Blockly.Blocks[type].init = function() {
                    originalInit.apply(this, arguments);
                    (this as any).setColour('#FFA500');
                };
            } else {
                Blockly.Blocks[type].colour = '#FFA500';
            }
        }
      });
      
      // Change Matematica blocks color
      const mathBlocks = ['math_number', 'math_arithmetic', 'math_single', 'math_random_int'];
      mathBlocks.forEach(type => {
        if (Blockly.Blocks[type]) {
            if (Blockly.Blocks[type].init) {
                const originalInit = Blockly.Blocks[type].init;
                Blockly.Blocks[type].init = function() {
                    originalInit.apply(this, arguments);
                    (this as any).setColour('#1D4ED8');
                };
            } else {
                Blockly.Blocks[type].colour = '#1D4ED8';
            }
        }
      });
      
      // Change Testo blocks color
      const textBlocks = ['text', 'text_join'];
      textBlocks.forEach(type => {
        if (Blockly.Blocks[type]) {
            if (Blockly.Blocks[type].init) {
                const originalInit = Blockly.Blocks[type].init;
                Blockly.Blocks[type].init = function() {
                    originalInit.apply(this, arguments);
                    (this as any).setColour('#000000');
                };
            } else {
                Blockly.Blocks[type].colour = '#000000';
            }
        }
      });

      // Change Variabili blocks color
      const variableBlocks = ['variables_get', 'variables_set', 'math_change'];
      variableBlocks.forEach(type => {
        if (Blockly.Blocks[type]) {
            if (Blockly.Blocks[type].init) {
                const originalInit = Blockly.Blocks[type].init;
                Blockly.Blocks[type].init = function() {
                    originalInit.apply(this, arguments);
                    (this as any).setColour('#EAB308');
                };
            } else {
                Blockly.Blocks[type].colour = '#EAB308';
            }
        }
      });
      // Register custom variable prompt dialog
      if ((Blockly as any).dialog && typeof (Blockly as any).dialog.setPrompt === 'function') {
        (Blockly as any).dialog.setPrompt((message: string, defaultValue: string, callback: (val: string | null) => void) => {
          setPromptData({ message, defaultValue, callback });
        });
      }

      workspaceRef.current = Blockly.inject(blocklyDiv.current, {
        toolbox: toolbox,
        trashcan: true,
        move: {
          scrollbars: true,
          drag: true,
          wheel: true
        }
      });

      // Se non ci sono blocchi, inserisce quello di default "Quando il programma inizia"
      if (workspaceRef.current && workspaceRef.current.getAllBlocks(false).length === 0) {
        try {
          const block = workspaceRef.current.newBlock('spike_start');
          block.initSvg();
          block.render();
          block.moveBy(40, 40);
        } catch (e) {
          console.error("Errore durante la creazione del blocco di default:", e);
        }
      }

      // Forza tutti i blocchi in modalità "ingressi in linea" di default e traccia l'ultimo selezionato
      workspaceRef.current.addChangeListener((event: any) => {
        const selected = Blockly.common.getSelected();
        if (selected) {
          selectedBlockRef.current = selected as any as Blockly.Block;
        }
        
        if (event.type === Blockly.Events.BLOCK_CREATE) {
          const blockId = event.blockId;
          const block = workspaceRef.current?.getBlockById(blockId);
          if (block) {
            block.setInputsInline(true);
          }
        }
      });

      // Configure trashcan behavior: make it open when a block is near, and delete on drop
      
      const trashcan = (workspaceRef.current as any).trashcan;
      if (trashcan) {
        // Remove old overrides if any (this is a fresh approach)
        const originalWouldDelete = trashcan.wouldDelete.bind(trashcan);
        trashcan.wouldDelete = function (element: any, opt_heuristic?: boolean): boolean {
          if (!element) return false;

          let trashRect = null;
          try {
            trashRect = typeof trashcan.getClientRect === "function" ? trashcan.getClientRect() : null;
          } catch (e) {
            console.error("Error getting trashcan client rect", e);
          }

          let elementRect = null;
          try {
            if (typeof element.getClientRect === "function") {
              elementRect = element.getClientRect();
            } else if (typeof element.getSvgRoot === "function") {
              const svgRoot = element.getSvgRoot();
              if (svgRoot && typeof svgRoot.getBoundingClientRect === "function") {
                elementRect = svgRoot.getBoundingClientRect();
              }
            }
          } catch (e) {
            console.error("Error getting element client rect", e);
          }

          const nearTrash = () => {
             if (!trashRect || !elementRect) return false;
             const margin = 100; // 100 pixels margin around the trashcan
             const expandedTrashRect = {
               top: trashRect.top - margin,
               bottom: trashRect.bottom + margin,
               left: trashRect.left - margin,
               right: trashRect.right + margin
             };
             return !(
               elementRect.left > expandedTrashRect.right ||
               elementRect.right < expandedTrashRect.left ||
               elementRect.top > expandedTrashRect.bottom ||
               elementRect.bottom < expandedTrashRect.top
             );
          };

          const isNear = nearTrash();
          console.log("Is trashcan lid opener function present?", typeof trashcan.setLidOpen === "function");
          if (typeof trashcan.setLidOpen === "function") {
            trashcan.setLidOpen(isNear);
          }

          return originalWouldDelete(element, opt_heuristic);
        };
      }

      workspaceRef.current.addChangeListener(() => {
        if (workspaceRef.current) {
          let code = generateCodeFromWorkspace(workspaceRef.current);
          const defs = code.match(/^def ([a-zA-Z0-9_]+)\(/gm);
          if (defs) {
            const funcNames = defs.map(d => d.replace('def ', '').replace('(', '').trim());
            code = code.replace(/^def /gm, 'async def ');
            funcNames.forEach(name => {
              const regex = new RegExp(`\\b${name}\\s*\\(`, 'g');
              code = code.replace(regex, (match, offset, string) => {
                const textBefore = string.substring(0, offset);
                if (textBefore.endsWith('def ') || textBefore.endsWith('async def ') || textBefore.endsWith('.')) {
                  return match;
                }
                return `await ${match}`;
              });
            });
          }
          setCurrentCode(code);
        }
      });
    }
    
    return () => {
      // Optional: cleanup workspace on unmount, but usually okay to keep for single page app
    };
  }, [onCodeChange]);

  const handleZoomIn = () => {
    if (workspaceRef.current) {
      workspaceRef.current.zoomCenter(1);
    }
  };

  const handleZoomOut = () => {
    if (workspaceRef.current) {
      workspaceRef.current.zoomCenter(-1);
    }
  };

  const handleClear = () => {
    if (workspaceRef.current && window.confirm("Sei sicuro di voler cancellare tutti i blocchi?")) {
      workspaceRef.current.clear();
    }
  };

  return (
    <div className="w-full h-full relative">
      <div ref={blocklyDiv} className="absolute inset-0" />
      
      {/* Overlay controls - positioned vertically above the trashcan area */}
      <div className="absolute bottom-24 right-4 flex flex-col gap-2 z-[9999] pointer-events-auto">
        <button
          onClick={handleZoomIn}
          className="p-1.5 bg-white border-2 border-black rounded-md shadow-sm hover:bg-neutral-100 transition-colors text-neutral-900"
          title="Ingrandisci"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 bg-white border-2 border-black rounded-md shadow-sm hover:bg-neutral-100 transition-colors text-neutral-900"
          title="Rimpicciolisci"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Custom Yellow Variable Prompt Modal */}
      {promptData && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 pointer-events-auto">
          <form
            onSubmit={handlePromptSubmit}
            className="w-full max-w-sm bg-yellow-400 border-4 border-black p-6 rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black animate-in fade-in zoom-in duration-150"
          >
            <h3 className="text-md font-extrabold uppercase tracking-wide mb-3">
              {promptData.message}
            </h3>
            <input
              ref={promptInputRef}
              type="text"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              className="w-full bg-white border-3 border-black rounded-xl px-3 py-2 text-neutral-900 font-bold text-base focus:outline-none focus:ring-2 focus:ring-black mb-5 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1)]"
              placeholder="Nome della variabile..."
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handlePromptCancel}
                className="px-4 py-2 border-3 border-black rounded-xl font-bold bg-neutral-100 hover:bg-neutral-200 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-4 py-2 border-3 border-black rounded-xl font-bold bg-black text-white hover:bg-neutral-800 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
              >
                Conferma
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
});

export default BlocklyEditor;
