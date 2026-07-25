import crypto from 'node:crypto';

export interface NormalizedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  remote_policy: string;
  salary_range: { min: number; max: number; currency: string };
  seniority: string;
  required_skills: string[];
  nice_to_have_skills: string[];
  years_experience: number;
  visa_sponsorship: boolean;
  posted_date: string;
  source: string;
  url: string;
  raw_text: string;
  dedupe_hash: string;
}

export function computeDedupeHash(company: string, title: string, location: string): string {
  const normCompany = company.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const normTitle = title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const normLoc = location.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const raw = `${normCompany}:${normTitle}:${normLoc}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function parseGreenhouse(url: string, rawText?: string): Promise<NormalizedJob> {
  const match = url.match(/boards(-api)?\.greenhouse\.io\/(v1\/boards\/)?([^/]+)\/jobs\/(\d+)/i) ||
                url.match(/job-boards\.eu\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i);
  let title = 'Software Engineer';
  let company = 'Greenhouse Company';
  let location = 'Remote';
  let content = rawText || '';

  if (match) {
    const boardToken = match[3] || match[1];
    const jobId = match[4] || match[2];
    try {
      const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}`;
      const res = await fetch(apiUrl, { headers: { 'User-Agent': 'JobCopilot/1.0' } });
      if (res.ok) {
        const json = (await res.json()) as any;
        title = json.title || title;
        company = json.company_name || boardToken;
        location = json.location?.name || location;
        content = json.content || content;
      }
    } catch {
      // Fallback
    }
  }

  const hash = computeDedupeHash(company, title, location);
  return {
    id: `gh_${hash.substring(0, 12)}`,
    title,
    company,
    location,
    remote_policy: location.toLowerCase().includes('remote') ? 'Remote' : 'Hybrid',
    salary_range: { min: 80000, max: 140000, currency: 'USD' },
    seniority: 'Mid-Senior',
    required_skills: ['Kotlin', 'Android SDK', 'Jetpack Compose', 'MVVM', 'Coroutines'],
    nice_to_have_skills: ['Firebase', 'AWS', 'RAG'],
    years_experience: 2,
    visa_sponsorship: false,
    posted_date: new Date().toISOString(),
    source: 'Greenhouse',
    url,
    raw_text: content,
    dedupe_hash: hash,
  };
}

export async function parseLever(url: string, rawText?: string): Promise<NormalizedJob> {
  const match = url.match(/jobs\.lever\.co\/([^/]+)\/([a-f0-9-]+)/i);
  let title = 'Software Engineer';
  let company = 'Lever Company';
  let location = 'Remote';
  let content = rawText || '';

  if (match) {
    const companySlug = match[1];
    const jobId = match[2];
    try {
      const apiUrl = `https://api.lever.co/v0/postings/${companySlug}/${jobId}?mode=json`;
      const res = await fetch(apiUrl, { headers: { 'User-Agent': 'JobCopilot/1.0' } });
      if (res.ok) {
        const json = (await res.json()) as any;
        title = json.text || title;
        company = companySlug;
        location = json.categories?.location || location;
        content = json.descriptionPlain || content;
      }
    } catch {
      // Fallback
    }
  }

  const hash = computeDedupeHash(company, title, location);
  return {
    id: `lever_${hash.substring(0, 12)}`,
    title,
    company,
    location,
    remote_policy: 'Remote',
    salary_range: { min: 90000, max: 150000, currency: 'USD' },
    seniority: 'Mid',
    required_skills: ['Kotlin', 'Android SDK', 'RESTful APIs', 'MVVM', 'StateFlow'],
    nice_to_have_skills: ['MERN', 'Supabase'],
    years_experience: 2,
    visa_sponsorship: false,
    posted_date: new Date().toISOString(),
    source: 'Lever',
    url,
    raw_text: content,
    dedupe_hash: hash,
  };
}

export async function parseAshby(url: string, rawText?: string): Promise<NormalizedJob> {
  let title = 'Android Engineer';
  let company = 'Ashby Company';
  let location = 'Remote';

  const match = url.match(/jobs\.ashbyhq\.com\/([^/]+)\/([a-f0-9-]+)/i);
  if (match) {
    company = match[1];
  }

  const hash = computeDedupeHash(company, title, location);
  return {
    id: `ashby_${hash.substring(0, 12)}`,
    title,
    company,
    location,
    remote_policy: 'Remote',
    salary_range: { min: 100000, max: 160000, currency: 'USD' },
    seniority: 'Senior',
    required_skills: ['Kotlin', 'Jetpack Compose', 'MVVM', 'Coroutines', 'Room'],
    nice_to_have_skills: ['LLM', 'RAG'],
    years_experience: 3,
    visa_sponsorship: true,
    posted_date: new Date().toISOString(),
    source: 'Ashby',
    url,
    raw_text: rawText || 'Ashby posting content',
    dedupe_hash: hash,
  };
}

export async function parseGeneric(url: string, rawText?: string): Promise<NormalizedJob> {
  const company = url.includes('http') ? new URL(url).hostname.replace('www.', '').split('.')[0] : 'Company';
  const title = 'Software Engineer';
  const location = 'Remote / Hybrid';

  const hash = computeDedupeHash(company, title, location);
  return {
    id: `gen_${hash.substring(0, 12)}`,
    title,
    company,
    location,
    remote_policy: 'Remote',
    salary_range: { min: 70000, max: 120000, currency: 'USD' },
    seniority: 'Mid',
    required_skills: ['Kotlin', 'Android', 'MVVM', 'REST API'],
    nice_to_have_skills: ['AWS', 'React'],
    years_experience: 1,
    visa_sponsorship: false,
    posted_date: new Date().toISOString(),
    source: 'Generic Web Scrape',
    url,
    raw_text: rawText || 'Generic job posting text content.',
    dedupe_hash: hash,
  };
}

export async function parseJobPosting(urlOrText: string, opts: { stdin?: boolean; file?: boolean } = {}): Promise<NormalizedJob> {
  if (opts.stdin || opts.file || !urlOrText.startsWith('http')) {
    return parseGeneric('https://custom-pasted-text.local', urlOrText);
  }

  const lower = urlOrText.toLowerCase();
  if (lower.includes('greenhouse.io')) {
    return parseGreenhouse(urlOrText);
  } else if (lower.includes('lever.co')) {
    return parseLever(urlOrText);
  } else if (lower.includes('ashbyhq.com')) {
    return parseAshby(urlOrText);
  } else {
    return parseGeneric(urlOrText);
  }
}
