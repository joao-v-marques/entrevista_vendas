from models.roles_models import RoleModel

class RoleService:
    def get_all():
        try:
            roles = RoleModel.get_all()

            return roles
        except Exception as e:
            raise Exception(str(e))