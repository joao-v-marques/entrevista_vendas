"""
    Módulo de services para aprovação financeira.
    Após realizar o cadastro da ficha no sistema, deve passar por uma aprovação financeira.
"""

from models.application_forms_approvals import ApplicationFormApprovalModel, ApplicationFormApproval
from models.application_form_models import ApplicationFormModel
from models.users_models import UserModel
from utils.validations import to_id, to_bool
from utils.exceptions import AppError, ConflictError, NotFoundError, ValidationError

# a ficha só pode receber aprovação financeira enquanto estiver aguardando essa etapa
STATUS_AGUARDANDO_APROVACAO_FINANCEIRA = 1

class ApplicationFormApprovalService:
    def get_all():
        try:
            approval_forms = ApplicationFormApprovalModel.get_all()

            return approval_forms
        except Exception as e:
            raise Exception(str(e))

    def create(data):
        try:
            # Validação caso receba o payload vazio (Apenas para a API)
            if not data:
                raise ValidationError("Nenhum dado foi recebido para a aprovação financeira")

            application_form_id = to_id(data.get('application_form_id'), "formulário")

            application_form = ApplicationFormModel.get_by_id(application_form_id)

            if not application_form:
                raise NotFoundError("Ficha não encontrada")

            if application_form.form_status_id != STATUS_AGUARDANDO_APROVACAO_FINANCEIRA:
                raise ConflictError("Só é possível avaliar financeiramente fichas aguardando aprovação financeira")

            if data.get('financial_approved') is None:
                raise ValidationError("O campo financial_approved é obrigatório")

            financial_approved = to_bool(data['financial_approved'])

            financial_reviewer_id = to_id(data.get('financial_reviewer_id'), "revisor financeiro")

            if not UserModel.get_by_id(financial_reviewer_id):
                raise ValidationError("O revisor financeiro informado não existe")

            financial_reviewed_at = data.get('financial_reviewed_at')

            if not str(financial_reviewed_at or "").strip():
                raise ValidationError("A data de análise financeira é obrigatória")

            financial_observation = str(data.get('financial_observation') or "").strip() or None

            # reprovação sem justificativa deixa o consultor sem saber o motivo
            if not financial_approved and not financial_observation:
                raise ValidationError("A observação é obrigatória ao reprovar financeiramente a ficha")

            approve_form = ApplicationFormApproval(
                financial_approved=financial_approved,
                financial_reviewer_id=financial_reviewer_id,
                financial_reviewed_at=financial_reviewed_at,
                financial_observation=financial_observation,
                application_form_id=application_form_id
            )

            created_approve_form = ApplicationFormApprovalModel.create(approve_form)

            return created_approve_form
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))