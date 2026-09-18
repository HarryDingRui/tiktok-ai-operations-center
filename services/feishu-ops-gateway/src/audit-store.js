const fs = require('node:fs/promises');
const path = require('node:path');

function createAuditStore(filePath) {
  async function ensureDirectory() {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  async function append(record) {
    await ensureDirectory();
    await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
  }

  async function count() {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content.split(/\r?\n/).filter(Boolean).length;
    } catch (error) {
      if (error.code === 'ENOENT') return 0;
      throw error;
    }
  }

  async function isWritable() {
    try {
      await ensureDirectory();
      const handle = await fs.open(filePath, 'a', 0o600);
      await handle.close();
      return true;
    } catch (error) {
      return false;
    }
  }

  return { append, count, isWritable };
}

module.exports = { createAuditStore };
