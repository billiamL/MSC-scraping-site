import fs from 'fs';
import path from 'path';

export function getHtmlFileContent() {
  const filePath = path.join(process.cwd(), 'src/app/components/index.html');
  return fs.readFileSync(filePath, 'utf8');
}
