import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

/**
 * @typedef {'react'|'vue'|'svelte'} Framework
 *
 * @typedef {Object} ComponentRenderOptions
 * @property {string} [projectRoot]
 *
 * @typedef {Object} ComponentRenderResult
 * @property {string} url
 * @property {() => void} cleanup
 */

/**
 * @param {string} filePath
 * @returns {Framework}
 */
function detectFramework(filePath) {
  const ext = filePath.match(/\.(tsx?|jsx?|vue|svelte)$/)?.[1];

  if (ext === 'vue') {
    return 'vue';
  }
  if (ext === 'svelte') {
    return 'svelte';
  }
  if (['tsx', 'jsx'].includes(ext)) {
    return 'react';
  }
  if (ext === 'ts' || ext === 'js') {
    try {
      const content = readFileSync(filePath, 'utf-8');
      if (content.includes("from 'react'") || content.includes('from "react"')) {
        return 'react';
      }
      if (content.includes("from 'vue'") || content.includes('from "vue"')) {
        return 'vue';
      }
      if (content.includes("from 'svelte'") || content.includes('from "svelte"')) {
        return 'svelte';
      }
    } catch {
      // If we can't read the file, default to react
    }
    return 'react';
  }
  return 'react';
}

/**
 * @param {Framework} framework
 * @param {string} componentPath
 * @param {string} absComponentPath
 * @returns {string}
 */
function generateEntryFile(framework, componentPath, absComponentPath) {
  const relPath = absComponentPath.replace(/\\/g, '/');

  switch (framework) {
    case 'react':
      return `
import React from 'react';
import { createRoot } from 'react-dom/client';
import ComponentMod from '${relPath}';

const Component = ComponentMod.default || ComponentMod;
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
import ComponentMod from '${relPath}';

const Component = ComponentMod.default || ComponentMod;
createApp(Component).mount('#root');
`;

    case 'svelte':
      return `
import ComponentMod from '${relPath}';

const Component = ComponentMod.default || ComponentMod;
new Component({ target: document.getElementById('root') });
`;

    default:
      throw new Error(`Unsupported framework: ${framework}`);
  }
}

/**
 * @param {Framework} framework
 * @param {string} projectRoot
 * @returns {string}
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
    port: 0,
  },
});
`;
}

/**
 * @param {string} componentPath
 * @param {ComponentRenderOptions} [options]
 * @returns {Promise<ComponentRenderResult>}
 */
export async function renderComponent(componentPath, options = {}) {
  const { projectRoot = process.cwd() } = options;
  const absComponentPath = resolve(projectRoot, componentPath);

  if (!existsSync(absComponentPath)) {
    throw new Error(`Component not found: ${absComponentPath}`);
  }
  if (!statSync(absComponentPath).isFile()) {
    throw new Error(`Component not found: ${absComponentPath}`);
  }

  const framework = detectFramework(absComponentPath);
  const tempDir = mkdtempSync(join(tmpdir(), 'snap-asset-'));

  try {
    writeFileSync(
      join(tempDir, 'index.html'),
      `
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
`,
    );

    const entryContent = generateEntryFile(framework, componentPath, absComponentPath);
    const entryExt = framework === 'react' ? 'tsx' : 'js';
    writeFileSync(join(tempDir, `main.${entryExt}`), entryContent);

    writeFileSync(join(tempDir, 'vite.config.js'), generateViteConfig(framework, projectRoot));

    const nodeModulesPath = join(projectRoot, 'node_modules');
    if (existsSync(nodeModulesPath)) {
      const { symlinkSync } = await import('fs');
      try {
        symlinkSync(nodeModulesPath, join(tempDir, 'node_modules'), 'junction');
      } catch {
        // Symlink best-effort
      }
    }

    let viteProcess;
    try {
      viteProcess = spawn('npx', ['vite', '--host', '0.0.0.0'], {
        cwd: tempDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'development' },
      });

      const url = await new Promise((resolvePromise, reject) => {
        let output = '';
        const timeout = setTimeout(() => {
          reject(new Error(`Vite dev server timed out after 30s. Output: ${output.slice(0, 500)}`));
        }, 30000);

        viteProcess.stdout.on('data', (data) => {
          output += data.toString();
          const match = output.match(/Local\s*:\s*(https?:\/\/[^\s]+)/);
          if (match) {
            clearTimeout(timeout);
            resolvePromise(match[1]);
          }
        });

        viteProcess.stderr.on('data', (data) => {
          output += data.toString();
        });

        viteProcess.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });

        viteProcess.on('exit', (code) => {
          clearTimeout(timeout);
          reject(new Error(`Vite process exited with code ${code}. Output: ${output.slice(0, 500)}`));
        });
      });

      const cleanup = () => {
        try {
          viteProcess.kill('SIGTERM');
        } catch {
          // Process may already be dead
        }
        try {
          rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // Temp dir may already be cleaned up
        }
      };

      return { url, cleanup };
    } catch (err) {
      if (viteProcess) {
        try {
          viteProcess.kill('SIGTERM');
        } catch {
          // Process may already be dead
        }
      }
      throw err;
    }
  } catch (err) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Temp dir may already be cleaned up
    }
    throw err;
  }
}
