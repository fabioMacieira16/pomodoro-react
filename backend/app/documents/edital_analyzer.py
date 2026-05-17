"""
Edital Analyzer - Análise Inteligente de Editais de Concursos

Extrai automaticamente:
- Nome do concurso
- Banca organizadora
- Cargos disponíveis (múltiplos)
- Disciplinas e pesos
- Data da prova
- Requisitos
"""
import re
import asyncio
from datetime import datetime
from typing import Optional, List, Dict
from pathlib import Path

from app.ai.factory import get_provider


class EditalInfo:
    """Informações extraídas do edital"""
    def __init__(self):
        self.concurso: Optional[str] = None
        self.banca: Optional[str] = None
        self.cargos: List[str] = []
        self.disciplinas: Dict[str, float] = {}  # {disciplina: peso}
        self.data_prova: Optional[datetime] = None
        self.orgao: Optional[str] = None
        self.vagas: Optional[int] = None
        self.salario: Optional[str] = None
        self.requisitos: Dict[str, str] = {}  # {cargo: requisito}
        
    def to_dict(self) -> dict:
        return {
            "concurso": self.concurso,
            "banca": self.banca,
            "cargos": self.cargos,
            "disciplinas": self.disciplinas,
            "data_prova": self.data_prova.isoformat() if self.data_prova else None,
            "orgao": self.orgao,
            "vagas": self.vagas,
            "salario": self.salario,
            "requisitos": self.requisitos,
        }


class EditalAnalyzer:
    """Analisador inteligente de editais"""
    
    # Bancas conhecidas
    BANCAS = [
        "CESPE", "CEBRASPE", "FCC", "VUNESP", "FGV", "CESGRANRIO", 
        "FUNDATEC", "AOCP", "IDECAN", "IBFC", "QUADRIX", "IADES",
        "INSTITUTO AOCP", "FUNCAB", "CONSULPLAN", "FADESP", "CETAP"
    ]
    
    # Padrões comuns
    PADRAO_DATA = r"(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})"
    PADRAO_SALARIO = r"R\$\s*[\d.,]+"
    
    def __init__(self):
        self.provider = get_provider()
    
    def analyze(self, text: str) -> EditalInfo:
        """Análise completa do edital"""
        info = EditalInfo()
        
        # Extração com regex (rápido)
        info.banca = self._extract_banca(text)
        info.concurso = self._extract_concurso(text)
        info.data_prova = self._extract_data_prova(text)
        info.salario = self._extract_salario(text)
        info.vagas = self._extract_vagas(text)
        info.orgao = self._extract_orgao(text)
        
        # Extração com IA (mais preciso)
        if self.provider.is_available():
            try:
                ai_info = asyncio.run(self._extract_with_ai(text))
                info.cargos = ai_info.get("cargos", [])
                info.disciplinas = ai_info.get("disciplinas", {})
                info.requisitos = ai_info.get("requisitos", {})
                
                # IA pode corrigir detecções por regex
                if ai_info.get("concurso") and len(ai_info["concurso"]) > 3:
                    info.concurso = ai_info["concurso"]
                if ai_info.get("banca"):
                    info.banca = ai_info["banca"]
            except Exception as e:
                print(f"[EditalAnalyzer] AI extraction failed: {e}")
        
        return info
    
    def _extract_banca(self, text: str) -> Optional[str]:
        """Detecta a banca organizadora"""
        text_upper = text.upper()
        
        for banca in self.BANCAS:
            if banca in text_upper:
                return banca
        
        # Padrões adicionais
        patterns = [
            r"BANCA\s*ORGANIZADORA[:\s]+([A-Z\s]+)",
            r"REALIZAÇÃO[:\s]+([A-Z\s]+)",
            r"EXECUTORA[:\s]+([A-Z\s]+)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text_upper)
            if match:
                banca = match.group(1).strip()
                if len(banca) < 30:  # evita capturar parágrafo inteiro
                    return banca
        
        return None
    
    def _extract_concurso(self, text: str) -> Optional[str]:
        """Detecta nome do concurso"""
        patterns = [
            r"CONCURSO\s+PÚBLICO\s+([A-Z\s\-/]+)(?:\d{4}|\n)",
            r"EDITAL\s+(?:N[º°]\s*)?[\d/]+\s*[-–]\s*([A-Z\s\-/]+)",
            r"PREFEITURA\s+(?:MUNICIPAL\s+)?DE\s+([A-ZÀ-Ú\s]+)",
            r"GOVERNO\s+DO\s+ESTADO\s+(?:DE|DO)\s+([A-Z\s]+)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text[:5000])  # primeiras páginas
            if match:
                nome = match.group(1).strip()
                if 5 <= len(nome) <= 80:
                    return nome
        
        return None
    
    def _extract_cargos(self, text: str) -> List[str]:
        """Detecta cargos disponíveis (básico, IA é melhor)"""
        cargos = []
        patterns = [
            r"CARGO[:\s]+([A-ZÀ-Ú\s]+)",
            r"FUNÇÃO[:\s]+([A-ZÀ-Ú\s]+)",
            r"VAGA(?:S)?\s+PARA[:\s]+([A-ZÀ-Ú\s]+)",
        ]
        
        for pattern in patterns:
            for match in re.finditer(pattern, text[:10000]):
                cargo = match.group(1).strip()
                if 5 <= len(cargo) <= 60 and cargo not in cargos:
                    cargos.append(cargo)
        
        return cargos[:20]  # limita a 20 cargos
    
    def _extract_data_prova(self, text: str) -> Optional[datetime]:
        """Detecta data da prova"""
        patterns = [
            r"DATA\s+DA\s+PROVA[:\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})",
            r"PROVA[:\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})",
            r"APLICA(?:C|Ç)(?:A|Ã)O[:\s]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    return self._parse_date(match.group(1))
                except Exception:
                    pass
        
        # Busca genérica por datas (última metade do ano geralmente é prova)
        dates = re.findall(self.PADRAO_DATA, text)
        for d, m, y in dates:
            try:
                date = self._parse_date(f"{d}/{m}/{y}")
                if date and date.year >= datetime.now().year and date.month >= 6:
                    return date
            except Exception:
                pass
        
        return None
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Converte string para datetime"""
        for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%d/%m/%y"]:
            try:
                return datetime.strptime(date_str, fmt)
            except Exception:
                pass
        return None
    
    def _extract_salario(self, text: str) -> Optional[str]:
        """Detecta salário"""
        patterns = [
            r"REMUNERAÇÃO[:\s]+(R\$\s*[\d.,]+)",
            r"VENCIMENTO[:\s]+(R\$\s*[\d.,]+)",
            r"SALÁRIO[:\s]+(R\$\s*[\d.,]+)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        
        return None
    
    def _extract_vagas(self, text: str) -> Optional[int]:
        """Detecta número de vagas"""
        patterns = [
            r"(?:TOTAL\s+DE\s+)?VAGAS[:\s]+(\d+)",
            r"(\d+)\s+VAGAS?",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    return int(match.group(1))
                except Exception:
                    pass
        
        return None
    
    def _extract_orgao(self, text: str) -> Optional[str]:
        """Detecta órgão/instituição"""
        patterns = [
            r"PREFEITURA\s+(?:MUNICIPAL\s+)?DE\s+([A-ZÀ-Ú\s-]+)",
            r"GOVERNO\s+DO\s+ESTADO\s+(?:DE|DO)\s+([A-Z]+)",
            r"TRIBUNAL\s+(?:DE\s+)?([A-ZÀ-Ú\s]+)",
            r"SECRETARIA\s+(?:DE\s+)?([A-ZÀ-Ú\s]+)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text[:3000])
            if match:
                orgao = match.group(1).strip()
                if 3 <= len(orgao) <= 60:
                    return orgao
        
        return None
    
    async def _extract_with_ai(self, text: str) -> dict:
        """Extração inteligente com IA"""
        sample = text[:24000]  # primeiras ~10 páginas
        
        prompt = f"""
Você é um especialista em análise de editais de concursos públicos.

Analise o edital abaixo e extraia as seguintes informações em formato JSON:

1. concurso: nome completo do concurso
2. banca: banca organizadora
3. cargos: lista de TODOS os cargos disponíveis
4. disciplinas: objeto com disciplinas e seus pesos (1-5, onde 5 é mais importante)
5. requisitos: objeto mapeando cada cargo para seus requisitos de formação

Exemplo de resposta:
{{
  "concurso": "SEFAZ-CE 2024",
  "banca": "CESPE",
  "cargos": ["Auditor Fiscal", "Analista de TI", "Fiscal de Tributos"],
  "disciplinas": {{
    "Português": 4,
    "Direito Constitucional": 5,
    "Direito Tributário": 5,
    "Contabilidade": 4,
    "Informática": 3
  }},
  "requisitos": {{
    "Auditor Fiscal": "Nível superior em qualquer área",
    "Analista de TI": "Nível superior em Ciência da Computação ou áreas afins"
  }}
}}

EDITAL:
{sample}

Retorne APENAS o JSON válido, sem comentários ou texto adicional.
"""
        
        try:
            result = await self.provider.complete_json(prompt)
            return result if isinstance(result, dict) else {}
        except Exception as e:
            print(f"[EditalAnalyzer] AI extraction error: {e}")
            return {}


def analyze_edital_file(file_path: str) -> EditalInfo:
    """Função helper para analisar arquivo de edital"""
    from pathlib import Path
    
    # Extrair texto do PDF
    path = Path(file_path)
    text = ""
    
    try:
        import fitz
        doc = fitz.open(str(path))
        for page in doc:
            text += page.get_text("text") + "\n"
        doc.close()
    except Exception:
        try:
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            for page in reader.pages:
                text += (page.extract_text() or "") + "\n"
        except Exception as e:
            print(f"Erro ao ler PDF: {e}")
            return EditalInfo()
    
    # Analisar
    analyzer = EditalAnalyzer()
    return analyzer.analyze(text)
