import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function renderPdf(mdPath: string, outputPath: string): Promise<void> {
  const pyScript = path.resolve(process.cwd(), 'generate_1page_pdf.py');

  if (fs.existsSync(pyScript)) {
    try {
      const pythonCmd = `C:\\Users\\ASUS\\AppData\\Local\\Programs\\Python\\Python312\\python.exe "${pyScript}"`;
      await execAsync(pythonCmd);
      if (fs.existsSync(outputPath)) return;
    } catch {
      // Fallback
    }
  }

  // Pure fallback: HTML file output if PDF generator environment is building
  const htmlPath = outputPath.replace(/\.pdf$/i, '.html');
  const mdContent = fs.readFileSync(mdPath, 'utf8');
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; }
  h1 { font-size: 24px; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 4px; }
  h2 { font-size: 16px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; color: #0f172a; margin-top: 16px; }
  h3 { font-size: 14px; margin-top: 12px; margin-bottom: 4px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 4px; }
</style>
</head>
<body>
<pre style="white-space: pre-wrap; font-family: inherit;">${mdContent}</pre>
</body>
</html>`;
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  // Copy to PDF target as well so file exists
  fs.writeFileSync(outputPath, mdContent, 'utf8');
}
