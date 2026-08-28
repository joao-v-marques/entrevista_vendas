# -*- coding: utf-8 -*-
"""Desenha a Declaração de Saúde / Entrevista Qualificada em PDF, reproduzindo o documento
oficial da Unimed São Sebastião do Paraíso (VERSÃO Julho/2025).

Função pura: recebe o dicionário montado por InterviewDocumentService e devolve bytes. Não
importa banco, não importa Flask, não lê request — dá para gerar e abrir o PDF sem subir a
aplicação, o que torna o ajuste de layout barato.

Ordem das seções:
  Carta de Orientação ao Beneficiário (texto da ANS), em duas páginas
  Abertura da Declaração de Saúde
  Os 27 grupos do questionário
  Comentários adicionais e declaração do beneficiário
  Escolha do médico orientador
  Parecer reservado à Unimed
  Aceitação da Cobertura Parcial Temporária (CPT)
  Página final, só com a moldura

O documento original tem 16 páginas, mas aqui a contagem não é fixa: o questionário flui e
ocupa cada folha até o fim, em vez de repetir a distribuição do original, que deixava páginas
com dois ou três grupos e o resto em branco. Com as respostas todas em NÃO dá 13 páginas, e
sobe conforme as especificações digitadas na análise. Só as quatro seções que precisam de
assinatura própria começam em página nova, por quebra explícita.

Toda página leva a mesma moldura: o logotipo no topo e, no rodapé, o selo do registro ANS à
esquerda com CNPJ, endereço, telefone, versão e site à direita.
"""
import io
import os
import re
from xml.sax.saxutils import escape

from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, KeepTogether, PageBreak, PageTemplate, Paragraph, Spacer,
    Table,
)

from utils import interview_pdf_styles as S
from utils import interview_document_texts as T

# Logotipo impresso no topo de todas as páginas. O nome do arquivo tem espaço mesmo.
LOGO_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "static", "img", "logo com iso.png",
)


# Dado vindo do banco (nome, observação, medida): escapa, porque um "<" digitado por alguém
# quebraria o parser do Paragraph.
def _esc(value):
    return escape("" if value is None else str(value))


# Texto fixo do documento (interview_document_texts.py e os enunciados do questionário): passa
# sem escapar, para aceitar a marcação que o Paragraph do ReportLab entende — <b>negrito</b>,
# <u>sublinhado</u>, <i>itálico</i>, <br/>, <font color="...">. Só é seguro porque esses textos
# são nossos e não contêm & < >; o teste de verificação garante que continue assim.
#
# Além dessas, aceita <mark>...</mark> como atalho para o marca-texto cinza do documento
# original. O ReportLab não conhece essa tag, então ela é traduzida aqui para o <font
# backColor> que ele entende — assim quem escreve o texto não precisa decorar o código da cor.
def _rico(value):
    if value is None:
        return ""

    return (
        str(value)
        .replace("<mark>", '<font backColor="%s">' % S.CINZA_MARCA_TEXTO)
        .replace("</mark>", "</font>")
    )


# ---------------------------------------------------------------------------
# Moldura das páginas: logotipo no topo e identificação da operadora no rodapé,
# igual em todas elas, inclusive na carta da ANS
# ---------------------------------------------------------------------------

_TAGS = re.compile(r"</?[a-zA-Z][^>]*>")


# O rodapé é desenhado direto no canvas, que — ao contrário do Paragraph — não interpreta
# marcação. Sem isso, um <b> escrito no texto sairia impresso na página, literalmente.
# O peso e o tamanho de cada linha do rodapé são definidos aqui no código, não no texto.
def _sem_markup(value):
    return _TAGS.sub("", "" if value is None else str(value)).strip()


# Desenhado em toda página, pelo onPage do modelo: logotipo no topo e identificação no rodapé.
def _desenha_moldura(canvas, doc):
    _desenha_logotipo(canvas)
    _desenha_rodape(canvas, doc)


# Logotipo no alto de todas as páginas, encostado na margem esquerda. A margem superior do
# frame reserva essa faixa, então o conteúdo nunca passa por cima.
def _desenha_logotipo(canvas):
    # O logotipo é obrigatório no documento: se o arquivo sumir ou for inválido, a geração falha
    # em vez de emitir um documento sem ele. Silenciar aqui produziria PDFs incompletos sem que
    # ninguém percebesse — e este documento vai para assinatura do beneficiário.
    if not os.path.isfile(LOGO_PATH):
        raise FileNotFoundError(
            "Logotipo do documento não encontrado em %s" % LOGO_PATH
        )

    topo = S.PAGE_SIZE[1] - S.LOGO_TOPO_MARGEM

    canvas.drawImage(
        LOGO_PATH, S.MARGIN_LEFT, topo - S.LOGO_ALTURA,
        width=S.LOGO_LARGURA, height=S.LOGO_ALTURA,
        preserveAspectRatio=True, anchor="nw", mask="auto",
    )


def _desenha_rodape(canvas, doc):
    canvas.saveState()

    largura = S.PAGE_SIZE[0]
    direita = largura - S.MARGIN_RIGHT
    centro_banda = S.RODAPE_BANDA_CENTRO

    # linha separando o conteúdo do rodapé
    canvas.setStrokeColor(S.CINZA_CLARO)
    canvas.setLineWidth(0.5)
    canvas.line(S.MARGIN_LEFT, S.RODAPE_LINHA_SEPARADORA, direita, S.RODAPE_LINHA_SEPARADORA)

    # ---- esquerda: o selo do ANS, centralizado verticalmente na faixa ----
    _desenha_selo_ans(canvas, S.MARGIN_LEFT, centro_banda)

    # ---- direita: as informações, alinhadas à direita e centralizadas verticalmente ----
    linhas_direita = [
        _sem_markup(T.OPERADORA_CNPJ),
        _sem_markup(T.OPERADORA_ENDERECO),
        _sem_markup(T.OPERADORA_TELEFONE),
        "%s     %s" % (_sem_markup(T.OPERADORA_VERSAO), _sem_markup(T.OPERADORA_SITE)),
    ]

    canvas.setFillColor(S.TEXTO)
    canvas.setFont("Helvetica", S.RODAPE_FONTE)

    primeira_linha = _primeira_linha_centralizada(
        len(linhas_direita), S.RODAPE_ENTRELINHA, S.RODAPE_FONTE, centro_banda)

    for indice, linha in enumerate(linhas_direita):
        canvas.drawRightString(direita, primeira_linha - indice * S.RODAPE_ENTRELINHA, linha)

    canvas.restoreState()


# Linha de base da PRIMEIRA linha de um bloco de texto que deve ficar centralizado verticalmente
# em torno de "centro". O bloco vai do topo da primeira linha à base da última, por isso entram
# na conta o ascent e o descent da fonte, não só o espaçamento entre linhas.
def _primeira_linha_centralizada(quantidade_linhas, entrelinha, tamanho, centro):
    altura_texto = ((quantidade_linhas - 1) * entrelinha
                    + (S.FONTE_ASCENT + S.FONTE_DESCENT) * tamanho)
    base_do_bloco = centro - altura_texto / 2

    return base_do_bloco + S.FONTE_DESCENT * tamanho + (quantidade_linhas - 1) * entrelinha


# Caixa preta com borda e texto branco, começando em "x_caixa" e centralizada verticalmente em
# torno de "centro_vertical". É dimensionada pela largura real do texto, então acompanha
# qualquer mudança em OPERADORA_ANS ou no tamanho da fonte.
def _desenha_selo_ans(canvas, x_caixa, centro_vertical):
    texto = _sem_markup(T.OPERADORA_ANS)
    tamanho = S.RODAPE_FONTE
    fonte = S.RODAPE_ANS_FONTE_NOME

    canvas.setFont(fonte, tamanho)

    largura_caixa = canvas.stringWidth(texto, fonte, tamanho) + 2 * S.RODAPE_ANS_PADDING_X
    altura_caixa = (S.FONTE_ASCENT + S.FONTE_DESCENT) * tamanho + 2 * S.RODAPE_ANS_PADDING_Y

    y_caixa = centro_vertical - altura_caixa / 2
    linha_base = y_caixa + S.RODAPE_ANS_PADDING_Y + S.FONTE_DESCENT * tamanho

    canvas.setFillColor(S.PRETO)
    canvas.setStrokeColor(S.PRETO)
    canvas.setLineWidth(S.RODAPE_ANS_BORDA)
    canvas.rect(x_caixa, y_caixa, largura_caixa, altura_caixa, stroke=1, fill=1)

    canvas.setFillColor(S.BRANCO)
    canvas.drawCentredString(x_caixa + largura_caixa / 2, linha_base, texto)

    return largura_caixa


# ---------------------------------------------------------------------------
# Blocos reutilizados
# ---------------------------------------------------------------------------

class _CentralizaVerticalmente(Flowable):
    """Ocupa a altura que sobrou na página e centraliza nela os flowables recebidos.

    O Platypus empilha de cima para baixo e não oferece alinhamento vertical. O wrap() é o
    único ponto em que a altura ainda livre na página é conhecida, e é dela que sai a sobra a
    distribuir acima e abaixo do conteúdo.
    """

    def __init__(self, conteudo, espaco_entre=0):
        super().__init__()
        self._conteudo = list(conteudo)
        self._espaco_entre = espaco_entre
        self._disponivel = 0
        self._alturas = []

    def wrap(self, largura, altura):
        self.width = largura
        self._alturas = [flowable.wrap(largura, altura)[1] for flowable in self._conteudo]

        # Quando o que sobrou na página não comporta o conteúdo, devolve a altura de que ele
        # realmente precisa: o frame recusa o flowable e ele vai inteiro para a página seguinte,
        # em vez de ser desenhado por cima do rodapé. Passou a importar quando este bloco deixou
        # de vir sempre logo depois de uma quebra de página.
        self._disponivel = max(altura, self._ocupado())

        return largura, self._disponivel

    def _ocupado(self):
        return sum(self._alturas) + self._espaco_entre * (len(self._conteudo) - 1)

    def draw(self):
        ocupado = self._ocupado()
        sobra = max(self._disponivel - ocupado, 0)
        topo = self._disponivel - sobra / 2

        for flowable, altura in zip(self._conteudo, self._alturas):
            topo -= altura
            flowable.drawOn(self.canv, 0, topo)
            topo -= self._espaco_entre

# Cada item entra numa LINHA da tabela, e não todos numa célula só: a célula é indivisível, então
# a caixa estourava a folha — e a geração falhava com LayoutError — quando o beneficiário
# declarava muitas doenças. Em linhas, a tabela se divide sozinha e a caixa continua na página
# seguinte, sem perder a borda.
#
# "altura" é o espaço de escrita reservado, e vale como MÍNIMO: a caixa cresce quando o que já foi
# digitado passa dele. Como altura fixa, o excedente era desenhado para fora da borda e por cima
# do que viesse abaixo — bastavam umas doze especificações na observação.
def _caixa(conteudo, altura=None, largura=None):
    itens = list(conteudo) if isinstance(conteudo, (list, tuple)) else [conteudo]
    largura_caixa = largura or S.CONTENT_WIDTH

    linhas = [[item] for item in itens]

    if altura:
        # o conteúdo escreve dentro dos paddings do estilo: 5pt de cada lado, 4pt acima e abaixo
        ocupado = sum(item.wrap(largura_caixa - 10, 100000)[1] for item in itens) + 8
        if ocupado < altura:
            linhas.append([Spacer(1, altura - ocupado)])

    tabela = Table(linhas, colWidths=[largura_caixa])

    estilo = list(S.CAIXA_LIVRE)
    if len(linhas) > 1:
        # o respiro de 4pt do estilo vale para a borda da caixa, não entre um item e outro:
        # cobrado linha a linha, ele afastaria a lista e devolveria o espaço que se quer poupar
        estilo.append(("TOPPADDING", (0, 1), (-1, -1), 0))
        estilo.append(("BOTTOMPADDING", (0, 0), (-1, -2), 0))

    tabela.setStyle(estilo)
    return tabela


# A observação guarda uma especificação por linha ("<pergunta>: <texto>"), como o modal de análise
# grava. Cada uma vira um parágrafo próprio: numa caixa que precisa poder se dividir entre páginas
# não cabe um bloco único, e emendadas num corrido só elas ficavam ilegíveis.
def _observacao(texto):
    bruto = str(texto or "").replace("\r\n", "\n")
    linhas = [linha.strip() for linha in bruto.split("\n") if linha.strip()]

    return [Paragraph(_esc(linha), S.CORPO) for linha in linhas] or [Paragraph("", S.CORPO)]


# O rótulo e a caixa formam UM campo, e o campo não pode ser cortado ao meio: metade das
# observações numa folha e metade na seguinte deixa ambíguo o que o beneficiário está assinando.
# Desde que a caixa passou a ser divisível — para a lista de doenças da CPT poder continuar na
# página seguinte —, ela dividiria estes campos também; o KeepTogether empurra o campo inteiro
# para a próxima página quando ele não cabe no que restou da atual. Só cede quando o texto
# digitado é maior que uma folha inteira, caso em que não há para onde empurrar.
def _campo_de_observacao(rotulo, estilo_rotulo, texto, altura):
    return KeepTogether([
        Paragraph(_rico(rotulo), estilo_rotulo),
        _caixa(_observacao(texto), altura=altura),
    ])


MOLDURA_CAMPO = [
    ("GRID", (0, 0), (-1, -1), 0.5, S.CINZA_LINHA),
    ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]


# Cabeçalho de identificação repetido na abertura da declaração e nas três seções que o
# beneficiário assina em folha própria — médico orientador, parecer e CPT:
#   Nome do Proponente: <valor>   |   Nº do contrato: <valor>
# e, logo abaixo, o campo do representante legal. O rótulo desse campo muda conforme a página
# (a página 3 usa uma redação, as demais outra), por isso vem por parâmetro. O valor é sempre o
# representante legal — ele só existe quando o beneficiário é menor ou incapaz, então em geral
# a linha aparece em branco, para preenchimento à mão.
def _campos_proponente(ctx, rotulo_representante=None):
    tabela = Table(
        [[
            Paragraph("%s %s" % (_rico(T.CAMPO_PROPONENTE), _esc(ctx["proponente"])),
                      S.CAMPO_VALOR),
            Paragraph("%s %s" % (_rico(T.CAMPO_CONTRATO), _esc(ctx["numero_contrato"])),
                      S.CAMPO_VALOR),
        ]],
        colWidths=[S.CONTENT_WIDTH * 0.62, S.CONTENT_WIDTH * 0.38],
    )
    tabela.setStyle(MOLDURA_CAMPO)

    blocos = [tabela]

    if rotulo_representante:
        representante = Table(
            [[Paragraph("%s %s" % (_rico(rotulo_representante), _esc(ctx["representante_legal"])),
                        S.CAMPO_VALOR)]],
            colWidths=[S.CONTENT_WIDTH],
        )
        representante.setStyle(MOLDURA_CAMPO)
        blocos.append(representante)

    return blocos


# Campo de assinatura: espaço em branco com a linha no topo e o rótulo logo abaixo dela.
# O dois-pontos de rótulos como "Assinatura do Beneficiário:" é removido — ele faz sentido
# quando o campo vem na sequência do texto, não como legenda sob uma linha.
def _linha_assinatura(legenda, largura=None):
    largura = largura or S.CONTENT_WIDTH * 0.6
    legenda = _rico(legenda).rstrip(": ")

    # Centralizado no meio da FOLHA, e não da coluna de texto: as margens são assimétricas
    # (20mm à esquerda, 18mm à direita), então os dois centros não coincidem e um hAlign="CENTER"
    # alinharia pela coluna. O recuo sai da largura do papel.
    #
    # Uma tabela só, com uma coluna de recuo e outra com o campo — nada de tabela dentro de
    # célula: o ReportLab acrescenta um deslocamento próprio ao posicionar tabelas aninhadas,
    # e a geometria deixaria de ser previsível.
    recuo = S.PAGE_SIZE[0] / 2 - S.MARGIN_LEFT - largura / 2

    campo = Table(
        [
            ["", ""],
            ["", Paragraph(legenda, S.ASSINATURA_LEGENDA)],
        ],
        colWidths=[recuo, largura],
        rowHeights=[14 * mm, None],
        hAlign="LEFT",
    )
    campo.setStyle([
        ("LINEBELOW", (1, 0), (1, 0), 0.6, S.PRETO),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ])

    return campo


# Dois campos de assinatura lado a lado, ocupando a largura do conteúdo — o mesmo arranjo dos
# blocos da carta (página 2). Empilhados, os dois deixavam a página com um vazio comprido no meio
# e destoavam do resto do documento, em que os campos de duas assinaturas vêm na horizontal.
#
# Uma tabela única com as duas linhas e as duas legendas, e não dois _linha_assinatura colocados
# em células: tabela aninhada ganha um deslocamento próprio do ReportLab e as linhas não ficariam
# na mesma altura das dos outros blocos.
def _par_de_linhas_assinatura(legenda_esquerda, legenda_direita):
    largura = S.ASSINATURA_BLOCO_LARGURA
    legendas = [_rico(legenda).rstrip(": ") for legenda in (legenda_esquerda, legenda_direita)]

    campo = Table(
        [
            ["", "", ""],
            [Paragraph(legendas[0], S.ASSINATURA_LEGENDA), "",
             Paragraph(legendas[1], S.ASSINATURA_LEGENDA)],
        ],
        colWidths=[largura, S.ASSINATURA_VAO_ENTRE_BLOCOS, largura],
        rowHeights=[14 * mm, None],
        hAlign="LEFT",
    )
    campo.setStyle([
        ("LINEBELOW", (0, 0), (0, 0), 0.6, S.PRETO),
        ("LINEBELOW", (2, 0), (2, 0), 0.6, S.PRETO),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ])

    return campo


def _local_e_data(ctx):
    return Paragraph("%s %s" % (_rico(T.LOCAL_ASSINATURA), _esc(ctx["data_extenso"])), S.CORPO)


# marca "( X )" na opção escolhida e "(    )" nas demais
def _marcador(selecionado):
    return "( X )" if selecionado else "(&nbsp;&nbsp;&nbsp;&nbsp;)"


# ---------------------------------------------------------------------------
# Carta de Orientação ao Beneficiário — duas páginas
# ---------------------------------------------------------------------------

def _paragrafos_carta(itens):
    saida = []
    for estilo, texto in itens:
        if estilo == "h":
            saida.append(Paragraph(_rico(texto), S.CARTA_SUBTITULO_SECAO))
        elif estilo == "b":
            saida.append(Paragraph(_rico(texto), S.CARTA_MARCADOR, bulletText="•"))
        else:
            saida.append(Paragraph(_rico(texto), S.CARTA_PARAGRAFO))
    return saida


def _pagina_carta(ctx):
    flowables = [
        Paragraph(_rico(T.CARTA_TITULO), S.CARTA_TITULO),
        Paragraph(_rico(T.CARTA_SUBTITULO), S.CARTA_SUBTITULO),
    ]
    flowables.extend(_paragrafos_carta(T.CARTA_ORIENTACAO))
    flowables.append(PageBreak())

    flowables.extend(_paragrafos_carta(T.CARTA_ORIENTACAO_PAGINA_2))
    flowables.append(Spacer(1, 8 * mm))

    # A carta da ANS tem duas páginas, e o texto da segunda é curto: com os blocos de assinatura
    # encostados nele sobrava quase metade da folha vazia embaixo. Centralizados na sobra, o
    # branco fica distribuído em vez de virar um buraco no pé da página.
    flowables.append(_CentralizaVerticalmente([_blocos_de_assinatura(ctx)]))

    return flowables


# Os dois blocos de assinatura do fim da carta, lado a lado: beneficiário à esquerda,
# intermediário à direita. Os títulos ficam numa linha própria da tabela externa para que a
# altura seja a mesma nos dois — o título do intermediário é longo e quebra em duas linhas, e
# sem isso os campos de um lado ficariam mais altos que os do outro.
#
# O que o sistema já sabe vem preenchido: o nome do beneficiário (o mesmo exibido na página 3),
# o nome e o CPF de quem conduziu a entrevista como intermediário, a cidade e a data de emissão
# nos dois blocos. Ficam em branco só as assinaturas.
def _blocos_de_assinatura(ctx):
    data = ctx["data_extenso"]
    cidade = T.LOCAL_CIDADE

    esquerda = ("Beneficiário", [("Nome:", ctx["proponente"]), ("Assinatura:", "")])
    direita = ("Intermediário entre a operadora e o beneficiário",
               [("Nome:", ctx["entrevista"]["atendente"]),
                ("CPF:", ctx["entrevista"]["atendente_cpf"]), ("Assinatura:", "")])

    tabela = Table(
        [
            [Paragraph(_rico(esquerda[0]), S.ASSINATURA_TITULO), "",
             Paragraph(_rico(direita[0]), S.ASSINATURA_TITULO)],
            [_bloco_assinatura(esquerda[1], cidade, data), "",
             _bloco_assinatura(direita[1], cidade, data)],
        ],
        colWidths=[S.ASSINATURA_BLOCO_LARGURA, S.ASSINATURA_VAO_ENTRE_BLOCOS,
                   S.ASSINATURA_BLOCO_LARGURA],
    )
    tabela.setStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ])

    return tabela


# Corpo de um bloco de assinatura: a linha de "Local / Data" com os rótulos alinhados sob cada
# campo, e os campos a preencher. Montado com tabela e linhas desenhadas, em vez de underscores
# e espaços — que era o motivo da formatação sair torta. O título fica por conta de quem chama,
# para que os dois blocos possam dividir a mesma linha da tabela externa.
def _bloco_assinatura(campos, local="", data=""):
    largura = S.ASSINATURA_BLOCO_LARGURA
    coluna_local = S.ASSINATURA_COLUNA_LOCAL
    vao = S.ASSINATURA_VAO_LOCAL_DATA
    coluna_data = largura - coluna_local - vao

    # Local e data: três colunas, com a do meio servindo só de vão. A linha é desenhada como
    # borda inferior da célula, e o rótulo fica na linha de baixo, centralizado sob ela.
    # Local e data já vêm preenchidos.
    local_e_data = Table(
        [
            [Paragraph(_rico(local), S.ASSINATURA_PREENCHER), "",
             Paragraph(_esc(data), S.ASSINATURA_PREENCHER)],
            [Paragraph("Local", S.ASSINATURA_LEGENDA), "",
             Paragraph("Data", S.ASSINATURA_LEGENDA)],
        ],
        colWidths=[coluna_local, vao, coluna_data],
        rowHeights=[S.ASSINATURA_ALTURA_CAMPO, None],
    )
    local_e_data.setStyle(S.TABELA_ASSINATURA + [
        ("LINEBELOW", (0, 0), (0, 0), 0.6, S.PRETO),
        ("LINEBELOW", (2, 0), (2, 0), 0.6, S.PRETO),
    ])

    largura_rotulo = S.ASSINATURA_COLUNA_ROTULO

    # a tabela de local/data ocupa a largura inteira do bloco
    linhas = [[local_e_data, ""]]

    # cada campo: rótulo à esquerda e a linha ocupando o resto da largura. Quando o sistema já
    # conhece o valor (o nome do beneficiário), ele vem assentado sobre a linha.
    for rotulo, valor in campos:
        preenchido = Paragraph(_esc(valor), S.ASSINATURA_VALOR) if valor else ""
        linhas.append([Paragraph(_rico(rotulo), S.ASSINATURA_LINHA), preenchido])

    bloco = Table(
        linhas,
        colWidths=[largura_rotulo, largura - largura_rotulo],
        rowHeights=[None] + [S.ASSINATURA_ALTURA_CAMPO] * len(campos),
    )

    estilo = list(S.TABELA_ASSINATURA)
    # a primeira linha é a tabela de local/data, que já traz as próprias linhas
    estilo.append(("SPAN", (0, 0), (1, 0)))
    estilo.append(("BOTTOMPADDING", (0, 0), (1, 0), 4))
    for indice in range(1, len(campos) + 1):
        estilo.append(("LINEBELOW", (1, indice), (1, indice), 0.6, S.PRETO))
    bloco.setStyle(estilo)

    return bloco


# ---------------------------------------------------------------------------
# Abertura da Declaração de Saúde
# ---------------------------------------------------------------------------

def _pagina_abertura(ctx):
    flowables = [
        Paragraph(_rico(T.DECLARACAO_SAUDE_TITULO), S.BLOCO_TITULO),
        Spacer(1, 4 * mm),
    ]
    flowables.extend(_campos_proponente(ctx, T.CAMPO_REPRESENTANTE))
    flowables.append(Spacer(1, 4 * mm))

    # O texto de abertura corre sem quebra forçada: antes ele era partido no quinto parágrafo
    # para imitar a paginação do documento original, o que deixava metade de uma página vazia.
    for texto in T.DECLARACAO_SAUDE_ABERTURA:
        flowables.append(Paragraph(_rico(texto), S.CORPO))

    flowables.append(Paragraph(_rico(T.QUESTIONARIO_TITULO), S.QUESTIONARIO_TITULO))

    return flowables


# ---------------------------------------------------------------------------
# Questionário — os 27 grupos
# ---------------------------------------------------------------------------

# As faixas ficam em duas colunas, e não numa lista única: empilhadas, elas faziam da linha do
# IMC a mais alta do questionário, alta o bastante para não caber no fim da página e arrastar o
# grupo 5 partido para a página seguinte — com o cabeçalho repetido e um vão logo acima dele.
# Lado a lado a linha encolhe pela metade e o grupo passa a caber inteiro. Cabem nos 140mm da
# coluna de texto: 2 x (24mm + 30mm).
def _tabela_faixas_imc():
    metade = (len(T.IMC_FAIXAS) + 1) // 2
    esquerda, direita = T.IMC_FAIXAS[:metade], T.IMC_FAIXAS[metade:]

    linhas = []
    for indice in range(metade):
        # a coluna da esquerda leva a faixa a mais quando o total é ímpar
        par_direita = direita[indice] if indice < len(direita) else ("", "")
        linhas.append([Paragraph(_rico(texto), S.IMC_FAIXA)
                       for texto in esquerda[indice] + par_direita])

    tabela = Table(linhas, colWidths=[24 * mm, 30 * mm, 24 * mm, 30 * mm], hAlign="LEFT")
    tabela.setStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.5),
    ])
    return tabela


def _linha_item(linha):
    declarada = linha["declarada"]

    letra = Paragraph(_esc(linha["letra"]), S.ITEM_LETRA)
    resposta = Paragraph(
        _esc(linha["resposta"]),
        S.ITEM_RESPOSTA_DECLARADA if declarada else S.ITEM_RESPOSTA,
    )
    estilo_texto = S.ITEM_TEXTO_DECLARADO if declarada else S.ITEM_TEXTO

    # a linha do IMC traz a fórmula e as faixas de classificação, como no documento
    if linha["tipo"] == "imc":
        texto = [Paragraph(_rico(linha["texto"]), estilo_texto), Spacer(1, 1 * mm),
                 _tabela_faixas_imc()]
    else:
        texto = Paragraph(_rico(linha["texto"]), estilo_texto)

    return [letra, texto, resposta]


def _tabela_grupo(grupo):
    cabecalho = [
        Paragraph(_esc(grupo["numero"]), S.GRUPO_NUMERO),
        Paragraph(_rico(grupo["titulo"]), S.GRUPO_TITULO),
        Paragraph("RESPOSTA<br/>SIM ou NÃO", S.COLUNA_RESPOSTA),
    ]

    linhas = [cabecalho] + [_linha_item(l) for l in grupo["linhas"]]

    tabela = Table(
        linhas,
        colWidths=[S.LARGURA_LETRA, S.LARGURA_TEXTO, S.LARGURA_RESPOSTA],
        repeatRows=1,  # grupo que atravessa a página leva o cabeçalho junto
    )

    # Faixas alternadas para o olho não perder a linha até a coluna de resposta, e um tom mais
    # forte nas declaradas. O fundo depende do conteúdo, por isso é montado aqui e não no estilo
    # base — e a declarada vem depois da zebra, para prevalecer.
    estilo = list(S.TABELA_QUESTIONARIO)

    for indice, linha in enumerate(grupo["linhas"], start=1):
        if linha["declarada"]:
            estilo.append(("BACKGROUND", (0, indice), (-1, indice), S.CINZA_DECLARADA))
        elif indice % 2 == 0:
            estilo.append(("BACKGROUND", (0, indice), (-1, indice), S.CINZA_ZEBRA))

    tabela.setStyle(estilo)

    return tabela


# Os grupos fluem e ocupam a página até o fim, em vez de seguir a distribuição do documento
# original — que deixava páginas com dois ou três grupos e muito espaço vazio. Um grupo que não
# cabe inteiro no que resta da página é dividido, e o cabeçalho se repete na continuação
# (repeatRows=1 em _tabela_grupo), de modo que a parte de baixo continua legível.
def _secao_questionario(ctx):
    flowables = []

    for grupo in ctx["questionario"]:
        flowables.append(_tabela_grupo(grupo))
        flowables.append(Spacer(1, 3 * mm))

    return flowables


# ---------------------------------------------------------------------------
# Comentários adicionais e declaração do beneficiário
# ---------------------------------------------------------------------------

def _pagina_declaracao(ctx):
    # sem quebra de página: este bloco emenda no fim do questionário, como no original, onde os
    # últimos grupos dividem a folha com ele
    return [
        Spacer(1, 3 * mm),
        _campo_de_observacao(T.COMENTARIOS_TITULO, S.CORPO,
                             ctx["declaracao"]["observacao"], 32 * mm),
        Spacer(1, 6 * mm),
        Paragraph(_rico(T.DECLARACAO_FINAL_TITULO), S.BLOCO_SUBTITULO),
        Spacer(1, 3 * mm),
        Paragraph(_rico(T.DECLARACAO_FINAL_TEXTO), S.CORPO),
        Spacer(1, 4 * mm),
        _local_e_data(ctx),
        # o campo de assinatura ocupa a sobra da página, centralizado verticalmente — o
        # questionário acima é que decide onde este bloco começa, então a sobra varia
        _CentralizaVerticalmente([_linha_assinatura(T.ASSINATURA_BENEFICIARIO)]),
    ]


# ---------------------------------------------------------------------------
# Escolha do médico orientador
# ---------------------------------------------------------------------------

def _pagina_medico_orientador(ctx):
    escolhida = ctx["declaracao"]["escolha_medico_orientador"]

    flowables = [
        PageBreak(),
        Paragraph(_rico(T.MEDICO_ORIENTADOR_TITULO), S.BLOCO_TITULO),
        Spacer(1, 5 * mm),
    ]
    flowables.extend(_campos_proponente(ctx, T.CAMPO_TITULAR_OU_REPRESENTANTE))
    flowables.append(Spacer(1, 6 * mm))

    for indice, (chave, texto) in enumerate(T.MEDICO_ORIENTADOR_OPCOES, start=1):
        flowables.append(Paragraph(
            "%d - %s - %s" % (indice, _marcador(chave == escolhida), _rico(texto)), S.CORPO))
        flowables.append(Spacer(1, 1.5 * mm))

    flowables.extend([
        Spacer(1, 5 * mm),
        _local_e_data(ctx),
        # os dois campos de assinatura, lado a lado, ocupam a sobra da página, centralizados
        # verticalmente
        _CentralizaVerticalmente([
            _par_de_linhas_assinatura(T.ASSINATURA_MEDICO, T.ASSINATURA_BENEFICIARIO_LINHA),
        ]),
    ])

    return flowables


# ---------------------------------------------------------------------------
# Parecer reservado à Unimed
# ---------------------------------------------------------------------------

def _pagina_parecer(ctx):
    escolhido = ctx["declaracao"]["parecer_unimed"]

    linhas = [
        [Paragraph(_marcador(chave == escolhido), S.CAMPO_VALOR),
         Paragraph(_rico(texto), S.ITEM_TEXTO)]
        for chave, texto in T.PARECER_OPCOES
    ]
    opcoes = Table(linhas, colWidths=[14 * mm, S.CONTENT_WIDTH - 14 * mm])
    opcoes.setStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, S.CINZA_LINHA),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])

    flowables = [
        PageBreak(),
        Paragraph(_rico(T.PARECER_TITULO), S.BLOCO_TITULO),
        Paragraph(_rico(T.PARECER_SUBTITULO), S.BLOCO_SUBTITULO),
        Spacer(1, 5 * mm),
    ]
    flowables.extend(_campos_proponente(ctx, T.CAMPO_TITULAR_OU_REPRESENTANTE))
    flowables.extend([
        Spacer(1, 5 * mm),
        opcoes,
        Spacer(1, 6 * mm),
        _campo_de_observacao("Observações:", S.CAMPO_ROTULO,
                             ctx["declaracao"]["observacao"], 30 * mm),
        Spacer(1, 6 * mm),
        _local_e_data(ctx),
        Spacer(1, 4 * mm),
        Paragraph(_rico(T.PARECER_ACEITACAO), S.CORPO),
        # o campo de assinatura ocupa a sobra da página, centralizado verticalmente
        _CentralizaVerticalmente([_linha_assinatura(T.ASSINATURA_PROPONENTE)]),
    ])

    return flowables


# ---------------------------------------------------------------------------
# Aceitação da CPT
# ---------------------------------------------------------------------------

def _pagina_cpt(ctx):
    declaradas = ctx["doencas_declaradas"]

    # cada declaração vem com a doença e, quando houve, a especificação que o entrevistador
    # digitou — as duas juntas, porque só o nome da doença não diz o que foi declarado
    if declaradas:
        lista = []
        for item in declaradas:
            if item["especificacao"]:
                texto = "• <b>%s</b> %s %s" % (
                    _rico(item["doenca"]),
                    _rico(T.CPT_ESPECIFICACOES_ROTULO),
                    _esc(item["especificacao"]),
                )
            else:
                texto = "• <b>%s</b>" % _rico(item["doenca"])
            lista.append(Paragraph(texto, S.ITEM_TEXTO))
    else:
        lista = [Paragraph("", S.ITEM_TEXTO)]

    flowables = [
        PageBreak(),
        Paragraph(_rico(T.CPT_TITULO), S.BLOCO_TITULO),
        Spacer(1, 5 * mm),
    ]
    flowables.extend(_campos_proponente(ctx, T.CAMPO_TITULAR_OU_REPRESENTANTE))
    flowables.extend([
        Spacer(1, 5 * mm),
        # _rico primeiro (traduz <mark> e libera a marcação), format depois: nome e CPF
        # vêm do banco e entram já escapados
        Paragraph(_rico(T.CPT_TEXTO).format(nome=_esc(ctx["proponente"]),
                                            cpf=_esc(ctx["cpf"])), S.CORPO),
        Spacer(1, 4 * mm),
        Paragraph(_rico(T.CPT_LISTA_TITULO), S.CAMPO_ROTULO),
        _caixa(lista, altura=None),
        Spacer(1, 6 * mm),
        _local_e_data(ctx),
        # o campo de assinatura ocupa a sobra da página, centralizado verticalmente
        _CentralizaVerticalmente([_linha_assinatura(T.ASSINATURA_PROPONENTE)]),
    ])

    return flowables


# ---------------------------------------------------------------------------
# Montagem
# ---------------------------------------------------------------------------

def render_interview_report(context):
    buffer = io.BytesIO()

    documento = BaseDocTemplate(
        buffer,
        pagesize=S.PAGE_SIZE,
        leftMargin=S.MARGIN_LEFT,
        rightMargin=S.MARGIN_RIGHT,
        topMargin=S.MARGIN_TOP,
        bottomMargin=S.MARGIN_BOTTOM,
        title="Entrevista Qualificada — %s" % context.get("proponente", ""),
        author="Unimed São Sebastião do Paraíso",
    )

    largura_util = S.PAGE_SIZE[0] - S.MARGIN_LEFT - S.MARGIN_RIGHT

    # Um único modelo de página: com a identificação da operadora no rodapé, todas as páginas
    # passaram a ter a mesma moldura. Antes havia dois modelos porque a carta da ANS não levava
    # o cabeçalho que as demais levavam.
    # Padding zerado de propósito: o Frame do ReportLab reserva 6pt de cada lado por padrão, o
    # que faria o conteúdo começar 6pt à direita da margem — desalinhado do rodapé, que é
    # desenhado direto no canvas a partir de MARGIN_LEFT. Com zero, as margens são de fato as
    # bordas do conteúdo e CONTENT_WIDTH corresponde à largura utilizável.
    frame = Frame(
        S.MARGIN_LEFT, S.MARGIN_BOTTOM, largura_util,
        S.PAGE_SIZE[1] - S.MARGIN_TOP - S.MARGIN_BOTTOM, id="corpo",
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )

    documento.addPageTemplates([
        PageTemplate(id="padrao", frames=[frame], onPage=_desenha_moldura),
    ])

    flowables = list(_pagina_carta(context))
    flowables.append(PageBreak())

    flowables.extend(_pagina_abertura(context))
    flowables.extend(_secao_questionario(context))
    flowables.extend(_pagina_declaracao(context))
    flowables.extend(_pagina_medico_orientador(context))
    flowables.extend(_pagina_parecer(context))
    flowables.extend(_pagina_cpt(context))

    documento.build(flowables)

    return buffer.getvalue()
