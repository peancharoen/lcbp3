const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (
      stat &&
      stat.isDirectory() &&
      !file.includes('node_modules') &&
      !file.includes('.next') &&
      !file.includes('dist')
    ) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(rootDir);

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Fix no-console in frontend specifically (as per ADR-011)
  if (file.includes('frontend')) {
    const consoleRegex = /console\.(log|error|warn|info|debug)\(.*\);?/g;
    if (consoleRegex.test(content)) {
      content = content.replace(consoleRegex, (match) => `// ${match} /* TODO: Remove before prod */`);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
