from models.application_forms_approvals import ApplicationFormApprovalModel, ApplicationFormApproval

class ApplicationFormApprovalService:
    def get_all():
        try:
            approval_forms = ApplicationFormApprovalModel.get_all()

            return approval_forms
        except Exception as e:
            raise Exception(str(e))
        
    def create(data):
        try:
            # ! COLOCAR VALIDAÇÕES NOS CAMPOS AQUI

            approve_form = ApplicationFormApproval(
                financial_approved=data['financial_approved'],
                financial_reviewer_id=data['financial_reviewer_id'],
                financial_reviewed_at=data['financial_reviewed_at'],
                financial_observation=data['financial_observation'],
                application_form_id=data['application_form_id']
            )

            created_approve_form = ApplicationFormApprovalModel.create(approve_form)

            return created_approve_form
        except Exception as e:
            raise Exception(str(e))