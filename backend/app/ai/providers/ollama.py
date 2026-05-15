import json
from typing import Any

import httpx

from .base import AIProvider, ProviderConfig


class OllamaProvider(AIProvider):
    """Ollama local LLM provider."""

    def __init__(self, base_url: str, model: str, config: ProviderConfig | None = None):
        super().__init__(config or ProviderConfig(model=model))
        self._base_url = base_url.rstrip("/")

    @property
    def name(self) -> str:
        return f"ollama/{self.config.model}"

    def is_available(self) -> bool:
        try:
            resp = httpx.get(f"{self._base_url}/api/tags", timeout=3)
            return resp.status_code == 200
        except Exception:
            return False

    async def complete(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=self.config.timeout) as client:
            resp = await client.post(
                f"{self._base_url}/api/generate",
                json={
                    "model": self.config.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": self.config.temperature,
                        "num_predict": self.config.max_tokens,
                    },
                },
            )
            resp.raise_for_status()
            return resp.json()["response"]

    async def complete_json(self, prompt: str) -> Any:
        text = await self.complete(prompt)
        return json.loads(text)
