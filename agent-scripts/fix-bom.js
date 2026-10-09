const fs = require('fs');
const path = './packages/database/prisma/migrations/20261008000000_init/migration.sql';

let content = fs.readFileSync(path, 'utf8');
if (content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
  console.log("Stripped UTF-8 BOM from migration.sql!");
} else {
  console.log("No BOM found.");
}

fs.writeFileSync(path, content, { encoding: 'utf8' });
console.log("migration.sql saved cleanly without BOM.");

