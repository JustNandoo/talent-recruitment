import { spawn } from 'node:child_process';

// Launch the user's default browser after the HTTP server has actually started.
// No shell interpolation, and headless cloud machines skip automatic launch.
export function browserCommand(url, platform = process.platform) {
  if (platform === 'win32') return { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] };
  if (platform === 'darwin') return { command: 'open', args: [url] };
  return { command: 'xdg-open', args: [url] };
}

export function openBrowser(url) {
  const { command, args } = browserCommand(url);
  try {
    const child = spawn(command, args, { shell: false, detached: true, stdio: 'ignore' });
    child.on('error', () => console.log('Browser tidak terbuka otomatis. Masukkan alamat web di atas pada browser Anda.'));
    child.unref();
  } catch {
    console.log('Browser tidak terbuka otomatis. Masukkan alamat web di atas pada browser Anda.');
  }
}
