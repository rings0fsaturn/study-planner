import os

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from py_progress import PRODUCTION_PRIOR_STRATEGY, production_calibrator

from app.middleware import request_context_middleware, request_id_from_request
from app.routers import calibration, progress, roadmap
from app.security import rate_limit_user, require_user

DEFAULT_CORS_ORIGINS = ["http://localhost:5173"]


def parse_cors_origins(value: str | None) -> list[str]:
    if value is None or value.strip() == "":
        return DEFAULT_CORS_ORIGINS

    origins = [origin.strip() for origin in value.split(",") if origin.strip()]
    return origins or DEFAULT_CORS_ORIGINS


app = FastAPI(
    title="Study Tracker Intelligence Service",
    description="Pillar A adaptation engines — calibration, progress, roadmap",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_cors_origins(os.getenv("CORS_ORIGINS")),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(request_context_middleware)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = request_id_from_request(request)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal server error",
            "code": "internal_error",
            "request_id": request_id,
        },
        headers={
            "X-Request-ID": request_id,
            "X-Model-Version": PRODUCTION_PRIOR_STRATEGY,
        },
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readiness")
def readiness() -> dict[str, str]:
    production_calibrator().fit_global([])
    return {"status": "ready", "model": PRODUCTION_PRIOR_STRATEGY}


_V1_DEPENDENCIES = [Depends(require_user), Depends(rate_limit_user)]

app.include_router(calibration.router, prefix="/v1", dependencies=_V1_DEPENDENCIES)
app.include_router(progress.router, prefix="/v1", dependencies=_V1_DEPENDENCIES)
app.include_router(roadmap.router, prefix="/v1", dependencies=_V1_DEPENDENCIES)
