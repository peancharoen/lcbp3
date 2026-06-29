const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function (file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

const paths = ['backend/src', 'frontend/app', 'frontend/components'];
paths.forEach((p) => {
  const fullPath = path.resolve(process.cwd(), p);
  if (!fs.existsSync(fullPath)) return;
  const files = getAllFiles(fullPath);
  files.forEach((file) => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // 1. Handle parseInt(expression, 10) -> Number(expression)
    // Using a more greedy approach for expression
    const newContent1 = content.replace(/parseInt\s*\(([\s\S]+?),\s*10\s*\)/g, (match, p1) => {
      return `Number(${p1.trim()})`;
    });
    if (newContent1 !== content) {
      content = newContent1;
      changed = true;
    }

    // 2. Handle parseInt(expression) -> Number(expression)
    const newContent2 = content.replace(/parseInt\s*\(([\s\S]+?)\)/g, (match, p1) => {
      if (p1.trim().startsWith('Number(')) return match;
      return `Number(${p1.trim()})`;
    });
    if (newContent2 !== content) {
      content = newContent2;
      changed = true;
    }

    // 3. Handle +expression -> Number(expression)
    // Only if it's NOT part of a larger number literal or addition/subtraction
    // This is tricky with regex, so we'll look for common patterns like @Param() id: string -> +id
    // But the lint error message said "+value is forbidden", so it's likely single variable prefix
    // We'll target patterns like: = +someVar, ( +someVar ), [ +someVar ], : +someVar, return +someVar
    const patterns = [/(=|\(|\{|\[|:|,|\s|!)\+([a-zA-Z0-0_.]+(?:\([^)]*\))?)/g];

    patterns.forEach((regex) => {
      const newContent = content.replace(regex, (match, prefix, expr) => {
        // Avoid replacing things like '1 + 2' or 'string + string'
        // We only replace if the prefix is a delimiter or space and it's a unary '+'
        if (expr.match(/^[0-9]/)) return match; // skip +1, +0.5
        return `${prefix}Number(${expr})`;
      });
      if (newContent !== content) {
        content = newContent;
        changed = true;
      }
    });

    if (changed) {
      console.log(`Fixed: ${file}`);
      fs.writeFileSync(file, content, 'utf8');
    }
  });
});
