from models.sectors_models import SectorModel

class SectorService:
    # GET all
    def get_all():
        try:
            sectors = SectorModel.get_all()

            return sectors
        except Exception as e:
            raise Exception(str(e))