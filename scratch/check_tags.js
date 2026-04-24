
const fs = require('fs');
const content = fs.readFileSync('c:/Users/so/Desktop/wardstaffer/src/App.tsx', 'utf8');

const lines = content.split('\n');
let depth = 0;
lines.forEach((line, i) => {
    const openings = (line.match(/<div/g) || []).length;
    const closings = (line.match(/<\/div>/g) || []).length;
    const fragOpenings = (line.match(/<>/g) || []).length;
    const fragClosings = (line.match(/<\/>/g) || []).length;
    
    depth += openings - closings + fragOpenings - fragClosings;
    
    if (depth < 0) {
        console.log(`Line ${i + 1}: Depth dropped below 0 (${depth})`);
        console.log(line);
        depth = 0; // reset to keep going
    }
});
console.log(`Final depth: ${depth}`);
