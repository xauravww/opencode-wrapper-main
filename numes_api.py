#!/usr/bin/env python3
"""
Numes API integration — free models.

Base URL: https://api.numes.ai/api/v1  (OpenAI-compatible)
Auth:     Bearer <API key>   (sk-numes-v1-...)

Usage:
    python3 numes_api.py list                     # list all free models
    python3 numes_api.py chat <model_id> "<text>"  # send a chat completion
"""

import json
import os
import sys
import urllib.request
import urllib.error

# Provide your key via the NUMES_API_KEY environment variable (or .env).
API_KEY = os.environ.get("NUMES_API_KEY", "")
BASE_URL = os.environ.get("NUMES_BASE_URL", "https://api.numes.ai/api/v1")


def request(path, payload=None):
    url = f"{BASE_URL}/{path}"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return {"error": json.loads(body)}
        except Exception:
            return {"error": body, "http": e.code}


def list_models():
    res = request("models")
    if isinstance(res, dict) and "error" in res:
        raise RuntimeError(res)
    # API may return a bare array or {"data": [...]}
    if isinstance(res, dict):
        res = res.get("data", [])
    return res


def free_models():
    models = list_models()
    free = []
    for m in models:
        try:
            prompt = float(m["pricing"]["prompt"])
            completion = float(m["pricing"]["completion"])
        except Exception:
            continue
        if prompt == 0 and completion == 0:
            free.append(m)
    return free


def chat(model, text):
    return request("chat/completions", {
        "model": model,
        "messages": [{"role": "user", "content": text}],
    })


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    cmd = sys.argv[1]

    if cmd == "list":
        for m in free_models():
            print(f"{m['id']:<60} | {m['name']:<35} | ctx {m['context_length']:>8} | max_out {m.get('maximum_output_length')}")
        print(f"\n{len(free_models())} free models")

    elif cmd == "chat":
        if len(sys.argv) < 4:
            print("usage: numes_api.py chat <model_id> \"<text>\"")
            return
        model, text = sys.argv[2], sys.argv[3]
        res = chat(model, text)
        if "choices" in res:
            print(res["choices"][0]["message"]["content"])
        else:
            print(json.dumps(res, indent=2))

    else:
        print(f"unknown command: {cmd}")


if __name__ == "__main__":
    main()
