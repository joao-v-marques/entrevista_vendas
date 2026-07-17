from models.application_forms_approvals import ApplicationFormApprovalModel

class ApplicationFormApprovalService:
    def get_all():
        try:
            approval_forms = ApplicationFormApprovalModel.get_all()

            return approval_forms
        except Exception as e:
            raise Exception(str(e))