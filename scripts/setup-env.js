import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { platform } from 'os';

try {
    const currentPlatform = platform();
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    
    if (currentPlatform === 'win32') {
        // Windows
        execSync(`"${join(scriptDir, 'setup-env.bat')}"`, { stdio: 'inherit' });
    } else {
        // macOS/Linux
        execSync(`bash "${join(scriptDir, 'setup-env.sh')}"`, { stdio: 'inherit' });
    }
} catch (error) {
    console.error('Error running setup script:', error);
    process.exit(1);
}
