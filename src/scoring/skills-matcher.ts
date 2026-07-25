export interface SkillMatchResult {
  matched: string[];
  missing: string[];
  adjacent: string[];
  score: number;
}

const SYNONYMS: Record<string, string[]> = {
  kotlin: ['kotlin', 'kt'],
  kubernetes: ['k8s', 'kubernetes', 'kube'],
  react: ['react', 'reactjs', 'react.js'],
  node: ['node', 'nodejs', 'node.js', 'express', 'express.js'],
  android: ['android', 'android sdk', 'android studio', 'jetpack compose'],
  mvvm: ['mvvm', 'clean architecture', 'repository pattern', 'viewmodel'],
  aws: ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'cloudformation'],
  rag: ['rag', 'retrieval-augmented generation', 'vector embeddings', 'groq', 'llm'],
  python: ['python', 'py'],
  java: ['java', 'j2ee'],
  sql: ['sql', 'sqlite', 'postgres', 'postgresql', 'mongodb'],
};

export function matchSkills(resumeSkills: string[], requiredSkills: string[]): SkillMatchResult {
  const normResume = resumeSkills.map((s) => s.toLowerCase().trim());
  const matched: string[] = [];
  const missing: string[] = [];
  const adjacent: string[] = [];

  for (const req of requiredSkills) {
    const normReq = req.toLowerCase().trim();
    let isMatch = false;

    // Check exact or partial string match
    if (normResume.some((r) => r.includes(normReq) || normReq.includes(r))) {
      matched.push(req);
      isMatch = true;
      continue;
    }

    // Check synonyms
    for (const [key, syns] of Object.entries(SYNONYMS)) {
      if (syns.some((syn) => normReq.includes(syn))) {
        if (normResume.some((res) => syns.some((syn2) => res.includes(syn2)))) {
          matched.push(req);
          isMatch = true;
          break;
        }
      }
    }

    if (!isMatch) {
      missing.push(req);
    }
  }

  const score = requiredSkills.length > 0 ? (matched.length / requiredSkills.length) * 100 : 85;
  return { matched, missing, adjacent, score: Math.round(score) };
}
