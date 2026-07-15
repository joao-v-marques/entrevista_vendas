from models.inclusion_responsibles import InclusionResponsiblesModel, InclusionResponsibles

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
            # VALIDAÇÕES AQUI

            new_inclusion_responsible = InclusionResponsibles(
                name=data.get("name"),
                cpf=data.get("cpf"),
                marital_state=data.get("marital_state"),
                profession=data.get("profession"),
                application_form_id=data.get("application_form_id"),
            )

            created_inclusion_responsible = InclusionResponsiblesModel.create(new_inclusion_responsible)

            return created_inclusion_responsible
        except Exception as e:
            raise Exception(str(e))
