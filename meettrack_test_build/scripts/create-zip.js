import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const rootDir = process.cwd();
const zip = new JSZip();

// Folders and files to exclude
const EXCLUDE_DIRS = new Set(['node_modules', '.git', '.vercel', 'dist', '.gemini']);
const EXCLUDE_FILES = new Set(['.DS_Store', 'Thumbs.db']);

function addDirectoryToZip(dirPath, zipFolder) {
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.has(item)) {
        const subFolder = zipFolder.folder(item);
        addDirectoryToZip(fullPath, subFolder);
      }
    } else {
      // Exclude existing zip files and system files
      if (!EXCLUDE_FILES.has(item) && !item.endsWith('.zip')) {
        const content = fs.readFileSync(fullPath);
        zipFolder.file(item, content);
      }
    }
  }
}

async function createZipArchive() {
  console.log('📦 Gathering updated project files for Vercel deployment zip...');
  addDirectoryToZip(rootDir, zip);

  console.log('⚡ Generating compressed zip buffer...');
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  // Target 1: In project directory
  const projectZipPath = path.join(rootDir, 'remix-meettrack-edtech.zip');
  fs.writeFileSync(projectZipPath, buffer);
  console.log(`✅ Project zip created: ${projectZipPath} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);

  // Target 2: In Downloads directory right next to the project folder for easy access
  const downloadsZipPath = path.join(rootDir, '..', 'remix-meettrack-edtech-vercel.zip');
  fs.writeFileSync(downloadsZipPath, buffer);
  console.log(`✅ Downloads zip created: ${downloadsZipPath}`);
}

createZipArchive().catch((err) => {
  console.error('❌ Failed to create zip:', err);
  process.exit(1);
});
