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


class DisciplinaDetalhe:
    """Linha da tabela de conteúdo do edital"""
    def __init__(self, area: str, disciplina: str, num_questoes: int = 0,
                 peso: float = 1.0, pontuacao_max: float = 0.0):
        self.area = area
        self.disciplina = disciplina
        self.num_questoes = num_questoes
        self.peso = peso
        self.pontuacao_max = pontuacao_max

    def to_dict(self) -> dict:
        return {
            "area": self.area,
            "disciplina": self.disciplina,
            "num_questoes": self.num_questoes,
            "peso": self.peso,
            "pontuacao_max": self.pontuacao_max,
        }


class EditalInfo:
    """Informações extraídas do edital"""
    def __init__(self):
        self.concurso: Optional[str] = None
        self.banca: Optional[str] = None
        self.cargos: List[str] = []
        self.disciplinas: Dict[str, float] = {}  # {disciplina: pontuacao_max} para backwards compat
        self.disciplinas_detalhadas: List[DisciplinaDetalhe] = []  # tabela completa
        self.programa_por_cargo: Dict[str, List[str]] = {}  # {cargo: [topicos]}
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
            "disciplinas_detalhadas": [d.to_dict() for d in self.disciplinas_detalhadas],
            "programa_por_cargo": self.programa_por_cargo,
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
    
    async def analyze(self, text: str) -> EditalInfo:
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
                ai_info = await self._extract_with_ai(text)
                info.cargos = ai_info.get("cargos", [])
                info.requisitos = ai_info.get("requisitos", {})
                info.programa_por_cargo = ai_info.get("programa_por_cargo", {})

                # Processa tabela de disciplinas detalhada
                tabela = ai_info.get("disciplinas_tabela", [])
                if tabela:
                    for row in tabela:
                        if not isinstance(row, dict):
                            continue
                        disc = str(row.get("disciplina") or "").strip()
                        if not disc:
                            continue
                        area = str(row.get("area") or "Conhecimentos Gerais").strip()
                        try:
                            num_q = int(row.get("num_questoes") or 0)
                        except (ValueError, TypeError):
                            num_q = 0
                        try:
                            peso = float(row.get("peso") or 1.0)
                        except (ValueError, TypeError):
                            peso = 1.0
                        try:
                            pont = float(row.get("pontuacao_max") or num_q * peso)
                        except (ValueError, TypeError):
                            pont = num_q * peso

                        info.disciplinas_detalhadas.append(
                            DisciplinaDetalhe(area=area, disciplina=disc,
                                              num_questoes=num_q, peso=peso,
                                              pontuacao_max=pont)
                        )
                    # Constrói dicionário backwards-compat: {disciplina: pontuacao_max}
                    info.disciplinas = {d.disciplina: d.pontuacao_max for d in info.disciplinas_detalhadas}
                else:
                    # Fallback: campo legado
                    info.disciplinas = ai_info.get("disciplinas", {})

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
        # Envia mais texto para capturar tabelas que aparecem após a introdução
        sample = text[:32000]

        prompt = f"""
Você é um especialista em análise de editais de concursos públicos brasileiros.

Analise o edital abaixo e extraia as informações em JSON. Preste MUITA atenção à tabela de disciplinas.

REGRAS:
1. Para "disciplinas_tabela": encontre TODAS as tabelas com colunas de matérias/disciplinas.
   Nomes comuns das colunas: "Área de Conhecimento", "Disciplina", "Número de Questões", "Peso por Questão", "Pontuação Máxima"
   - "area": valor da coluna "Área de Conhecimento" (ex: "Conhecimentos Gerais", "Conhecimentos Específicos")
   - "disciplina": nome da matéria
   - "num_questoes": número de questões (inteiro)
   - "peso": peso por questão (número)
   - "pontuacao_max": pontuação máxima = num_questoes × peso

2. Para "programa_por_cargo": encontre o conteúdo programático específico de cada cargo.
   Procure seções como "CONTEÚDO PROGRAMÁTICO", "PROGRAMA", "EIXOS TEMÁTICOS".
   Liste os tópicos/assuntos específicos (ex: SQL, Banco de Dados, Redes).

3. Para "cargos": liste TODOS os cargos disponíveis com seus nomes completos.

EXEMPLO DE SAÍDA ESPERADA:
{{
  "concurso": "ALECE 2024",
  "banca": "CESPE/CEBRASPE",
  "cargos": ["Analista Legislativo - Tecnologia da Informação", "Técnico Legislativo"],
  "disciplinas_tabela": [
    {{"area": "Conhecimentos Gerais", "disciplina": "Língua Portuguesa", "num_questoes": 10, "peso": 1.0, "pontuacao_max": 10.0}},
    {{"area": "Conhecimentos Gerais", "disciplina": "Noções de Informática", "num_questoes": 5, "peso": 1.0, "pontuacao_max": 5.0}},
    {{"area": "Conhecimentos Gerais", "disciplina": "Legislação e Ética no Serviço Público", "num_questoes": 5, "peso": 1.0, "pontuacao_max": 5.0}},
    {{"area": "Conhecimentos Específicos", "disciplina": "Banco de Dados", "num_questoes": 15, "peso": 2.0, "pontuacao_max": 30.0}},
    {{"area": "Conhecimentos Específicos", "disciplina": "Engenharia de Software", "num_questoes": 10, "peso": 2.0, "pontuacao_max": 20.0}}
  ],
  "programa_por_cargo": {{
    "Analista Legislativo - Tecnologia da Informação": [
      "SQL e Banco de Dados Relacional", "PostgreSQL", "Modelo Entidade-Relacionamento",
      "Sistemas Operacionais Linux", "Redes de Computadores", "Segurança da Informação"
    ]
  }},
  "requisitos": {{
    "Analista Legislativo - Tecnologia da Informação": "Nível superior em Ciência da Computação ou áreas afins"
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


async def analyze_edital_file(file_path: str) -> EditalInfo:
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
    return await analyzer.analyze(text)
