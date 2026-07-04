import fs from 'fs';
const editor = fs.readFileSync('src/components/BlocklyEditor.tsx', 'utf8');
const match = editor.match(/const generateFullCode =.*?return \`(.*?)\`;/s);
let py = match[1];
py = py.replace(/\$\{.*?\}/g, 'A');

const env = fs.readFileSync('src/components/VirtualEnvironment.tsx', 'utf8');
const start = env.indexOf('const transpilePythonToJs = (pythonCode: string) => {');
let end = env.indexOf('  useEffect(() => {', start);
end = env.lastIndexOf('  };', end) + 4;
let transpilerCode = env.substring(start, end);

const wrapper = `
export const transpilePythonToJsWrapper = (pythonCode) => {
  let activeExecutionId = 1;
  const robotRef = { current: { angle: 0, x: 0, y: 0 } };
  const sensorReadingsRef = { current: {} };
  const setConsoleLogs = (cb) => {};
  const setIsRunningCode = (b) => {};
  const setIsPlaying = (b) => {};
  const triggerBeep = (f, ms) => {};
  let wheelDiameter = 5.6;
  const mapType = 'default';
  const customBgImage = null;
  const translateExpression = (e) => e;

  ${transpilerCode.replace(/: string/g, '')}

  return transpilePythonToJs(pythonCode);
}
`;
fs.writeFileSync('temp.js', wrapper);
