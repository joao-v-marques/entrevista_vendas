from models.sectors_models import Sector, SectorModel
from utils.exceptions import AppError, ConflictError, NotFoundError, ValidationError
from utils.validations import required_text, to_bool


SECTOR_NAME_MAX_LENGTH = 155


class SectorService:
    @staticmethod
    def get_all():
        return SectorModel.get_all()

    @staticmethod
    def get_by_id(sector_id):
        sector = SectorModel.get_by_id(sector_id)
        if not sector:
            raise NotFoundError("Nenhum setor encontrado com o ID informado")
        return sector

    @staticmethod
    def create(data):
        try:
            if not isinstance(data, dict):
                raise ValidationError("Nenhum dado foi recebido para o setor")

            name = required_text(data.get("name"), "nome", SECTOR_NAME_MAX_LENGTH)

            if SectorModel.get_by_name(name):
                raise ConflictError("Já existe um setor cadastrado com esse nome")

            return SectorModel.create(Sector(name=name))
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))

    @staticmethod
    def update(sector_id, data):
        try:
            existing_sector = SectorModel.get_by_id(sector_id)
            if not existing_sector:
                raise NotFoundError("Nenhum setor encontrado com o ID informado")

            if not isinstance(data, dict):
                raise ValidationError("Nenhum dado foi recebido para o setor")

            name = required_text(data.get("name"), "nome", SECTOR_NAME_MAX_LENGTH)
            is_active = to_bool(data.get("is_active", existing_sector.is_active))
            sector_with_name = SectorModel.get_by_name(name)

            if sector_with_name and sector_with_name.id != sector_id:
                raise ConflictError("Já existe um setor cadastrado com esse nome")

            sector = Sector(id=sector_id, name=name, is_active=is_active)
            return SectorModel.update(sector)
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))

    @staticmethod
    def delete(sector_id):
        sector = SectorModel.get_by_id(sector_id)
        if not sector:
            raise NotFoundError("Nenhum setor encontrado com o ID informado")

        SectorModel.delete(sector_id)
