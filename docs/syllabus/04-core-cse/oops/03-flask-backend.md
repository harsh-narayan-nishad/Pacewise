# Flask backend

**OOPs · Flask backend.** Pacewise's API is Express. This page shows how the same object-oriented design looks in Flask (Python). Nothing here is built into Pacewise yet.

## Project layout with an application factory
```text
app/
  __init__.py        create_app()      # builds the app, wires extensions (the composition root)
  extensions.py      mongo client, limiter, cors
  errors.py          AppError and subclasses + one error handler
  auth/              routes.py (Blueprint)  service.py  schemas.py
  sync/              routes.py  service.py  policy.py   # policy is pure functions
  tracking/          routes.py  service.py  consistency.py
```
`create_app()` is the **factory pattern** and the Flask version of a composition root: tests call it with a test config and a fake database.

## The pillars in Python
```python
class AppError(Exception):
    status = 500; code = "INTERNAL"
    def __init__(self, message): super().__init__(message); self.message = message

class NotFoundError(AppError):  status = 404; code = "NOT_FOUND"      # inheritance
class ForbiddenError(AppError): status = 403; code = "FORBIDDEN"

@app.errorhandler(AppError)                                            # polymorphism: one handler
def handle(err): return jsonify(error={"code": err.code, "message": err.message}), err.status
```
- **Encapsulation**: a service class keeps its database handle private (`self._db`) and exposes methods such as `apply_ops(user_id, ops)`.
- **Abstraction**: a `Repository` base class (or `typing.Protocol`) defines `get`, `put`, `delete`; one implementation uses MongoDB, another a dict for tests.
- **Polymorphism**: the service accepts any object with those methods (duck typing).

## Patterns
| Pattern | Flask form |
|---|---|
| Chain of responsibility | `before_request` hooks, decorators (`@auth_required`, `@limiter.limit`) |
| Decorator | Python decorators wrap a view with auth, rate limit or logging |
| Strategy | Rate-limit storage picks Redis or memory from configuration |
| Factory | `create_app(config)` |
| Singleton | The `MongoClient`, created once per worker process |
| Dependency injection | Pass the repository into the service constructor instead of importing a global |

## Python specifics worth knowing
- **Duck typing**: "if it has the methods it works"; use `Protocol` or abstract base classes (`abc.ABC`) to document the contract.
- **Dataclasses and Pydantic models** describe request and record shapes; validation errors become 422 responses.
- **Dunder methods** (`__init__`, `__repr__`, `__eq__`) are how classes plug into the language.
- Pure functions (`authorize`, `compute_consistency`) are tested with `pytest` without a database, same as the current `node:test` suite.

## Questions you can be asked
- What is the application factory and why use it?
- Duck typing versus abstract base classes?
- How do decorators relate to middleware?
- Why inject the repository instead of importing a global database?
