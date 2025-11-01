from fastapi import FastAPI

app = FastAPI(
    openapi_url=None
)

@app.get("/api/hello")
async def say_hello(name: str = "World"):
    return {
        "message": f"Hello, {name}!"
    }
