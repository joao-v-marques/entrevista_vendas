import re
import unicodedata
from datetime import date, datetime, timezone
from utils.exceptions import AppError, ConflictError, NotFoundError, ValidationError

from models.application_form_documents import ApplicationFormDocumentModel
from models.application_form_interviews import ApplicationFormInterviewModel
from models.application_form_models import ApplicationFormModel
from services.application_form_documents_services import ApplicationFormDocumentService, MAX_TOTAL_SIZE_BYTES
from services.application_form_services import ApplicationFormService
from utils.qualify_interview_questions import QUALIFY_INTERVIEW_GROUPS, QUALIFY_INTERVIEW_QUESTIONS

LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

VAZIO = ""


def _texto(value):
    if value is None or str(value).strip() == "":
        return VAZIO
    return str(value).strip()


def _data(value):
    if isinstance(value, (datetime, date)):
        return value.strftime("%d/%m/%Y")
    return _texto(value)


def _data_hora(value):
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y às %H:%M")
    return _data(value)


def _cpf(value):
    digitos = re.sub(r"\D", "", str(value or ""))
    if len(digitos) != 11:
        return _texto(value)
    return "%s.%s.%s-%s" % (digitos[:3], digitos[3:6], digitos[6:9], digitos[9:])


def _numero(value):
    if value is None or str(value).strip() == "":
        return VAZIO
    return str(value).replace(".", ",")


# A idade não é armazenada; o documento pede, e a data de nascimento permite derivar.
# Vai em anos e meses completos, separados por "\n": a coluna de resposta é estreita e o
# renderizador troca a quebra por <br/>, deixando os meses na linha de baixo.
def _idade(nascimento, referencia):
    if not isinstance(nascimento, (datetime, date)):
        return VAZIO

    if isinstance(nascimento, datetime):
        nascimento = nascimento.date()

    total_meses = (referencia.year - nascimento.year) * 12 + (referencia.month - nascimento.month)
    if referencia.day < nascimento.day:
        total_meses -= 1

    if total_meses < 0:
        return VAZIO

    anos, meses = divmod(total_meses, 12)

    return "%d %s\n%d %s" % (
        anos, "ano" if anos == 1 else "anos",
        meses, "mês" if meses == 1 else "meses",
    )


# mesmas faixas do documento e do modal de análise
def _classifica_imc(imc):
    if imc < 18.5:
        return "Abaixo do peso"
    if imc < 25:
        return "Normal"
    if imc < 30:
        return "Sobrepeso"
    if imc < 35:
        return "Obesidade Grau I"
    if imc < 40:
        return "Obesidade Grau II"
    return "Obesidade Grau III"


def _imc(peso_kg, altura_cm):
    try:
        peso = float(peso_kg)
        altura = float(altura_cm)
    except (TypeError, ValueError):
        return VAZIO

    if peso <= 0 or altura <= 0:
        return VAZIO

    altura_m = altura / 100
    imc = peso / (altura_m * altura_m)

    return "%s — %s" % (("%.1f" % imc).replace(".", ","), _classifica_imc(imc))


# o rótulo da tela é uma pergunta ("Osteoporose?"); na lista da CPT ele vira o nome da doença
def _nome_doenca(label):
    return (label or "").strip().rstrip("?").strip() + "."


def _slug(value):
    normalizado = unicodedata.normalize("NFKD", value or "sem_nome").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-zA-Z0-9]+", "_", normalizado).strip("_").lower()


class InterviewDocumentService:
    # Recebe de volta o documento da entrevista depois de assinado pelo beneficiário. É só registro:
    # nenhuma etapa do fluxo depende dele. Um novo envio não apaga o anterior, a tela considera o
    # mais recente como o atual.
    @staticmethod
    def upload_signed_document(application_form_id, files):
        saved_paths = []
        try:
            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise NotFoundError("Ficha não encontrada")

            interview = ApplicationFormInterviewModel.get_by_application_form_id(application_form_id)

            if not interview or not interview.interview_reviewed_at:
                raise ConflictError("A entrevista desta ficha ainda não foi analisada")

            valid_files = ApplicationFormDocumentService.validate_files(
                files, allowed_extensions=(".pdf",), max_files=1, max_total_size_bytes=MAX_TOTAL_SIZE_BYTES
            )

            if not valid_files:
                raise ValidationError("Anexe o documento assinado em PDF")

            # a extensão sozinha não garante nada: confere o cabeçalho para barrar arquivo renomeado
            signed_file = valid_files[0]
            header = signed_file.stream.read(5)
            signed_file.stream.seek(0)

            if header != b"%PDF-":
                raise ValidationError("O arquivo enviado não é um PDF válido")

            documents, saved_paths = ApplicationFormDocumentService.save_files(
                application_form_id, application_form.beneficiary_name, valid_files
            )

            for document in documents:
                document.document_type = "entrevista_assinada"

            created_documents = ApplicationFormDocumentModel.create(documents)

            return created_documents[0]
        except AppError:
            ApplicationFormDocumentService.delete_files(saved_paths)
            raise
        except Exception as e:
            ApplicationFormDocumentService.delete_files(saved_paths)
            raise Exception(str(e))

    # Monta tudo o que o PDF precisa a partir do /details, que já reúne ficha, entrevista,
    # responsáveis e entrevista qualificada numa consulta só.
    @staticmethod
    def build_context(application_form_id):
        details = ApplicationFormService.get_full_details(application_form_id)

        form = details.get("form") or {}
        interview = details.get("interview") or {}
        qualify = details.get("qualify_interview") or {}

        if not interview:
            raise NotFoundError("Esta ficha não possui entrevista registrada")

        if not interview.get("interview_reviewed_at"):
            raise ConflictError("A entrevista desta ficha ainda não foi analisada")

        if not qualify:
            raise ConflictError("Esta entrevista não possui entrevista qualificada registrada")

        # Trava contra divergência entre o questionário em Python e as colunas da tabela: uma
        # pergunta ausente aqui viraria uma doença omitida em silêncio num documento assinado.
        ausentes = [item["key"] for item in QUALIFY_INTERVIEW_QUESTIONS if item["key"] not in qualify]
        if ausentes:
            raise Exception(
                "O questionário do documento está fora de sincronia com o banco. "
                "Perguntas sem coluna correspondente: %s" % ", ".join(ausentes[:5])
            )

        emitido_em = datetime.now(timezone.utc).astimezone()
        nome = _texto(form.get("beneficiary_name"))

        questionario = InterviewDocumentService._build_questionario(qualify, form, emitido_em.date())

        return {
            "emitido_em": emitido_em.strftime("%d/%m/%Y às %H:%M"),
            "data_extenso": emitido_em.strftime("%d/%m/%Y"),
            "ficha_id": form.get("id"),
            "nome_arquivo": "entrevista_qualificada_%s_%s_%s.pdf" % (
                _slug(nome), form.get("id"), emitido_em.strftime("%Y%m%d"),
            ),

            # cabeçalho repetido nas páginas da declaração
            "proponente": nome,
            # o documento chama de "Nº do contrato" o que a ficha guarda como modelo da proposta
            "numero_contrato": _texto(form.get("model_proposal")),
            "representante_legal": _texto(form.get("secondary_beneficiary_primary_name")),
            "cpf": _cpf(form.get("beneficiary_cpf")),

            "beneficiario": {
                "nome": nome,
                "cpf": _cpf(form.get("beneficiary_cpf")),
                "nascimento": _data(form.get("beneficiary_birth_date")),
                "idade": _idade(form.get("beneficiary_birth_date"), emitido_em.date()),
            },

            "entrevista": {
                # o intermediário entre operadora e beneficiário é o colaborador de vendas que
                # lançou a ficha, não quem conduziu a entrevista: nome e CPF vão preenchidos no
                # bloco de assinatura do intermediário
                "intermediario": _texto(form.get("consultant_name")),
                "intermediario_cpf": _cpf(form.get("consultant_cpf")),
                "consultor": _texto(form.get("consultant_name")),
                "data": _data_hora(interview.get("interview_date")),
                "analisada_em": _data_hora(interview.get("interview_reviewed_at")),
                "aprovada": bool(interview.get("interview_approved")),
            },

            "declaracao": {
                # chaves cruas: o renderizador marca o "( X )" na opção correspondente
                "escolha_medico_orientador": qualify.get("escolha_medico_orientador"),
                "parecer_unimed": qualify.get("parecer_unimed"),
                # observação da análise da entrevista: vai no campo "Observações" do parecer
                "observacao_parecer": _texto(interview.get("interview_observation")),
                # comentários do beneficiário sobre as perguntas: vão na caixa logo após o questionário
                "comentarios_beneficiario": _texto(qualify.get("beneficiary_comments")),
                "registrado_por": _texto(qualify.get("inserted_by_name")),
                "registrado_em": _data_hora(qualify.get("created_at")),
            },

            "questionario": questionario,
            "total_perguntas": len(QUALIFY_INTERVIEW_QUESTIONS),
            "doencas_declaradas": InterviewDocumentService._doencas_declaradas(qualify),
        }

    # Achata os 27 grupos no formato que o renderizador desenha direto: cada linha já vem com a
    # letra, o enunciado do documento e a resposta resolvida.
    @staticmethod
    def _build_questionario(qualify, form, hoje):
        grupos = []

        for group in QUALIFY_INTERVIEW_GROUPS:
            linhas = []

            for indice, item in enumerate(group["items"]):
                tipo = item.get("type")

                if tipo == "measure":
                    resposta = _numero(qualify.get(item["key"]))
                elif tipo == "computed":
                    resposta = _idade(form.get("beneficiary_birth_date"), hoje)
                elif tipo == "imc":
                    resposta = _imc(qualify.get("peso_kg"), qualify.get("altura_cm"))
                else:
                    resposta = "SIM" if qualify.get(item["key"]) is True else "NÃO"

                linhas.append({
                    "letra": LETRAS[indice] if indice < len(LETRAS) else "",
                    "texto": item["document_label"],
                    "resposta": resposta,
                    "declarada": tipo is None and qualify.get(item["key"]) is True,
                    "tipo": tipo,
                })

            grupos.append({
                "numero": group["number"],
                "titulo": group["document_title"],
                "linhas": linhas,
            })

        return grupos

    # lista usada na página de aceitação da CPT, onde as doenças declaradas são relacionadas
    @staticmethod
    def _doencas_declaradas(qualify):
        especificacoes = InterviewDocumentService._especificacoes(qualify.get("observation"))

        return [
            {
                "doenca": _nome_doenca(item["label"]),
                "especificacao": especificacoes.get(item["key"], ""),
            }
            for item in QUALIFY_INTERVIEW_QUESTIONS
            if qualify.get(item["key"]) is True
        ]

    # As especificações por pergunta são digitadas no modal de análise e guardadas na observação
    # da entrevista qualificada, uma por linha, no formato "<rótulo da tela>: <texto>" — ver
    # updateObservationLine em static/js/analyzeInterviewModals/analyzeInterviewModal.js.
    # Aqui o caminho é desfeito para reassociar cada texto à sua pergunta.
    #
    # O casamento usa o rótulo da TELA (item["label"]), que é o que o modal grava, e não o
    # enunciado do documento. A comparação é por prefixo, igual à do modal, para não depender de
    # onde cai o primeiro ":" — vários enunciados têm pontuação no meio.
    @staticmethod
    def _especificacoes(observacao):
        if not observacao:
            return {}

        linhas = [l.strip() for l in str(observacao).replace("\r\n", "\n").split("\n") if l.strip()]
        if not linhas:
            return {}

        encontradas = {}
        for item in QUALIFY_INTERVIEW_QUESTIONS:
            rotulo = item.get("label")
            if not rotulo:
                continue

            prefixo = "%s:" % rotulo
            for linha in linhas:
                if linha.startswith(prefixo):
                    texto = linha[len(prefixo):].strip()
                    if texto:
                        encontradas[item["key"]] = texto
                    break

        return encontradas
