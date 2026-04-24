from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import httpx
import uvicorn

app = FastAPI()
client = httpx.AsyncClient()

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
async def proxy(request: Request, path: str):
    if path.startswith("api/"):
        url = f"http://127.0.0.1:8000/{path}"
    else:
        url = f"http://127.0.0.1:5174/{path}"
        
    query = request.url.query
    if query:
        url += f"?{query}"
        
    # forward headers, but remove host
    headers = dict(request.headers)
    headers.pop("host", None)
    
    body = await request.body()
    
    response = await client.request(
        method=request.method,
        url=url,
        headers=headers,
        content=body,
        timeout=60.0
    )
    
    return StreamingResponse(
        response.aiter_bytes(),
        status_code=response.status_code,
        headers=dict(response.headers)
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5173)
