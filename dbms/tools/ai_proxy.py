#!/usr/bin/env python3
"""Local helper for the book's "AI check my answer" buttons.

Run:  python3 tools/ai_proxy.py        (then reload any chapter; the buttons appear on exam questions)

It listens on 127.0.0.1:8765 only, reads API keys from the tabula-rasa .env (override with
DBMS_NOTES_ENV=/path/to/.env), and never logs keys or answers. Services:
  - TypeLLM  : extracts key points from a model answer (cached), reads photos of answers
  - ScaleDown: fallback photo reader
  - Amos     : marks the student's answer against each key point (free; keeps requests to
               improve its models, which the page tells the student before sending)
"""
import hashlib, json, os, sys, time, urllib.error, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8765
ENV = Path(os.environ.get("DBMS_NOTES_ENV", "~/Projects/ml-ai/tabula-rasa/.env")).expanduser()
CACHE = Path(__file__).with_name("ai-keypoints-cache.json")
AMOS = "https://api.amos.scira.ai/v1/systemone"
TYPELLM = "https://api.typellm.ai/v1/generate"
SCALEDOWN = "https://api.scaledown.xyz/v1/chat/completions"


def load_env():
    out = {}
    if ENV.exists():
        for line in ENV.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    return out


KEYS = load_env()


def post(url, body, headers=None, timeout=95, tries=4):
    """POST JSON; retries 429/503 honouring Retry-After."""
    data = json.dumps(body, ensure_ascii=False).encode()
    for n in range(tries):
        req = urllib.request.Request(url, data, {"Content-Type": "application/json", **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or n == tries - 1:
                raise RuntimeError(f"{url.split('/')[2]} answered HTTP {e.code}") from None
            time.sleep(min(float(e.headers.get("Retry-After") or 2 ** (n + 1)), 30))


def typellm(context, questions, images=None):
    key = KEYS.get("TYPELLM_API_KEY")
    if not key:
        raise RuntimeError("TYPELLM_API_KEY is missing from the .env")
    body = {"context": context, "questions": questions, "options": {"temperature": 0}, "timeout": 80}
    if images:
        body["images"] = images
    return post(TYPELLM, body, {"Authorization": "Bearer " + key})["result"]


# ---- 1. key points of a model answer (cached by content hash) ----
def keypoints(question, model_answer):
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    h = hashlib.sha256((question + "\n---\n" + model_answer).encode()).hexdigest()[:24]
    if h in cache:
        return cache[h]
    res = typellm(
        f"Exam question:\n{question}\n\nModel answer:\n{model_answer[:12000]}",
        {"points": {"type": "array", "minItems": 2, "maxItems": 8, "items": {"type": "string"},
                    "instructions": "List the separate key points a marker would look for in a full-mark answer, "
                                    "most important first. Each point is one short, self-contained claim in plain words "
                                    "(include the specific value, name or rule the answer must contain). No duplicates."}})
    pts = [p.strip() for p in res.get("points") or [] if p and p.strip()][:8]
    cache[h] = pts
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1))
    return pts


# ---- 2. read a photographed answer ----
def read_photo(question, image_data_uri):
    try:
        r = typellm(f"Exam question: {question}\nThe attached photo is a student's handwritten answer to it.",
                    {"transcript": {"type": "string", "instructions": "Transcribe the student's handwritten answer exactly, "
                                    "word for word. If a part is unreadable write [unreadable]."},
                     "legible": {"type": "boolean", "return_probabilities": True,
                                 "instructions": "Is the handwriting in the photo legible enough to grade?"}},
                    [image_data_uri])
        leg = r.get("legible") or {}
        p = (leg.get("probabilities") or {}).get("true", 1.0 if leg.get("value") else 0.0)
        return {"transcript": r.get("transcript") or "", "legible": p, "reader": "TypeLLM"}
    except RuntimeError:
        key = KEYS.get("SCALEDOWN_API_KEY")
        if not key:
            raise
        mime, b64 = image_data_uri.split(",", 1)[0][5:].split(";")[0], image_data_uri.split(",", 1)[1]
        resp = post(SCALEDOWN, {"model": "extract-1", "messages": [{"role": "user", "content": "Transcribe the handwritten answer."}],
                                "response_format": {"type": "json_schema", "json_schema": {"name": "answer", "schema": {
                                    "type": "object", "properties": {"answer_text": {"type": "string",
                                                                                     "description": "the full handwritten answer text"}}}}},
                                "document": b64, "document_mime_type": mime}, {"x-api-key": key})
        content = json.loads(resp["choices"][0]["message"]["content"])
        ent = next((e for e in content.get("entities") or [] if e.get("type") == "answer_text"), {})
        return {"transcript": ent.get("text") or "", "legible": ent.get("confidence") or 0.0, "reader": "ScaleDown"}


# ---- 3. mark an answer against the key points (Amos, System One API) ----
LEVELS = ["No credit: wrong, irrelevant or blank", "Little: one minor idea", "Partial: some key points, major gaps",
          "Good: most key points, minor gaps", "Full: all key points, correct"]


def mark(question, model_answer, points, student, max_marks):
    qs = {f"kp_{i}": {"type": "choice",
                      "instructions": f'Key point: "{p}". How does the `student_answer` relate to this key point? '
                                      "Judge meaning, not wording; ignore spelling and notation differences.",
                      "criteria": {"established": "The student states this point or something equivalent, correctly",
                                   "partial": "The student gestures at it but leaves out an essential part or is vague",
                                   "contradicted": "The student states something incompatible with this point",
                                   "absent": "The student does not address this point"}}
          for i, p in enumerate(points)}
    qs["on_topic"] = {"type": "noul", "instructions": "The `student_answer` is a genuine attempt to answer the `question`."}
    qs["error"] = {"type": "noul", "instructions": "The `student_answer` contains a factual error when compared with the `model_answer`."}
    qs["overall"] = {"type": "score", "criteria": LEVELS,
                     "instructions": "Compared with the `model_answer`, how well does the `student_answer` answer the `question`?"}
    ans = post(AMOS, {"model": "amos-1-medium", "questions": qs,
                      "state": {"question": question, "model_answer": model_answer[:12000], "student_answer": student}})["answers"]
    out, total = [], 0.0
    for i, p in enumerate(points):
        pr = (ans.get(f"kp_{i}") or {}).get("probabilities") or {}
        est, par, con = pr.get("established", 0), pr.get("partial", 0), pr.get("contradicted", 0)
        credit = est + 0.5 * par
        total += credit
        status = ("contradicted" if con >= 0.5 else "established" if est >= 0.7
                  else "missing" if est + par <= 0.3 else "partial")
        out.append({"point": p, "status": status, "credit": round(credit, 3)})
    frac = total / len(points) if points else 0.0
    on_topic = (ans.get("on_topic") or {}).get("noul", 1.0)
    if on_topic < 0.3:
        frac = 0.0
    ov = ans.get("overall") or {}
    unsure = abs((ov.get("score", 0) / 4) - frac) > 0.35 or (ov.get("confidence") or 1) < 0.5
    return {"points": out, "fraction": round(frac, 3), "mark": round(max_marks * frac * 2) / 2 if max_marks else None,
            "max": max_marks, "on_topic": on_topic, "error": (ans.get("error") or {}).get("noul", 0.0),
            "overall": ov.get("score"), "unsure": unsure}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):   # never log request bodies
        pass

    def _send(self, code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")   # chapters are opened from file:// (Origin: null)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True, "typellm": bool(KEYS.get("TYPELLM_API_KEY")),
                                    "scaledown": bool(KEYS.get("SCALEDOWN_API_KEY")), "amos": True})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n > 12_000_000:
                return self._send(413, {"error": "The photo is too large. Use one under 8 MB."})
            body = json.loads(self.rfile.read(n) or b"{}")
            q, model = str(body.get("question", ""))[:6000], str(body.get("model_answer", ""))
            if self.path == "/keypoints":
                return self._send(200, {"points": keypoints(q, model)})
            if self.path == "/read":
                img = str(body.get("image", ""))
                if not img.startswith("data:image/"):
                    return self._send(400, {"error": "Send the photo as an image."})
                return self._send(200, read_photo(q, img))
            if self.path == "/mark":
                student = str(body.get("answer", "")).strip()
                if len(student) < 3:
                    return self._send(400, {"error": "Write your answer first."})
                pts = body.get("points") or keypoints(q, model)
                return self._send(200, mark(q, model, pts, student[:8000], body.get("max_marks")))
            self._send(404, {"error": "not found"})
        except RuntimeError as e:
            self._send(502, {"error": str(e)})
        except Exception as e:   # malformed input or an unexpected service reply
            self._send(500, {"error": f"{type(e).__name__}: {e}"[:300]})


if __name__ == "__main__":
    if not ENV.exists():
        print(f"Note: {ENV} not found; only Amos (no key) will work. Set DBMS_NOTES_ENV to your .env.", file=sys.stderr)
    print(f"AI helper running on http://127.0.0.1:{PORT}  (Ctrl+C to stop). Reload a chapter to see the AI buttons.")
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
