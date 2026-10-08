const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      results.push(file);
    }
  });
  return results;
}
const files = walk('d:/sarthak/podosphere_technologies_website/src/app/api/social');
let modifiedCount = 0;
files.forEach(file => {
  if (!file.endsWith('route.ts')) return;
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('getCurrentOrganization()') && !content.includes('requireRole(')) {
    if (!content.includes('requireRole')) {
      content = content.replace(/import \{ getCurrentOrganization \}.*?;/, "import { getCurrentOrganization } from '@/shared/server/current-organization';\nimport { requireRole } from '@/shared/server/access';");
    }
    content = content.replace(/const (\w+) = await getCurrentOrganization\(\);/g, "const $1 = await getCurrentOrganization();\n    await requireRole('ADMIN');");
    fs.writeFileSync(file, content);
    modifiedCount++;
  }
});
console.log('Modified', modifiedCount, 'files.');
