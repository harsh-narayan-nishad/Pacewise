# Flask backend

**OOPs · Flask backend।** Pacewise का API Express है। यह page दिखाता है कि वही object-oriented design Flask (Python) में कैसा दिखता है। इसमें से अभी कुछ भी Pacewise में बना हुआ नहीं है।

## Application factory के साथ Project layout
```text
app/
  __init__.py        create_app()      # builds the app, wires extensions (the composition root)
  extensions.py      mongo client, limiter, cors
  errors.py          AppError and subclasses + one error handler
  auth/              routes.py (Blueprint)  service.py  schemas.py
  sync/              routes.py  service.py  policy.py   # policy is pure functions
  tracking/          routes.py  service.py  consistency.py
```
`create_app()` **factory pattern** है और composition root का Flask रूप है: tests इसे test config और नकली database के साथ call करते हैं।

## Python में pillars
```python
class AppError(Exception):
    status = 500; code = "INTERNAL"
    def __init__(self, message): super().__init__(message); self.message = message

class NotFoundError(AppError):  status = 404; code = "NOT_FOUND"      # inheritance
class ForbiddenError(AppError): status = 403; code = "FORBIDDEN"

@app.errorhandler(AppError)                                            # polymorphism: one handler
def handle(err): return jsonify(error={"code": err.code, "message": err.message}), err.status
```
- **Encapsulation**: service class अपना database handle private रखती है (`self._db`) और `apply_ops(user_id, ops)` जैसे methods expose करती है।
- **Abstraction**: `Repository` base class (या `typing.Protocol`) `get`, `put`, `delete` तय करती है; एक implementation MongoDB इस्तेमाल करता है, दूसरा tests के लिए dict।
- **Polymorphism**: service ऐसा कोई भी object स्वीकार करती है जिसमें ये methods हों (duck typing)।

## Patterns
| Pattern | Flask रूप |
|---|---|
| Chain of responsibility | `before_request` hooks, decorators (`@auth_required`, `@limiter.limit`) |
| Decorator | Python decorators किसी view को auth, rate limit या logging से wrap करते हैं |
| Strategy | Rate-limit storage configuration से Redis या memory चुनता है |
| Factory | `create_app(config)` |
| Singleton | `MongoClient`, जो हर worker process में एक बार बनाया जाता है |
| Dependency injection | Global import करने की जगह repository को service के constructor में पास करें |

## Python की ख़ास बातें जो जानना ज़रूरी है
- **Duck typing**: "अगर methods हैं तो चलेगा"; contract को document करने के लिए `Protocol` या abstract base classes (`abc.ABC`) इस्तेमाल करें।
- **Dataclasses और Pydantic models** request और record के shapes बताते हैं; validation errors 422 responses बन जाते हैं।
- **Dunder methods** (`__init__`, `__repr__`, `__eq__`) वे तरीके हैं जिनसे classes भाषा में जुड़ती हैं।
- Pure functions (`authorize`, `compute_consistency`) `pytest` से बिना database के test होते हैं, बिल्कुल मौजूदा `node:test` suite की तरह।

## आपसे पूछे जा सकने वाले सवाल
- Application factory क्या है और इसे क्यों इस्तेमाल करें?
- Duck typing बनाम abstract base classes?
- Decorators का middleware से क्या संबंध है?
- Global database import करने की जगह repository को inject क्यों करें?
