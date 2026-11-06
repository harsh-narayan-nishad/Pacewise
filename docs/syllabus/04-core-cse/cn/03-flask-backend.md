# Flask backend

**Computer networks · Flask backend.** Pacewise's API is written in Express. This page shows how the *same* networking ideas look in a Flask (Python) backend, so you can explain either one in an interview. Nothing here is built into Pacewise yet.

## Same architecture, different runtime
```text
Browser --HTTPS--> nginx (TLS, load balancing) --HTTP--> gunicorn (several worker processes) --> Flask app --> MongoDB
```
Flask does not listen on the network by itself in production. A **WSGI server** (gunicorn or uWSGI) accepts TCP connections and calls your Flask app once per request; nginx in front terminates TLS and spreads traffic.

## Express vs Flask, network by network
| Idea | Express | Flask |
|---|---|---|
| Routing | `router.post("/sync/ops", ...)` | `@bp.post("/sync/ops")` on a Blueprint |
| Parse JSON | `express.json()` middleware | `request.get_json()` |
| Status codes | `res.status(201).json(...)` | `return jsonify(...), 201` |
| CORS | `cors()` middleware | `flask-cors` (`CORS(app, origins=[...])`) answers the `OPTIONS` pre-flight |
| Security headers | `helmet` | `flask-talisman` |
| Rate limiting (429) | custom middleware + Redis | `flask-limiter` (storage: Redis) |
| Token check | `requireAuth` middleware | decorator, or `flask-jwt-extended` |
| Validation (422) | `zod` | `pydantic` or `marshmallow` |
| Streaming (SSE) | `res.write("data: ...")` | `Response(stream_with_context(gen()), mimetype="text/event-stream")` |
| Call another service | AWS SDK / driver | `requests` (HTTP) or `boto3` (S3) |

## Server-Sent Events in Flask
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
Every open stream holds one worker. With gunicorn's default *sync* workers a few streams use up all workers, so SSE needs `gthread` or `gevent` workers (or a separate async service). Node handles thousands of idle streams on one thread; this is the main networking difference.

## What stays identical
- HTTP verbs, status codes, headers, JSON bodies: the browser cannot tell which language answers.
- Stateless access tokens, refresh rotation, unique event ids for safe retries, `since=N` snapshots.
- The `nginx` config and the 2 MB body limit (`MAX_CONTENT_LENGTH` in Flask).

## Questions you can be asked
- What is WSGI and why is `flask run` not for production?
- How would you serve 5 000 idle SSE connections from Flask?
- Where do you terminate TLS and why there?
