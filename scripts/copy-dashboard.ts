/**
 * Copy dashboard static files from src/dashboard to dist/dashboard
 * This ensures HTML, CSS, JS, and JSON files are available in the build output
 */

import { cpSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const srcDir = join(projectRoot, 'src', 'dashboard');
const destDir = join(projectRoot, 'dist', 'dashboard');

function copyDashboard() {
    console.log('📁 Copying dashboard static files...');
    
    // Check if source exists
    if (!existsSync(srcDir)) {
        console.error(`❌ Source directory not found: ${srcDir}`);
        process.exit(1);
    }
    
    // Create destination if it doesn't exist
    if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
        console.log(`📂 Created: ${destDir}`);
    }
    
    // Copy all files recursively
    try {
        cpSync(srcDir, destDir, { 
            recursive: true,
            force: true
        });
        console.log(`✅ Copied: ${srcDir} → ${destDir}`);
    } catch (error) {
        console.error('❌ Copy failed:', error);
        process.exit(1);
    }
    
    // Verify key files exist
    const requiredFiles = [
        'index.html',
        'api-docs.html',
        'openapi.json',
        'css/dashboard.css',
        'js/app.js'
    ];
    
    let allExist = true;
    for (const file of requiredFiles) {
        const filePath = join(destDir, file);
        if (existsSync(filePath)) {
            console.log(`  ✓ ${file}`);
        } else {
            console.log(`  ✗ ${file} (missing)`);
            allExist = false;
        }
    }
    
    if (allExist) {
        console.log('\n✅ Dashboard files ready!');
        console.log(`   Access: http://localhost:3000/`);
        console.log(`   API Docs: http://localhost:3000/api-docs`);
    } else {
        console.warn('\n⚠️  Some files are missing');
    }
}

copyDashboard();
