const fs = require('fs');
const report = fs.readFileSync('eslint_report_v7.txt', 'utf8');
const lines = report.split('\n');
const files = {};
let currentFile = null;

lines.forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  // Check if line is a filename (starts with D:\)
  if (trimmed.startsWith('D:\\')) {
    currentFile = trimmed;
    return;
  }

  // Check if line is an error with "any"
  if (currentFile && (trimmed.includes('no-unsafe') || trimmed.includes('no-explicit-any'))) {
    files[currentFile] = (files[currentFile] || 0) + 1;
  }
});

const sorted = Object.entries(files).sort((a, b) => b[1] - a[1]);
console.log('Top 20 files with "any" issues:');
console.log(
  sorted
    .slice(0, 20)
    .map(([file, count]) => `${count} - ${file}`)
    .join('\n')
);
