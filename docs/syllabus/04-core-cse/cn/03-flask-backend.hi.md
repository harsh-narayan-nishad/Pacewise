# Flask backend

**Computer networks · Flask backend।** Pacewise की API Express में लिखी है। यह page दिखाता है कि वही networking विचार Flask (Python) backend में कैसे दिखते हैं, ताकि आप interview में दोनों में से किसी को भी समझा सकें। यहाँ की कोई चीज़ अभी Pacewise में बनी नहीं है।

## वही architecture, अलग runtime
```text
Browser --HTTPS--> nginx (TLS, load balancing) --HTTP--> gunicorn (several worker processes) --> Flask app --> MongoDB
```
Production में Flask खुद network पर नहीं सुनता। एक **WSGI server** (gunicorn या uWSGI) TCP connections स्वीकार करता है और हर request पर आपके Flask app को एक बार call करता है; आगे बैठा nginx TLS को समाप्त करता है और traffic बाँटता है।

## Express बनाम Flask, network दर network
| विचार | Express | Flask |
|---|---|---|
| Routing | `router.post("/sync/ops", ...)` | Blueprint पर `@bp.post("/sync/ops")` |
| JSON parse करना | `express.json()` middleware | `request.get_json()` |
| Status codes | `res.status(201).json(...)` | `return jsonify(...), 201` |
| CORS | `cors()` middleware | `flask-cors` (`CORS(app, origins=[...])`) जो `OPTIONS` pre-flight का जवाब देता है |
| Security headers | `helmet` | `flask-talisman` |
| Rate limiting (429) | custom middleware + Redis | `flask-limiter` (storage: Redis) |
| Token check | `requireAuth` middleware | decorator, या `flask-jwt-extended` |
| Validation (422) | `zod` | `pydantic` या `marshmallow` |
| Streaming (SSE) | `res.write("data: ...")` | `Response(stream_with_context(gen()), mimetype="text/event-stream")` |
| दूसरी service को call करना | AWS SDK / driver | `requests` (HTTP) या `boto3` (S3) |

## Flask में Server-Sent Events
```python
@bp.get("/notifications/stream")
@auth_required
def stream():
    def events():
        for note in subscribe(g.user_id):      # blocks until a notification arrives
            yield f"event: notification\ndata: {json.dumps(note)}\n\n"
    return Response(stream_with_context(events()), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
```
हर खुली stream एक worker को पकड़े रखती है। gunicorn के default *sync* workers के साथ कुछ streams सारे workers खत्म कर देती हैं, इसलिए SSE को `gthread` या `gevent` workers (या अलग async service) की ज़रूरत होती है। Node एक thread पर हज़ारों idle streams संभाल लेता है; यही मुख्य networking अंतर है।

## जो एक जैसा रहता है
- HTTP verbs, status codes, headers, JSON bodies: browser नहीं बता सकता कि कौन-सी भाषा जवाब दे रही है।
- Stateless access tokens, refresh rotation, सुरक्षित retries के लिए unique event ids, `since=N` snapshots।
- `nginx` config और 2 MB की body limit (Flask में `MAX_CONTENT_LENGTH`)।

## आपसे पूछे जा सकने वाले सवाल
- WSGI क्या है और `flask run` production के लिए क्यों नहीं है?
- Flask से 5 000 idle SSE connections कैसे serve करेंगे?
- TLS कहाँ समाप्त करते हैं और वहीं क्यों?
