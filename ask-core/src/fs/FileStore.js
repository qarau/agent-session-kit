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

  async appendNdjson(filePath, record) {
    await this.ensureDir(path.dirname(filePath));
    await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8');
  }

  async appendLine(filePath, line) {
    await this.ensureDir(path.dirname(filePath));
    await fs.appendFile(filePath, `${line}\n`, 'utf8');
  }

  async readNdjson(filePath, fallback = []) {
    const raw = await this.readText(filePath, '');
    if (!raw.trim()) {
      return fallback;
    }
    return raw
      .split(/\r?\n/u)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => JSON.parse(line));
  }

  async readLines(filePath, fallback = []) {
    const raw = await this.readText(filePath, '');
    if (!raw.trim()) {
      return fallback;
    }
    return raw
      .split(/\r?\n/u)
      .map(line => line.trim())
      .filter(Boolean);
  }

  async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async ensureText(filePath, content) {
    try {
      await fs.access(filePath);
    } catch {
      await this.writeText(filePath, content);
    }
  }

  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore when file is absent.
    }
  }
}
