import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createPasswordRecord } = require('../src/auth');

function ask(question) {
  const interfaceInstance = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => interfaceInstance.question(question, (answer) => {
    interfaceInstance.close();
    resolve(answer.trim());
  }));
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    let answer = '';
    process.stdout.write(question);
    input.setRawMode?.(true);
    input.resume();
    input.setEncoding('utf8');

    const finish = (error = null) => {
      input.setRawMode?.(false);
      input.pause();
      input.removeListener('data', onData);
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(answer);
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') return finish(new Error('输入已取消'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u0008' || character === '\u007f') {
          answer = answer.slice(0, -1);
        } else {
          answer += character;
        }
      }
    };

    input.on('data', onData);
  });
}

const outputFile = path.resolve(process.argv[2] || '.secrets/auth-config.json');
const users = {};

try {
  process.stdout.write('创建服务器专用认证配置。密码不会写入终端输出或 Git。\n');
  while (true) {
    const username = await ask('用户名（留空结束）：');
    if (!username) break;
    const password = await askHidden(`为 ${username} 输入密码：`);
    if (!password) throw new Error('密码不能为空');
    const confirmation = await askHidden('再次输入密码：');
    if (password !== confirmation) throw new Error('两次密码不一致');
    users[username] = await createPasswordRecord(password);
  }

  if (Object.keys(users).length === 0) throw new Error('至少需要一个用户');
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${JSON.stringify({
    sessionSecret: crypto.randomBytes(32).toString('base64url'),
    users,
  }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try { await fs.chmod(outputFile, 0o600); } catch { /* Windows may not expose POSIX modes. */ }
  console.log(`已写入 ${outputFile}。请确认该文件只存在于服务器 .secrets 目录。`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
