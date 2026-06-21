import requests
import json

url = 'http://localhost:8000/analyze-json'
print(f"--- Sending POST to {url} ---")
data = {
    'job_description': 'Looking for a Software Engineer.',
    'resumes': [
        {
            'candidate_name': 'Jane Doe',
            'resume_text': 'Jane Doe\njane.doe.debug@gmail.com\nSoftware Engineer with 10 years of experience.'
        }
    ]
}

response = requests.post(url, json=data)

print('Status Code:', response.status_code)

if response.status_code == 200:
    res_json = response.json()
    candidates = res_json.get('ranked_candidates', [])
    for c in candidates:
        print(f"Candidate Name: {c.get('candidate_name')}")
        print(f"Candidate Email from API: {c.get('candidate_email')}")
        
    print("\n--- Testing History API Endpoint ---")
    analysis_id = res_json.get('analysis_id')
    hist_url = f"http://localhost:8000/analyses/{analysis_id}"
    print(f"Fetching {hist_url}")
    hist_res = requests.get(hist_url)
    if hist_res.status_code == 200:
        hist_json = hist_res.json()
        for c in hist_json:
            print(f"History Candidate Name: {c.get('candidate_name')}")
            print(f"History Candidate Email from API: {c.get('candidate_email')}")
    else:
        print("History Error:", hist_res.text)
else:
    print('Upload Error Response:', response.text)
