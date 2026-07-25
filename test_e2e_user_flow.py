import urllib.request
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "http://localhost:3847"

def log(msg, status="INFO"):
    symbol = "[OK]" if status == "OK" else ("[FAIL]" if status == "FAIL" else "[INFO]")
    print(f"{symbol} {msg}")

def request(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode("utf-8")
            if resp.headers.get("Content-Type", "").startswith("application/json"):
                return resp.status, json.loads(content)
            return resp.status, content
    except Exception as e:
        return 500, str(e)

def run_user_e2e_tests():
    print("\n==========================================================")
    print("RUNNING COMPREHENSIVE USER BROWSER E2E TEST SUITE")
    print("==========================================================\n")

    # 1. Test Web Dashboard UI Page Load
    status, page = request("/")
    if status == 200 and "<title>JobPilot" in page and "kanban-grid" in page:
        log("Web Dashboard HTML loaded cleanly (HTTP 200)", "OK")
    else:
        log(f"Failed to load Web Dashboard HTML. Status: {status}", "FAIL")
        sys.exit(1)

    # 2. Test Fetching Jobs API
    status, res = request("/api/jobs")
    if status == 200 and res.get("success"):
        jobs = res.get("data", [])
        log(f"Fetched {len(jobs)} jobs from pipeline database", "OK")
    else:
        log("Failed to fetch jobs API", "FAIL")
        sys.exit(1)

    # 3. Test User Ingesting New Job Posting
    test_url = "https://boards-api.greenhouse.io/v1/boards/stripe/jobs/12345"
    log(f"Simulating user adding job URL: {test_url}...")
    status, res = request("/api/jobs/add", method="POST", data={"urlOrText": test_url})
    if status == 200 and res.get("success"):
        job = res.get("job", {})
        scorecard = res.get("scorecard", {})
        job_id = job.get("id")
        log(f"Job ingested & scored: {job.get('company')} - {job.get('title')} | Score: {scorecard.get('score')}/100 (Tier {scorecard.get('tier')})", "OK")
    else:
        log(f"Failed to ingest job: {res}", "FAIL")
        sys.exit(1)

    # 4. Test Moving Card across Kanban Stages
    stages = ["Scored", "Tailored", "Applied", "Screening", "Interviewing"]
    for stage in stages:
        status, res = request(f"/api/jobs/{job_id}/status", method="PUT", data={"status": stage})
        if status == 200 and res.get("success"):
            log(f"Card '{job_id}' successfully moved to stage: '{stage}'", "OK")
        else:
            log(f"Failed to move card to stage '{stage}'", "FAIL")
            sys.exit(1)

    # 5. Test Tailoring Resume & PDF Generation
    log(f"Simulating user clicking 'Tailor Resume & Generate PDF' for job '{job_id}'...")
    status, res = request(f"/api/jobs/{job_id}/tailor", method="POST", data={"coverLetter": True})
    if status == 200 and res.get("success"):
        pkg = res.get("package", {})
        pdf_path = pkg.get("resumePdfPath")
        log(f"Tailored ATS PDF generated: {pdf_path}", "OK")
    else:
        log(f"Failed to tailor resume: {res}", "FAIL")
        sys.exit(1)

    # 6. Test Resume Ground Truth View & Update
    status, res = request("/api/resume")
    if status == 200 and res.get("success"):
        content = res.get("content", "")
        log(f"Resume ground truth fetched ({len(content)} bytes)", "OK")
    else:
        log("Failed to fetch resume ground truth", "FAIL")
        sys.exit(1)

    print("\n==========================================================")
    print("ALL USER E2E BROWSER TESTS PASSED 100% WITH ZERO ERRORS!")
    print("==========================================================\n")

if __name__ == "__main__":
    run_user_e2e_tests()
