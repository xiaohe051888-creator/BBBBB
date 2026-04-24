from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
import httpx
import uvicorn
import os
import websockets

app = FastAPI()
client = httpx.AsyncClient()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    token = websocket.query_params.get("token", "")
    target_ws_url = "ws://127.0.0.1:8000/ws"
    if token:
        target_ws_url += f"?token={token}"

    try:
        async with websockets.connect(target_ws_url) as backend_ws:
            import asyncio
            async def forward_to_backend():
                try:
                    while True:
                        data = await websocket.receive_text()
                        await backend_ws.send(data)
                except websockets.exceptions.ConnectionClosed:
                    pass
                except WebSocketDisconnect:
                    pass

            async def forward_to_client():
                try:
                    while True:
                        data = await backend_ws.recv()
                        await websocket.send_text(data)
                except websockets.exceptions.ConnectionClosed:
                    pass
                except WebSocketDisconnect:
                    pass

            await asyncio.gather(
                forward_to_backend(),
                forward_to_client()
            )
    except Exception as e:
        print(f"WS Proxy Error: {e}")
        try:
            await websocket.close()
        except:
            pass

@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
async def proxy_api(request: Request, path: str):
    url = f"http://127.0.0.1:8000/api/{path}"
    query = request.url.query
    if query:
        url += f"?{query}"
        
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

app.mount("/_expo", StaticFiles(directory="/workspace/mobile/dist/_expo"), name="_expo")
app.mount("/assets", StaticFiles(directory="/workspace/mobile/dist/assets"), name="assets")

@app.get("/{path:path}")
async def serve_index(path: str):
    file_path = os.path.join("/workspace/mobile/dist", path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse("/workspace/mobile/dist/index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5173)
