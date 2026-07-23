from flask import Blueprint, jsonify
from services.sectors_services import SectorService

bp_sectors = Blueprint("bp_sectors", __name__)

# GET de todos cadastrados no sistema
@bp_sectors.route("/sectors", methods=['GET'])
def get_all():
    try:
        sectors = SectorService.get_all()

        return jsonify([
            sector.to_dict()
            for sector in sectors
        ])
    except Exception as e:
        return jsonify({
            "message": str(e)
        })