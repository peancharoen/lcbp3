const fs = require('fs');
let lines = fs.readFileSync('n8n.workflow.json', 'utf8').split('\n');

const toRemove = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('  // Ollama Settings\\n  OLLAMA_HOST:')) toRemove.push(i);
  if (lines[i].startsWith('const model = isFallback ? config.OLLAMA_MODEL_FALLBACK')) toRemove.push(i);
  if (lines[i].startsWith("      response_to: String(meta.response_to || '').trim() || null,\\n")) toRemove.push(i);
}

const newLines = lines.filter((_, i) => !toRemove.includes(i));
fs.writeFileSync('n8n.workflow.json', newLines.join('\n'));

try {
  JSON.parse(fs.readFileSync('n8n.workflow.json', 'utf8'));
  console.log('SUCCESS!');
} catch (e) {
  console.error('FAIL:', e.message);
}
