import fs from 'fs/promises';
import path from 'path';
import { SandboxConfig } from './types';

const DEFAULT_CONFIG: SandboxConfig = {
  dockerImage: 'claude-code-sandbox:latest',
  detached: false,
  autoPush: true,
  autoCreatePR: true,
  allowedTools: ['*'], // All tools allowed in sandbox
  maxThinkingTokens: 100000,
  bashTimeout: 600000, // 10 minutes
};

export async function loadConfig(configPath: string): Promise<SandboxConfig> {
  try {
    const fullPath = path.resolve(configPath);
    const configContent = await fs.readFile(fullPath, 'utf-8');
    const userConfig = JSON.parse(configContent);
    
    // Merge with defaults
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
    };
  } catch (error) {
    // Config file not found or invalid, use defaults
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: SandboxConfig, configPath: string): Promise<void> {
  const fullPath = path.resolve(configPath);
  await fs.writeFile(fullPath, JSON.stringify(config, null, 2));
}