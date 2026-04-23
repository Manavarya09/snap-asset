import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

/**
 * Detect the component framework from file extension and content.
 */
function detectFramework(filePath) {
  const ext = filePath.match(/\.(tsx?|jsx?|vue|svelte)$/)?.[1];

  if (ext === 'vue') return 'vue';
  if (ext === 'svelte') return 'svelte';
  if (['tsx', 'jsx'].includes(ext)) return 'react';
  if (ext === 'ts' || ext === 'js') {
    // Check file content for framework hints
    try {
      const content = readFileSync(filePath, 'utf-8');
      if (content.includes('from \'react\'') || content.includes('from "react"')) return 'react';
      if (content.includes('from \'vue\'') || content.includes('from "vue"')) return 'vue';
      if (content.includes('from \'svelte\'') || content.includes('from "svelte"')) return 'svelte';
    } catch {}
    return 'react'; // Default
  }
  return 'react';
}

/**
 * Generate the entry file content for the isolated render.
 */
function generateEntryFile(framework, componentPath, absComponentPath) {
  const relPath = absComponentPath.replace(/\\/g, '/');

  switch (framework) {
    case 'react':
      return `
import React from 'react';
import { createRoot } from 'react-dom/client';
import Component from '${relPath}';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <div style={{ display: 'inline-block' }}>
      <Component />
    </div>
  </React.StrictMode>
);
`;

    case 'vue':
      return `
import { createApp } from 'vue';
import Component from '${relPath}';

createApp(Component).mount('#root');
`;

    case 'svelte':
      return `
import Component from '${relPath}';

new Component({ target: document.getElementById('root') });
`;

    default:
      throw new Error(`Unsupported framework: ${framework}`);
  }
}

/**
 * Generate a minimal Vite config for the temp project.
 */
function generateViteConfig(framework, projectRoot) {
  let plugins = '';
  let pluginsList = '';

  if (framework === 'react') {
    plugins = `import react from '@vitejs/plugin-react';\n`;
    pluginsList = 'plugins: [react()],';
  } else if (framework === 'vue') {
    plugins = `import vue from '@vitejs/plugin-vue';\n`;
    pluginsList = 'plugins: [vue()],';
  } else if (framework === 'svelte') {
    plugins = `import { svelte } from '@sveltejs/vite-plugin-svelte';\n`;
    pluginsList = 'plugins: [svelte()],';
  }

  return `
${plugins}import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  ${pluginsList}
  resolve: {
    alias: {
      '@': resolve('${projectRoot.replace(/\\/g, '/')}', 'src'),
    },
  },
  server: {
    port: 0,  // Auto-assign port
  },
});
`;
}


/**
 * Render a component in isolation using a temporary Vite project.
 * Returns { url, cleanup } where url is the dev server URL.
 */
export async function renderComponent(componentPath, options = {}) {
  const { projectRoot = process.cwd() } = options;
  const absComponentPath = resolve(projectRoot, componentPath);

  if (!existsSync(absComponentPath)) {
    throw new Error(`Component not found: ${absComponentPath}`);
  }

  const framework = detectFramework(absComponentPath);
  const tempDir = mkdtempSync(join(tmpdir(), 'snap-asset-'));

  try {
    // Create minimal HTML
    writeFileSync(join(tempDir, 'index.html'), `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>snap-asset render</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: transparent; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.${framework === 'react' ? 'tsx' : 'js'}"></script>
</body>
</html>
`);

    // Create entry file
    const entryContent = generateEntryFile(framework, componentPath, absComponentPath);
    const entryExt = framework === 'react' ? 'tsx' : 'js';
    writeFileSync(join(tempDir, `main.${entryExt}`), entryContent);

    // Create vite config
    writeFileSync(join(tempDir, 'vite.config.js'), generateViteConfig(framework, projectRoot));

    // Symlink node_modules from project root
    const nodeModulesPath = join(projectRoot, 'node_modules');
    if (existsSync(nodeModulesPath)) {
      const { symlinkSync } = await import('fs');
      try {
        symlinkSync(nodeModulesPath, join(tempDir, 'node_modules'), 'junction');
      } catch {
        // Fallback: copy approach would be too slow, just skip
      }
    }

    // Start Vite dev server
    let viteProcess;
    try {
      viteProcess = spawn('npx', ['vite', '--host', '0.0.0.0'], {
        cwd: tempDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'development' },
      });

      // Wait for the server URL
      const url = await new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => {
          reject(new Error('Vite dev server timed out'));
        }, 30000);

        viteProcess.stdout.on('data', (data) => {
          output += data.toString();
          const match = output.match(/Local:\s+(https?:\/\/[^\s]+)/);
          if (match) {
            clearTimeout(timeout);
            resolve(match[1]);
          }
        });

        viteProcess.stderr.on('data', (data) => {
          output += data.toString();
        });

        viteProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      const cleanup = () => {
        try {
          viteProcess.kill('SIGTERM');
        } catch {}
        try {
          rmSync(tempDir, { recursive: true, force: true });
        } catch {}
      };

      return { url, cleanup };
    } catch (err) {
      // Ensure vite process is killed if it was started
      if (viteProcess) {
        try { viteProcess.kill('SIGTERM'); } catch {}
      }
      throw err;
    }
  } catch (err) {
    // Always clean up the temp directory, even on error
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    throw err;
  }
}
