# Quickstart: AI Tool Layer Architecture

## Testing the Tool Layer Manually

You can test the tool registry directly through the NestJS REPL or by hitting the `POST /ai/intent` endpoint once the gateway is connected.

### Example Request (Simulated)
```json
POST /ai/intent
{
  "query": "Get the latest RFA for project A",
  "context": {
    "type": "project",
    "publicId": "019505a1-7c3e-7000-8000-abc123def456"
  }
}
```

### Expected Response
If user is authorized:
```json
{
  "intent": "GET_RFA",
  "confidence": 0.95,
  "result": {
    "ok": true,
    "data": [
      {
        "publicId": "019505a1-8d2b-7000-8000-112233445566",
        "rfaNumber": "RFA-001",
        "statusCode": "PENDING",
        ...
      }
    ]
  }
}
```

If user is unauthorized:
```json
{
  "intent": "GET_RFA",
  "confidence": 0.95,
  "result": {
    "ok": false,
    "reason": "FORBIDDEN",
    "message": "ไม่มีสิทธิ์เข้าถึง RFA"
  }
}
```
