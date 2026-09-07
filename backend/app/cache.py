# ================================================================
# FLY MY CART CRM - HIGH-PERFORMANCE IN-MEMORY TTL CACHE ENGINE (app/cache.py)
# ================================================================

import time
import threading
from typing import Any, Optional, Callable, Dict
from functools import wraps

class FastTTLCache:
    """
    Thread-safe, microsecond-latency In-Memory TTL Cache.
    Drastically reduces database query overhead for read-heavy operations
    (Settings, Dashboard Summaries, Permissions Matrix).
    """

    def __init__(self, default_ttl: int = 30):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self.default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._cache.get(key)
            if not entry:
                return None
            if time.time() > entry["expires_at"]:
                del self._cache[key]
                return None
            return entry["value"]

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        ttl = ttl if ttl is not None else self.default_ttl
        with self._lock:
            self._cache[key] = {
                "value": value,
                "expires_at": time.time() + ttl
            }

    def delete(self, key: str) -> None:
        with self._lock:
            if key in self._cache:
                del self._cache[key]

    def invalidate_prefix(self, prefix: str) -> int:
        """Invalidates all cached keys matching a specific namespace prefix."""
        with self._lock:
            keys_to_del = [k for k in self._cache if k.startswith(prefix)]
            for k in keys_to_del:
                del self._cache[k]
            return len(keys_to_del)

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

# Global cache instance
cache_engine = FastTTLCache(default_ttl=30)

def cached(key_prefix: str, ttl: int = 30):
    """
    Decorator for caching endpoint/function results with TTL.
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Compute cache key from arguments
            cache_key = f"{key_prefix}:{str(args)}:{str(kwargs)}"
            cached_val = cache_engine.get(cache_key)
            if cached_val is not None:
                return cached_val
            
            result = func(*args, **kwargs)
            cache_engine.set(cache_key, result, ttl=ttl)
            return result
        return wrapper
    return decorator
