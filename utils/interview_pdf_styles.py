# -*- coding: utf-8 -*-
"""Estilos do documento da Declaração de Saúde / Entrevista Qualificada.

Separado do interview_pdf.py de propósito: ajuste visual acontece aqui, sem mexer na montagem
das seções.

O documento original é preto e branco, com tabelas de grade fina — por isso a paleta é
propositalmente sóbria, diferente das telas do sistema. Usa Helvetica, uma das fontes embutidas
no PDF, o que dispensa arquivo de fonte no servidor.
"""
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm

# ---------- Página ----------

PAGE_SIZE = A4

MARGIN_LEFT = 20 * mm
MARGIN_RIGHT = 18 * mm

# O logotipo fica no topo de todas as páginas e a identificação da operadora no rodapé, também
# em todas — por isso as duas margens reservam espaço para essas faixas.
MARGIN_TOP = 26 * mm
MARGIN_BOTTOM = 30 * mm

CONTENT_WIDTH = PAGE_SIZE[0] - MARGIN_LEFT - MARGIN_RIGHT

# ---------- Cores ----------

PRETO = colors.HexColor("#000000")
BRANCO = colors.HexColor("#ffffff")
TEXTO = colors.HexColor("#1a1a1a")

# Cinza do marca-texto. É o mesmo tom do documento original: o stream do PDF de referência
# pinta esses destaques com "0.753 g", que equivale a #c0c0c0.
CINZA_MARCA_TEXTO = "#c0c0c0"
CINZA_LINHA = colors.HexColor("#7a7a7a")
CINZA_CLARO = colors.HexColor("#d9d9d9")
CINZA_FUNDO = colors.HexColor("#efefef")

# Tons do questionário. A faixa escura do cabeçalho de cada grupo é o que separa um grupo do
# outro; as linhas ficam apenas com filetes horizontais e faixas alternadas, sem grade fechada.
CINZA_CABECALHO = colors.HexColor("#333333")
CINZA_ZEBRA = colors.HexColor("#f6f6f6")
CINZA_SEPARADOR = colors.HexColor("#d8d8d8")
CINZA_DECLARADA = colors.HexColor("#e4e4e4")
CINZA_RESPOSTA_NAO = colors.HexColor("#6b6b6b")

# ---------- Rodapé da operadora (repetido em todas as páginas) ----------

# Geometria da faixa do rodapé, medida a partir da base da página.
RODAPE_LINHA_SEPARADORA = 27 * mm

# Tamanho usado tanto no selo do ANS quanto nas linhas de identificação. A entrelinha acompanha
# o corpo: com 8.5pt de texto, 3.2mm entre linhas deixaria as linhas quase encostadas.
RODAPE_FONTE = 8.5
RODAPE_ENTRELINHA = 3.9 * mm

# A faixa do rodapé vai da linha separadora até um pouco acima da borda da folha. Tanto o selo do
# ANS quanto o bloco de informações são centralizados verticalmente dentro dela — as alturas são
# calculadas em interview_pdf.py a partir deste intervalo, não fixadas linha a linha.
RODAPE_BANDA_TOPO = RODAPE_LINHA_SEPARADORA
RODAPE_BANDA_BASE = 6 * mm
RODAPE_BANDA_CENTRO = (RODAPE_BANDA_TOPO + RODAPE_BANDA_BASE) / 2

# O rodapé tem dois blocos, cada um encostado na sua margem e centralizado verticalmente: o selo
# do ANS à esquerda (com o logotipo ao lado, quando o arquivo existir) e as demais linhas de
# identificação à direita.
RODAPE_ESPACO_ENTRE_COLUNAS = 4 * mm

# O registro ANS é desenhado como um selo: fundo preto com borda, texto em branco por cima.
# Negrito porque texto branco sobre fundo preto pede peso maior para não empastar.
RODAPE_ANS_FONTE_NOME = "Helvetica-Bold"
RODAPE_ANS_PADDING_X = 4.5
RODAPE_ANS_PADDING_Y = 2.5
RODAPE_ANS_BORDA = 0.8

# proporções da Helvetica, usadas para dimensionar a caixa em volta do texto
FONTE_ASCENT = 0.718
FONTE_DESCENT = 0.207

# ---------- Logotipo no topo de todas as páginas ----------

# O arquivo é 1195x278 px (proporção ~4.30); a caixa abaixo respeita essa proporção, então a
# imagem preenche o espaço sem sobrar borda. A altura é a mesma da versão anterior do logotipo,
# para que a faixa reservada no topo — e com ela a paginação — não mude.
LOGO_ALTURA = 14 * mm
LOGO_LARGURA = 60.2 * mm

# distância entre a borda superior da folha e o topo do logotipo
LOGO_TOPO_MARGEM = 8 * mm

CABECALHO_OPERADORA = ParagraphStyle(
    "CabecalhoOperadora", fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=TEXTO,
)

CABECALHO_LINHA = ParagraphStyle(
    "CabecalhoLinha", fontName="Helvetica", fontSize=7.2, leading=9, textColor=TEXTO,
)

CABECALHO_LINHA_DIREITA = ParagraphStyle(
    "CabecalhoLinhaDireita", parent=CABECALHO_LINHA, alignment=TA_RIGHT,
)

# ---------- Carta de orientação (páginas 1 e 2) ----------

CARTA_TITULO = ParagraphStyle(
    "CartaTitulo", fontName="Helvetica-Bold", fontSize=12, leading=15,
    textColor=PRETO, alignment=TA_CENTER, spaceAfter=1 * mm,
)

CARTA_SUBTITULO = ParagraphStyle(
    "CartaSubtitulo", fontName="Helvetica-Bold", fontSize=11, leading=14,
    textColor=PRETO, alignment=TA_CENTER, spaceAfter=5 * mm,
)

CARTA_PARAGRAFO = ParagraphStyle(
    "CartaParagrafo", fontName="Helvetica", fontSize=9.3, leading=12.4,
    textColor=TEXTO, alignment=TA_JUSTIFY, spaceAfter=2.6 * mm,
)

CARTA_SUBTITULO_SECAO = ParagraphStyle(
    "CartaSubtituloSecao", parent=CARTA_PARAGRAFO, fontName="Helvetica-Bold",
    alignment=TA_JUSTIFY, spaceBefore=2 * mm, spaceAfter=1.5 * mm,
)

CARTA_MARCADOR = ParagraphStyle(
    "CartaMarcador", parent=CARTA_PARAGRAFO, leftIndent=5 * mm, bulletIndent=0,
    spaceAfter=2 * mm,
)

# ---------- Títulos de bloco (DECLARAÇÃO DE SAÚDE, ESCOLHA DO MÉDICO..., etc.) ----------

BLOCO_TITULO = ParagraphStyle(
    "BlocoTitulo", fontName="Helvetica-Bold", fontSize=13, leading=16,
    textColor=PRETO, alignment=TA_CENTER,
)

BLOCO_SUBTITULO = ParagraphStyle(
    "BlocoSubtitulo", fontName="Helvetica-Bold", fontSize=11, leading=14,
    textColor=PRETO, alignment=TA_CENTER, spaceBefore=2 * mm,
)

# ---------- Corpo da declaração ----------

CORPO = ParagraphStyle(
    "Corpo", fontName="Helvetica", fontSize=9.3, leading=12.4,
    textColor=TEXTO, alignment=TA_JUSTIFY, spaceAfter=2.6 * mm,
)

CORPO_CENTRO = ParagraphStyle("CorpoCentro", parent=CORPO, alignment=TA_CENTER)

CAMPO_ROTULO = ParagraphStyle(
    "CampoRotulo", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=TEXTO,
)

CAMPO_VALOR = ParagraphStyle(
    "CampoValor", fontName="Helvetica", fontSize=9.5, leading=12, textColor=PRETO,
)

# ---------- Questionário ----------

QUESTIONARIO_TITULO = ParagraphStyle(
    "QuestionarioTitulo", fontName="Helvetica-Bold", fontSize=12, leading=15,
    textColor=PRETO, alignment=TA_CENTER, spaceBefore=4 * mm, spaceAfter=3 * mm,
)

# ---- cabeçalho do grupo: faixa escura com texto branco ----

GRUPO_NUMERO = ParagraphStyle(
    "GrupoNumero", fontName="Helvetica-Bold", fontSize=10, leading=12,
    textColor=BRANCO, alignment=TA_CENTER,
)

GRUPO_TITULO = ParagraphStyle(
    "GrupoTitulo", fontName="Helvetica-Bold", fontSize=8.8, leading=11, textColor=BRANCO,
)

COLUNA_RESPOSTA = ParagraphStyle(
    "ColunaResposta", fontName="Helvetica-Bold", fontSize=7, leading=8.6,
    textColor=BRANCO, alignment=TA_CENTER,
)

# ---- linhas do questionário ----

ITEM_LETRA = ParagraphStyle(
    "ItemLetra", fontName="Helvetica-Bold", fontSize=8, leading=10.5,
    textColor=CINZA_RESPOSTA_NAO, alignment=TA_CENTER,
)

ITEM_TEXTO = ParagraphStyle(
    "ItemTexto", fontName="Helvetica", fontSize=8.5, leading=10.5, textColor=TEXTO,
)

# pergunta respondida "SIM": ganha peso, porque é o que se procura ao ler o documento
ITEM_TEXTO_DECLARADO = ParagraphStyle(
    "ItemTextoDeclarado", parent=ITEM_TEXTO, fontName="Helvetica-Bold", textColor=PRETO,
)

ITEM_RESPOSTA = ParagraphStyle(
    "ItemResposta", fontName="Helvetica", fontSize=8.5, leading=10.5,
    textColor=CINZA_RESPOSTA_NAO, alignment=TA_CENTER,
)

ITEM_RESPOSTA_DECLARADA = ParagraphStyle(
    "ItemRespostaDeclarada", parent=ITEM_RESPOSTA,
    fontName="Helvetica-Bold", textColor=PRETO,
)

IMC_FAIXA = ParagraphStyle(
    "ImcFaixa", fontName="Helvetica", fontSize=7.6, leading=9.4, textColor=TEXTO,
)

# larguras das colunas do questionário
LARGURA_LETRA = 8 * mm
LARGURA_RESPOSTA = 24 * mm
LARGURA_TEXTO = CONTENT_WIDTH - LARGURA_LETRA - LARGURA_RESPOSTA

# Base do estilo do questionário. A grade fechada saiu: o que estrutura a leitura é a faixa
# escura do cabeçalho, um filete fino entre as linhas e a régua vertical que isola a coluna de
# resposta. As faixas alternadas e o destaque das declaradas são acrescentados por linha, em
# interview_pdf.py, porque dependem do conteúdo.
TABELA_QUESTIONARIO = [
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ("TOPPADDING", (0, 0), (-1, -1), 2.6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.6),

    # faixa do cabeçalho do grupo
    ("BACKGROUND", (0, 0), (-1, 0), CINZA_CABECALHO),
    ("TOPPADDING", (0, 0), (-1, 0), 3.4),
    ("BOTTOMPADDING", (0, 0), (-1, 0), 3.4),

    # moldura externa discreta e filetes entre as linhas
    ("BOX", (0, 0), (-1, -1), 0.5, CINZA_LINHA),
    ("LINEBELOW", (0, 1), (-1, -2), 0.4, CINZA_SEPARADOR),

    # régua separando a coluna de resposta, do corpo para baixo
    ("LINEBEFORE", (2, 1), (2, -1), 0.4, CINZA_SEPARADOR),
]

# ---------- Assinaturas ----------

ASSINATURA_LINHA = ParagraphStyle(
    "AssinaturaLinha", fontName="Helvetica", fontSize=9, leading=13, textColor=TEXTO,
)

ASSINATURA_LEGENDA = ParagraphStyle(
    "AssinaturaLegenda", fontName="Helvetica", fontSize=8, leading=10,
    textColor=TEXTO, alignment=TA_CENTER,
)

# ---------- Blocos de assinatura da carta (página 2) ----------

ASSINATURA_TITULO = ParagraphStyle(
    "AssinaturaTitulo", fontName="Helvetica-Bold", fontSize=9.5, leading=12,
    textColor=PRETO, alignment=TA_CENTER, spaceAfter=3 * mm,
)

# a linha preenchível fica centralizada na própria coluna, com o rótulo logo abaixo
ASSINATURA_PREENCHER = ParagraphStyle(
    "AssinaturaPreencher", fontName="Helvetica", fontSize=9, leading=12,
    textColor=TEXTO, alignment=TA_CENTER,
)

# Valor já preenchido pelo sistema, assentado sobre a linha do campo. O leading precisa ser o
# mesmo do ASSINATURA_LINHA: como a célula alinha pelo rodapé, um leading diferente deixaria o
# valor num nível ligeiramente distinto do rótulo ao lado.
ASSINATURA_VALOR = ParagraphStyle(
    "AssinaturaValor", fontName="Helvetica", fontSize=9, leading=13,
    textColor=PRETO, leftIndent=3,
)

# largura do bloco inteiro; o bloco é centralizado na página, e os campos alinhados dentro dele
# Os dois blocos ficam lado a lado: beneficiário à esquerda, intermediário à direita.
ASSINATURA_VAO_ENTRE_BLOCOS = 12 * mm
ASSINATURA_BLOCO_LARGURA = (CONTENT_WIDTH - ASSINATURA_VAO_ENTRE_BLOCOS) / 2

# o Local recebe o nome da cidade por extenso e precisa de mais espaço que a data, que ocupa
# pouco mais de 45pt; sem essa folga o nome da cidade quebra em duas linhas
ASSINATURA_COLUNA_LOCAL = 52 * mm
# vão entre a linha do local e a da data, para não parecerem uma linha contínua só
ASSINATURA_VAO_LOCAL_DATA = 4 * mm
ASSINATURA_COLUNA_ROTULO = 22 * mm
ASSINATURA_ALTURA_CAMPO = 9 * mm

TABELA_ASSINATURA = [
    ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 0),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
]

CAIXA_LIVRE = [
    ("BOX", (0, 0), (-1, -1), 0.5, CINZA_LINHA),
    ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]
