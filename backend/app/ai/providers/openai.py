import json
from typing import Any

import httpx

from .base import AIProvider, ProviderConfig


class OpenAIProvider(AIProvider):
    """OpenAI API provider (gpt-4o-mini by default)."""

    BASE_URL = "https://api.openai.com/v1/chat/completions"

    def __init__(self, api_key: str, config: ProviderConfig | None = None):
        super().__init__(config or ProviderConfig(model="gpt-4o-mini"))
        self._api_key = api_key

    @property
    def name(self) -> str:
        return f"openai/{self.config.model}"

    def is_available(self) -> bool:
        return bool(self._api_key)

    async def complete(self, prompt: str) -> str:
        response = await self._request(prompt)
        return response["choices"][0]["message"]["content"]

    async def complete_json(self, prompt: str) -> Any:
        text = await self.complete(prompt)
        # Remove blocos de markdown que o modelo pode incluir (```json ... ```)
        stripped = text.strip()
        if stripped.startswith("```"):
            first_newline = stripped.find("\n")
            last_fence = stripped.rfind("```")
            if first_newline != -1 and last_fence > first_newline:
                stripped = stripped[first_newline + 1:last_fence].strip()
        return json.loads(stripped)

    async def _request(self, prompt: str) -> dict:
        async with httpx.AsyncClient(timeout=self.config.timeout) as client:
            resp = await client.post(
                self.BASE_URL,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.config.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": self.config.temperature,
                    "max_tokens": self.config.max_tokens,
                },
            )
            resp.raise_for_status()
            return resp.json()
