from models.roles_models import Role, RoleModel
from utils.exceptions import AppError, ConflictError, NotFoundError, ValidationError
from utils.validations import required_text, to_bool


ROLE_NAME_MAX_LENGTH = 155


class RoleService:
    @staticmethod
    def get_all():
        return RoleModel.get_all()

    @staticmethod
    def get_by_id(role_id):
        role = RoleModel.get_by_id(role_id)
        if not role:
            raise NotFoundError("Nenhum cargo encontrado com o ID informado")
        return role

    @staticmethod
    def create(data):
        try:
            if not isinstance(data, dict):
                raise ValidationError("Nenhum dado foi recebido para o cargo")

            name = required_text(data.get("name"), "nome", ROLE_NAME_MAX_LENGTH)
            description = str(data.get("description") or "").strip() or None

            if RoleModel.get_by_name(name):
                raise ConflictError("Já existe um cargo cadastrado com esse nome")

            return RoleModel.create(Role(name=name, description=description))
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))

    @staticmethod
    def update(role_id, data):
        try:
            existing_role = RoleModel.get_by_id(role_id)
            if not existing_role:
                raise NotFoundError("Nenhum cargo encontrado com o ID informado")

            if not isinstance(data, dict):
                raise ValidationError("Nenhum dado foi recebido para o cargo")

            name = required_text(data.get("name"), "nome", ROLE_NAME_MAX_LENGTH)
            description = str(data.get("description") or "").strip() or None
            is_active = to_bool(data.get("is_active", existing_role.is_active))
            role_with_name = RoleModel.get_by_name(name)

            if role_with_name and role_with_name.id != role_id:
                raise ConflictError("Já existe um cargo cadastrado com esse nome")

            role = Role(
                id=role_id,
                name=name,
                description=description,
                is_active=is_active
            )
            return RoleModel.update(role)
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))

    @staticmethod
    def deactivate(role_id):
        try:
            role = RoleModel.get_by_id(role_id)
            if not role:
                raise NotFoundError("Nenhum cargo encontrado com o ID informado")

            RoleModel.deactivate(role_id)
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))

    @staticmethod
    def reactivate(role_id):
        try:
            role = RoleModel.get_by_id(role_id)
            if not role:
                raise NotFoundError("Nenhum cargo encontrado com o ID informado")

            RoleModel.reactivate(role_id)
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))