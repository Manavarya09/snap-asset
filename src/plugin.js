export class PluginManager {
  constructor() {
    this.plugins = [];
  }

  registerPlugin(plugin) {
    if (!plugin || !plugin.name) {
      throw new Error('Plugin must have a name');
    }
    this.plugins.push(plugin);
  }

  async applyHook(hookName, context) {
    let currentContext = { ...context };
    for (const plugin of this.plugins) {
      const hook = plugin.hooks && plugin.hooks[hookName];
      if (typeof hook === 'function') {
        currentContext = { ...currentContext, ...(await hook(currentContext)) };
      }
    }
    return currentContext;
  }
}
