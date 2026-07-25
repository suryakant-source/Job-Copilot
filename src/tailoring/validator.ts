import fs from 'node:fs';
import path from 'node:path';

export interface ValidationResult {
  isValid: boolean;
  unverifiedClaims: string[];
  auditedBulletsCount: number;
}

export function validateTruthfulness(tailoredText: string, originalResumePath = './resume.md'): ValidationResult {
  const resolvedPath = path.resolve(process.cwd(), originalResumePath);
  let originalText = '';
  if (fs.existsSync(resolvedPath)) {
    originalText = fs.readFileSync(resolvedPath, 'utf8').toLowerCase();
  }

  const unverifiedClaims: string[] = [];
  const lines = tailoredText.split('\n');
  let auditedBulletsCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      auditedBulletsCount++;
      const bullet = trimmed.substring(2).toLowerCase();

      // Extract key metrics (percentages, numbers, CGPA)
      const metrics = bullet.match(/\b\d+(?:\.\d+)?%?\b/g);
      if (metrics) {
        for (const metric of metrics) {
          if (!originalText.includes(metric) && metric !== '1' && metric !== '2' && metric !== '3' && metric !== '100') {
            unverifiedClaims.push(`Metric '${metric}' in bullet: "${trimmed}" not found in ground truth resume.`);
          }
        }
      }

      // Check key employer names if mentioned
      const employers = ['ingenious tech', 'silicon university', 'delhi public school'];
      for (const emp of employers) {
        if (bullet.includes(emp) && !originalText.includes(emp)) {
          unverifiedClaims.push(`Employer '${emp}' not found in original resume.`);
        }
      }
    }
  }

  return {
    isValid: unverifiedClaims.length === 0,
    unverifiedClaims,
    auditedBulletsCount,
  };
}
