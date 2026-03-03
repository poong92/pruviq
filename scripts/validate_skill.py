#!/usr/bin/env python3
import os
import re

SKILL_DIR = os.path.join(os.path.dirname(__file__), '..', 'skills')
required = ['name', 'description', 'responsibilities', 'when_to_use', 'outputs', 'constraints', 'no_hallucination', 'language']

results = []
for fname in os.listdir(SKILL_DIR):
    if not fname.endswith('.md'):
        continue
    path = os.path.join(SKILL_DIR, fname)
    text = open(path, 'r', encoding='utf8').read()
    missing = []
    for key in required:
        if re.search(rf'^.*{re.escape(key)}.*$', text, re.IGNORECASE | re.MULTILINE) is None:
            missing.append(key)
    results.append({'file': fname, 'missing': missing})

ok = all(len(r['missing'])==0 for r in results)
print('SKILL VALIDATION RESULT')
for r in results:
    print(f"- {r['file']}: missing -> {r['missing']}")
print('\nSUMMARY:')
print('ALL_OK' if ok else 'ISSUES_FOUND')
if not ok:
    exit(1)
