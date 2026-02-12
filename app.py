import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, request, render_template, jsonify
import requests

app = Flask(__name__)

RAPIDAPI_HOST = "whatsapp-osint4.p.rapidapi.com"
RAPIDAPI_KEY = os.environ["RAPIDAPI_KEY"]

def normalize_number(raw):
    cleaned = re.sub(r"[\s\+\-]", "", raw)
    if cleaned.startswith("351") and len(cleaned) == 12:
        return {"full": cleaned, "local": cleaned[3:], "is_pt": True}
    if len(cleaned) == 9:
        return {"full": "351" + cleaned, "local": cleaned, "is_pt": True}
    return {"full": cleaned, "local": cleaned, "is_pt": False}


def _fetch_ligaram(local_number):
    url = (
        f"https://www.ligaram-me.pt/wp-json/wp/v2/posts"
        f"?slug={local_number}&_fields=id,content,categories,class_list"
    )
    try:
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None

    if not data:
        return None

    post = data[0]
    html = post.get("content", {}).get("rendered", "")
    post_id = post.get("id")

    def extract(pattern, text):
        m = re.search(pattern, text)
        return m.group(1).strip() if m else None

    tipo = extract(r"<b>Tipo</b>:\s*([^<]+)</span>", html)
    atender = extract(r"<b>Devo Atender\?</b>\s*([^<]+)</span>", html)
    burla = extract(r"<b>Tentativa de Burla\?</b>\s*([^<]+)</span>", html)
    nome = extract(r"<b>Nome</b>:\s*([^<]+)</span>", html)
    trust_m = re.search(r"<span>(\d+)<sup>%</sup></span>", html)
    trust = int(trust_m.group(1)) if trust_m else None

    return {
        "post_id": post_id,
        "tipo": tipo,
        "atender": atender,
        "burla": burla,
        "nome": nome,
        "trust": trust,
    }


def _fetch_tellows(full_number):
    url = (
        f"https://www.tellows.de/basic/num/+{full_number}"
        f"?json=1&partner=androidapp&apikeyMd5=b5576989c85ba04eedbdd327d3a1835c"
        f"&country=pt&lang=pt"
    )
    try:
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None

    t = data.get("tellows", {})
    score_raw = t.get("score")
    score = int(score_raw) if score_raw else None

    caller_types_raw = t.get("callerTypes", {}).get("caller", [])
    caller_types = [c["name"] for c in caller_types_raw if isinstance(c, dict)]

    caller_names_raw = t.get("callerNames", {}).get("caller", [])
    caller_names = caller_names_raw if isinstance(caller_names_raw, list) else []

    return {
        "score": score,
        "searches": t.get("searches"),
        "comments": t.get("comments"),
        "location": t.get("location"),
        "caller_types": caller_types,
        "caller_names": caller_names,
    }


@app.route("/whocallsme")
def whocallsme():
    raw = request.args.get("number", "").strip()
    if not raw:
        return "Missing number parameter", 400

    num = normalize_number(raw)
    full_number = num["full"]
    local_number = num["local"]
    is_pt = num["is_pt"]

    ligaram_data = None
    tellows_data = None

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = {}
        if is_pt:
            futures["ligaram"] = executor.submit(_fetch_ligaram, local_number)
        futures["tellows"] = executor.submit(_fetch_tellows, full_number)

        for key, future in futures.items():
            try:
                result = future.result()
                if key == "ligaram":
                    ligaram_data = result
                elif key == "tellows":
                    tellows_data = result
            except Exception:
                pass

    post_id = ligaram_data["post_id"] if ligaram_data else None

    display_number = f"+{full_number[:3]} {full_number[3:6]} {full_number[6:9]} {full_number[9:]}" if is_pt else f"+{full_number}"

    return render_template(
        "result.html",
        display_number=display_number,
        full_number=full_number,
        post_id=post_id,
        ligaram=ligaram_data,
        tellows=tellows_data,
    )


@app.route("/api/comments")
def api_comments():
    post_id = request.args.get("post_id", "").strip()
    if not post_id:
        return jsonify([])

    url = (
        f"https://www.ligaram-me.pt/wp-json/wp/v2/comments"
        f"?post={post_id}&_fields=id,content,author_name,date"
    )
    try:
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        raw_comments = resp.json()
    except Exception:
        return jsonify({"error": "Erro ao carregar"}), 500

    comments = []
    for c in raw_comments:
        html = c.get("content", {}).get("rendered", "")
        text = re.sub(r"<[^>]+>", "", html).strip()
        text = re.sub(r"\s+", " ", text)
        comments.append({
            "author": c.get("author_name", ""),
            "date": c.get("date", "")[:10],
            "text": text,
        })

    return jsonify(comments)


@app.route("/api/whatsapp")
def api_whatsapp():
    full_number = request.args.get("number", "").strip()
    if not full_number:
        return jsonify({"error": "Missing number"}), 400

    url = f"https://{RAPIDAPI_HOST}/api/lookup?phone={full_number}"
    headers = {
        "x-rapidapi-host": RAPIDAPI_HOST,
        "x-rapidapi-key": RAPIDAPI_KEY,
    }
    try:
        resp = requests.get(url, headers=headers, timeout=5)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return jsonify({"error": "Erro ao carregar"}), 500

    return jsonify({
        "registered": data.get("registered"),
        "url": data.get("url", ""),
    })


if __name__ == "__main__":
    from waitress import serve
    serve(app, host="0.0.0.0", port=5000)
