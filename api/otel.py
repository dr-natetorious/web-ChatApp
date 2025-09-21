from fastapi import APIRouter, Request, HTTPException, Header
from typing import Optional, Dict, Any, List
import logging
from datetime import datetime
import os
import json
import asyncio

logger = logging.getLogger(__name__)
otel_router = APIRouter()

# --- OpenTelemetry SDK wiring (required) ---
try:
    from opentelemetry import trace, metrics
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.trace import SpanKind, Status, StatusCode
except Exception as e:
    logger.error("OpenTelemetry SDK is required by api/otel but is not available: %s", e)
    raise ImportError("OpenTelemetry SDK is required by api/otel") from e

# Ensure providers exist (no-op if app configured providers at startup)
tp = trace.get_tracer_provider()
if tp is None:
    trace.set_tracer_provider(TracerProvider())

mp = metrics.get_meter_provider()
if mp is None:
    metrics.set_meter_provider(MeterProvider())

_tracer = trace.get_tracer(__name__)
_meter = metrics.get_meter(__name__)


# Expected top-level keys for OTLP HTTP JSON
_EXPECTED_KEY = {"traces": "resourceSpans", "metrics": "resourceMetrics", "logs": "resourceLogs"}

# Cache instruments to avoid recreating on every request
_instruments: Dict[str, Any] = {}
_instruments_lock = asyncio.Lock()


async def _get_counter(name: str):
    if _meter is None:
        raise RuntimeError("OpenTelemetry Meter is not configured")
    async with _instruments_lock:
        inst = _instruments.get(name)
        if inst is not None:
            return inst
        try:
            inst = _meter.create_counter(name)
        except Exception:
            inst = None
        _instruments[name] = inst
        return inst


async def _get_histogram(name: str):
    if _meter is None:
        raise RuntimeError("OpenTelemetry Meter is not configured")
    async with _instruments_lock:
        inst = _instruments.get(name)
        if inst is not None:
            return inst
        try:
            inst = _meter.create_histogram(name)
        except Exception:
            inst = None
        _instruments[name] = inst
        return inst


def _attrs_list_to_dict(attrs_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    if not isinstance(attrs_list, list):
        return out
    for a in attrs_list:
        k = a.get("key")
        v = a.get("value", {}) or {}
        if not k:
            continue
        if isinstance(v, dict):
            if "stringValue" in v:
                out[k] = v["stringValue"]
            elif "asDouble" in v:
                out[k] = v["asDouble"]
            elif "asInt" in v:
                out[k] = v["asInt"]
            else:
                # pick first available value
                vals = list(v.values())
                out[k] = vals[0] if vals else None
        else:
            out[k] = v
    return out


async def _process_resource_spans(resource_spans: List[Dict[str, Any]]):
    if _tracer is None:
        # Hard failure: the router depends on the OpenTelemetry SDK being present
        raise HTTPException(status_code=500, detail="OpenTelemetry Tracer not configured")

    emitted = 0
    for res in resource_spans:
        resource_attrs = _attrs_list_to_dict(res.get("resource", {}).get("attributes", []))
        for scope in res.get("scopeSpans", []):
            for span in scope.get("spans", []):
                name = span.get("name", "span")
                attrs = _attrs_list_to_dict(span.get("attributes", []))
                merged_attrs = {**resource_attrs, **attrs}
                try:
                    with _tracer.start_as_current_span(name, kind=SpanKind.INTERNAL) as sdk_span:
                        for k, v in merged_attrs.items():
                            try:
                                sdk_span.set_attribute(k, v)
                            except Exception:
                                sdk_span.set_attribute(k, str(v))
                        status = span.get("status", {})
                        if status:
                            code = status.get("code")
                            if code == 2 or str(code).lower() == "error":
                                try:
                                    sdk_span.set_status(Status(StatusCode.ERROR))
                                except Exception:
                                    pass
                    emitted += 1
                except Exception as e:
                    logger.exception("Failed to emit span %s: %s", name, e)
    return {"emitted": emitted}


async def _process_resource_metrics(resource_metrics: List[Dict[str, Any]]):
    if _meter is None:
        # Hard failure: the router depends on the OpenTelemetry SDK being present
        raise HTTPException(status_code=500, detail="OpenTelemetry Meter not configured")

    emitted = 0
    for res in resource_metrics:
        resource_attrs = _attrs_list_to_dict(res.get("resource", {}).get("attributes", []))
        for scope in res.get("scopeMetrics", []):
            for metric in scope.get("metrics", []):
                name = metric.get("name", "metric")
                if "gauge" in metric:
                    dps = metric["gauge"].get("dataPoints", [])
                    hist = await _get_histogram(name)
                    for dp in dps:
                        val = dp.get("asDouble") or dp.get("asInt") or dp.get("value") or 0
                        labels = _attrs_list_to_dict(dp.get("attributes", []))
                        labels = {**resource_attrs, **labels}
                        try:
                            if hist:
                                hist.record(float(val or 0), labels)
                            else:
                                ctr = await _get_counter(name)
                                if ctr:
                                    ctr.add(float(val or 0), labels)
                        except Exception as e:
                            logger.debug("Metric emit error (gauge) %s: %s", name, e)
                        emitted += 1
                elif "sum" in metric:
                    dps = metric["sum"].get("dataPoints", [])
                    ctr = await _get_counter(name)
                    for dp in dps:
                        val = dp.get("asDouble") or dp.get("asInt") or dp.get("value") or 0
                        labels = _attrs_list_to_dict(dp.get("attributes", []))
                        labels = {**resource_attrs, **labels}
                        try:
                            if ctr:
                                ctr.add(float(val or 0), labels)
                        except Exception as e:
                            logger.debug("Metric emit error (sum) %s: %s", name, e)
                        emitted += 1
                else:
                    dps = metric.get("dataPoints", []) or metric.get("values", [])
                    ctr = await _get_counter(name)
                    for dp in dps:
                        val = dp.get("asDouble") or dp.get("asInt") or dp.get("value") or 0
                        labels = _attrs_list_to_dict(dp.get("attributes", []))
                        labels = {**resource_attrs, **labels}
                        try:
                            if ctr:
                                ctr.add(float(val or 0), labels)
                        except Exception as e:
                            logger.debug("Metric emit error (fallback) %s: %s", name, e)
                        emitted += 1
    return {"emitted": emitted}


async def _process_resource_logs(resource_logs: List[Dict[str, Any]]):
    emitted = 0
    for res in resource_logs:
        resource_attrs = _attrs_list_to_dict(res.get("resource", {}).get("attributes", []))
        for scope in res.get("scopeLogs", []):
            for record in scope.get("logRecords", []):
                body = record.get("body", {}).get("stringValue") or record.get("body") or ""
                severity = record.get("severityText", "INFO").upper()
                attrs = _attrs_list_to_dict(record.get("attributes", []))
                merged = {**resource_attrs, **attrs}
                logger_name = merged.pop("logger", "app")
                app_logger = logging.getLogger(logger_name)
                level = getattr(logging, severity, logging.INFO)
                try:
                    msg = body if not merged else f"{body} | attrs={merged}"
                    app_logger.log(level, msg)
                except Exception as e:
                    logger.debug("Failed to emit log record: %s", e)
                emitted += 1
    return {"emitted": emitted}


async def handle_otel_data(signal_type: str, request: Request, x_forwarded_for: Optional[str]):
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="invalid JSON")

    expected = _EXPECTED_KEY.get(signal_type)
    if not isinstance(payload, dict) or expected not in payload:
        raise HTTPException(status_code=400, detail=f"expected OTLP payload with top-level '{expected}' for {signal_type}")

    logger.info("Received %s from %s", signal_type, x_forwarded_for or "unknown")

    if signal_type == "traces":
        result = await _process_resource_spans(payload[expected])
    elif signal_type == "metrics":
        result = await _process_resource_metrics(payload[expected])
    else:
        result = await _process_resource_logs(payload[expected])

    return {"status": "accepted", "signal": signal_type, "result": result, "timestamp": datetime.utcnow().isoformat()}


@otel_router.post("/v1/traces")
async def receive_traces(request: Request, x_forwarded_for: Optional[str] = Header(None)):
    return await handle_otel_data("traces", request, x_forwarded_for)


@otel_router.post("/v1/metrics")
async def receive_metrics(request: Request, x_forwarded_for: Optional[str] = Header(None)):
    return await handle_otel_data("metrics", request, x_forwarded_for)


@otel_router.post("/v1/logs")
async def receive_logs(request: Request, x_forwarded_for: Optional[str] = Header(None)):
    return await handle_otel_data("logs", request, x_forwarded_for)

async def cleanup():
    """No-op cleanup; SDK lifecycle should be handled by app startup/shutdown if needed."""
    return
