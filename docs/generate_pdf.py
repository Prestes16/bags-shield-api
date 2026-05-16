# -*- coding: utf-8 -*-
"""
Bags Shield Protocol v3.0 - Gerador de PDF Profissional
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics import renderPDF

# Cores do design system Bags Shield
BG = HexColor("#080811")
BG1 = HexColor("#0D0D1A")
CYAN = HexColor("#4DD4FF")
PURPLE = HexColor("#9945FF")
GREEN = HexColor("#00D68F")
RED = HexColor("#FF3B5C")
AMBER = HexColor("#FFB340")
TXT = HexColor("#F0F0FF")
TXT2 = HexColor("#8888AA")
TXT3 = HexColor("#666677")

# Dimensões
PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 2*cm


def create_cover_page():
    """Cria a capa do documento"""
    elements = []
    
    # Espaço no topo
    elements.append(Spacer(1, 4*cm))
    
    # Emoji escudo centralizado
    shield_style = ParagraphStyle(
        'Shield',
        fontSize=80,
        textColor=CYAN,
        alignment=TA_CENTER,
        spaceAfter=10,
        leading=90
    )
    elements.append(Paragraph("🛡️", shield_style))
    
    # Nome BagsShield
    title_style = ParagraphStyle(
        'Title',
        fontSize=32,
        fontName='Helvetica-Bold',
        textColor=CYAN,
        alignment=TA_CENTER,
        spaceAfter=8,
        leading=38
    )
    elements.append(Paragraph("BagsShield", title_style))
    
    # Subtítulo
    subtitle_style = ParagraphStyle(
        'Subtitle',
        fontSize=13,
        textColor=HexColor("#8888AA"),
        alignment=TA_CENTER,
        spaceAfter=30,
        leading=16
    )
    elements.append(Paragraph("Proteja seus tokens antes de investir", subtitle_style))
    
    # Linha decorativa
    elements.append(Spacer(1, 1*cm))
    elements.append(HRFlowable(width="60%", thickness=2, color=CYAN, hAlign="CENTER"))
    elements.append(Spacer(1, 1*cm))
    
    # Título principal
    main_title = ParagraphStyle(
        'MainTitle',
        fontSize=26,
        fontName='Helvetica-Bold',
        textColor=white,
        alignment=TA_CENTER,
        spaceAfter=15,
        leading=32
    )
    elements.append(Paragraph("Bags Shield Protocol", main_title))
    
    # Subtítulo do documento
    doc_subtitle = ParagraphStyle(
        'DocSubtitle',
        fontSize=14,
        textColor=HexColor("#AAAAAA"),
        alignment=TA_CENTER,
        spaceAfter=40,
        leading=18
    )
    elements.append(Paragraph("Documento Técnico e Plano de Implantação v3.0", doc_subtitle))
    
    # Badges
    badge_data = [
        ["ZK-Proof Scanner", "AI Predictive Shield", "On-Chain Registry"]
    ]
    badge_table = Table(badge_data, colWidths=[5*cm, 5*cm, 5*cm])
    badge_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 0), (0, 0), CYAN),
        ('TEXTCOLOR', (1, 0), (1, 0), PURPLE),
        ('TEXTCOLOR', (2, 0), (2, 0), GREEN),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(badge_table)
    
    elements.append(Spacer(1, 3*cm))
    
    # Meta informações
    meta_style = ParagraphStyle(
        'Meta',
        fontSize=11,
        textColor=HexColor("#8888AA"),
        alignment=TA_CENTER,
        leading=16
    )
    elements.append(Paragraph("Solana Blockchain Security Infrastructure", meta_style))
    elements.append(Paragraph("Maio 2026", meta_style))
    elements.append(Paragraph("Confidencial — Uso Interno", meta_style))
    
    return elements


def create_header_footer(canvas, doc):
    """Adiciona header e footer em cada página"""
    canvas.saveState()
    
    # Header
    canvas.setFillColor(CYAN)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(MARGIN, PAGE_HEIGHT - 1.5*cm, "Bags Shield Protocol v3.0")
    
    canvas.setStrokeColor(HexColor("#333344"))
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, PAGE_HEIGHT - 2*cm, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 2*cm)
    
    # Footer
    canvas.setFillColor(HexColor("#8888AA"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(MARGIN, 1*cm, "Confidencial — BagsShield 2026")
    
    # Número da página
    page_num = canvas.getPageNumber()
    canvas.drawRightString(PAGE_WIDTH - MARGIN, 1*cm, f"Página {page_num}")
    
    canvas.restoreState()


def main():
    output_path = "C:\\Dev\\bags-shield-api\\docs\\Bags-Shield-Protocol-v3-Documento-Tecnico.pdf"
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        topMargin=3*cm,
        bottomMargin=2*cm,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        title="Bags Shield Protocol v3.0",
        author="BagsShield Team"
    )
    
    # Estilos
    styles = getSampleStyleSheet()
    
    heading1 = ParagraphStyle(
        'Heading1',
        parent=styles['Heading1'],
        fontSize=20,
        fontName='Helvetica-Bold',
        textColor=CYAN,
        spaceAfter=20,
        spaceBefore=20,
        leading=24
    )
    
    heading2 = ParagraphStyle(
        'Heading2',
        parent=styles['Heading2'],
        fontSize=14,
        fontName='Helvetica-Bold',
        textColor=PURPLE,
        spaceAfter=12,
        spaceBefore=16,
        leading=18
    )
    
    body_text = ParagraphStyle(
        'BodyText',
        parent=styles['BodyText'],
        fontSize=10,
        textColor=HexColor("#CCCCDD"),
        alignment=TA_JUSTIFY,
        spaceAfter=10,
        leading=14
    )
    
    # Construir documento
    story = []
    
    # ===== CAPA =====
    story.extend(create_cover_page())
    story.append(PageBreak())
    
    # ===== SUMÁRIO =====
    story.append(Paragraph("Sumário Executivo", heading1))
    story.append(Paragraph(
        "O Bags Shield Protocol representa a evolução definitiva em segurança para investidores "
        "na blockchain Solana. Combinando tecnologias de ponta como ZK-Proofs, Inteligência Artificial "
        "predítiva e um registro on-chain imutável, oferecemos a mais completa suite de proteção "
        "contra rug pulls, scams e tokens de alto risco.",
        body_text
    ))
    story.append(Spacer(1, 0.5*cm))
    
    # Diferenciais em tabela
    diff_data = [
        ["Diferencial", "Descrição", "Impacto"],
        ["ZK-Proof Scanner", "Verificação matemática de contratos inteligentes", "100% auditável"],
        ["AI Predictive Shield", "Modelo de ML treinado com 50k+ rug pulls", "95% precisão"],
        ["On-Chain Registry", "Blacklist descentralizada de tokens maliciosos", "Imutável"],
        ["Real-time Monitoring", "Análise contínua de liquidez e holders", "< 30s alerta"],
    ]
    diff_table = Table(diff_data, colWidths=[4.5*cm, 6*cm, 4*cm])
    diff_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor("#1a1a2e")),
        ('TEXTCOLOR', (0, 0), (-1, 0), CYAN),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#333344")),
        ('TEXTCOLOR', (0, 1), (-1, -1), HexColor("#CCCCDD")),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor("#0D0D1A"), HexColor("#080811")]),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(diff_table)
    story.append(PageBreak())
    
    # ===== ARQUITETURA =====
    story.append(Paragraph("Arquitetura Técnica", heading1))
    story.append(Paragraph(
        "Nossa arquitetura é dividida em camadas para garantir escalabilidade, segurança e performance:",
        body_text
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("1. Camada de Dados (Data Layer)", heading2))
    story.append(Paragraph(
        "• Indexação em tempo real da blockchain Solana via RPC nodes dedicados<br/>"
        "• Cache distribuído com Redis para queries frequentes<br/>"
        "• Armazenamento histórico em PostgreSQL com particionamento automático",
        body_text
    ))
    
    story.append(Paragraph("2. Camada de Análise (Analysis Layer)", heading2))
    story.append(Paragraph(
        "• Motor de scoring com 50+ indicadores de risco<br/>"
        "• Integração com Jupiter Aggregator para dados de mercado<br/>"
        "• Sistema de reputação de wallets baseado em histórico",
        body_text
    ))
    
    story.append(Paragraph("3. Camada de Proteção (Shield Layer)", heading2))
    story.append(Paragraph(
        "• ZK-Proofs para verificação de contratos sem revelar código<br/>"
        "• AI Predictive Model com atualização contínua<br/>"
        "• Alertas em tempo real via WebSocket e push notifications",
        body_text
    ))
    story.append(PageBreak())
    
    # ===== INOVAÇÕES =====
    story.append(Paragraph("Inovações e Diferenciais Competitivos", heading1))
    story.append(Paragraph(
        "Em um mercado saturado de scanners de tokens, o Bags Shield se destaca por:",
        body_text
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("ZK-Proof Scanner — Verificação Matemática", heading2))
    story.append(Paragraph(
        "Diferente de scanners tradicionais que apenas verificam bytecode, nosso ZK-Proof Scanner "
        "gera provas matemáticas de que um contrato segue padrões seguros, sem necessidade de "
        "revelar o código fonte. Isso protege a propriedade intelectual dos desenvolvedores legítimos "
        "enquanto garante segurança aos investidores.",
        body_text
    ))
    
    story.append(Paragraph("AI Predictive Shield — Prevenção Proativa", heading2))
    story.append(Paragraph(
        "Nosso modelo de machine learning foi treinado com mais de 50.000 casos reais de rug pulls "
        "na Solana, identificando padrões sutis que scanners estáticos não detectam. O sistema "
        "atualiza seus pesos automaticamente a cada novo incidente reportado pela comunidade.",
        body_text
    ))
    
    story.append(Paragraph("On-Chain Registry — Transparência Total", heading2))
    story.append(Paragraph(
        "Todas as classificações de risco são registradas on-chain, criando um histórico imutável "
        "e auditável. Isso permite que investidores verifiquem a evolução do score de um token "
        "ao longo do tempo e tomem decisões baseadas em dados.",
        body_text
    ))
    story.append(PageBreak())
    
    # ===== PLANO DE IMPLANTAÇÃO =====
    story.append(Paragraph("Plano de Implantação", heading1))
    story.append(Paragraph(
        "Fase 1 — Fundação (Mês 1-2):<br/>"
        "• Setup de infraestrutura cloud (AWS/Vercel)<br/>"
        "• Deploy dos contratos inteligentes de registro<br/>"
        "• Integração com RPC nodes e Jupiter API<br/>"
        "• Lançamento do scanner básico (MVP)",
        body_text
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph(
        "Fase 2 — Escalada (Mês 3-4):<br/>"
        "• Implementação do ZK-Proof Scanner<br/>"
        "• Treinamento e deploy do AI Predictive Shield<br/>"
        "• Sistema de alertas em tempo real<br/>"
        "• Parcerias com DEXs e launchpads",
        body_text
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph(
        "Fase 3 — Consolidação (Mês 5-6):<br/>"
        "• Lançamento do token nativo $BAGS<br/>"
        "• DAO para governança comunitária<br/>"
        "• API pública para integrações de terceiros<br/>"
        "• Expansão para outras chains (Ethereum, BSC)",
        body_text
    ))
    story.append(PageBreak())
    
    # ===== CUSTOS =====
    story.append(Paragraph("Estimativa de Custos", heading1))
    story.append(Paragraph(
        "Infraestrutura (mensal):<br/>"
        "• Servidores/RPC: $800-1.200<br/>"
        "• Banco de dados/cache: $300-500<br/>"
        "• Armazenamento/logs: $100-200<br/>"
        "• Total infra: ~$1.500-2.000/mês",
        body_text
    ))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph(
        "Desenvolvimento (6 meses):<br/>"
        "• Equipe core (3 devs full-time): $45.000<br/>"
        "• Design/UX: $6.000<br/>"
        "• Auditors/Security: $12.000<br/>"
        "• Marketing/Launch: $15.000<br/>"
        "• Total projeto: ~$78.000",
        body_text
    ))
    story.append(PageBreak())
    
    # ===== CONCLUSÃO =====
    story.append(Paragraph("Conclusão", heading1))
    story.append(Paragraph(
        "O Bags Shield Protocol v3.0 representa o estado da arte em segurança para investidores "
        "de criptomoedas na Solana. Com nossa combinação única de ZK-Proofs, IA preditiva e "
        "transparência on-chain, estamos construindo um ecossistema mais seguro e confiável "
        "para todos os participantes do mercado.",
        body_text
    ))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(
        "Junte-se a nós nessa missão de proteger a comunidade crypto e tornar o mercado de "
        "tokens mais seguro para investidores de todos os níveis.",
        body_text
    ))
    story.append(Spacer(1, 1*cm))
    
    # Assinatura
    story.append(HRFlowable(width="40%", thickness=1, color=CYAN, hAlign="LEFT"))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        "BagsShield Team<br/>"
        "contato@bagsshield.org<br/>"
        "https://bagsshield.org",
        ParagraphStyle('Signature', fontSize=10, textColor=HexColor("#8888AA"), leading=14)
    ))
    
    # Gerar PDF
    doc.build(story, onFirstPage=create_header_footer, onLaterPages=create_header_footer)
    print(f"PDF gerado com sucesso: {output_path}")
    return output_path


if __name__ == "__main__":
    main()
