import fs from 'node:fs/promises';
import path from 'node:path';

export class FileStore {
  async ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async writeJson(filePath, data) {
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async readJson(filePath, fallback = {}) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  async writeText(filePath, content) {
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf8');
  }

  async readText(filePath, fallback = '') {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return fallback;
    }
  }

  async ensureText(filePath, content) {
    try {
      await fs.access(filePath);
    } catch {
      await this.writeText(filePath, content);
    }
  }
}
