import re

from models.application_form_models import ApplicationFormModel
from models.inclusion_responsibles import InclusionResponsiblesModel, InclusionResponsibles
from services.users_services import normalize_cpf, texto_obrigatorio, to_id
from utils.exceptions import AppError, ConflictError, NotFoundError, ValidationError

# limites das colunas da tabela inclusion_responsibles
TAMANHO_MAXIMO_NAME = 255
TAMANHO_MAXIMO_MARITAL_STATE = 35
TAMANHO_MAXIMO_PROFISSAO = 155

class InclusionResponsiblesService:
    # GET de todos os responsáveis pela inclusão cadastrados no sistema
    def get_all():
        try:
            inclusion_responsibles = InclusionResponsiblesModel.get_all()

            return inclusion_responsibles
        except Exception as e:
            raise Exception(str(e))

    # POST de um responsável pela inclusão no sistema
    def create(data):
        try:
            # Validação caso receba o payload vazio (Apenas para a API)
            if not data:
                raise ValidationError("Nenhum dado foi recebido para o responsável pela inclusão")

            name = texto_obrigatorio(data.get("name"), "nome do responsável", TAMANHO_MAXIMO_NAME)

            # normalize_cpf devolve None quando o campo vem vazio: aqui o CPF é obrigatório
            cpf = normalize_cpf(data.get("cpf"))

            if not cpf:
                raise ValidationError("O CPF do responsável pela inclusão é obrigatório")

            marital_state = texto_obrigatorio(
                data.get("marital_state"), "estado civil do responsável", TAMANHO_MAXIMO_MARITAL_STATE
            )
            profession = texto_obrigatorio(
                data.get("profession"), "profissão do responsável", TAMANHO_MAXIMO_PROFISSAO
            )

            application_form_id = to_id(data.get("application_form_id"), "formulário")

            # sem esta checagem a FK da tabela recusaria o insert e o erro do banco voltaria como 500
            if not ApplicationFormModel.get_by_id(application_form_id):
                raise NotFoundError("Ficha não encontrada")

            # não existe unique constraint (o mesmo CPF pode ser responsável em outras fichas),
            # então a duplicidade dentro da mesma ficha só dá para barrar aqui. A comparação é
            # feita só com os dígitos porque o cadastro da ficha grava o CPF com máscara.
            responsibles = InclusionResponsiblesModel.get_by_application_form_id(application_form_id)

            for responsible in responsibles:
                if re.sub(r"\D", "", str(responsible.cpf or "")) == cpf:
                    raise ConflictError(
                        "Este CPF já está cadastrado como responsável pela inclusão nesta ficha"
                    )

            new_inclusion_responsible = InclusionResponsibles(
                name=name,
                cpf=cpf,
                marital_state=marital_state,
                profession=profession,
                application_form_id=application_form_id,
            )

            created_inclusion_responsible = InclusionResponsiblesModel.create(new_inclusion_responsible)

            return created_inclusion_responsible
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))
