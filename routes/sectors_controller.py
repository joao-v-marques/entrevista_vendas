from flask import Blueprint, jsonify
from services.sectors_services import SectorService
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required

bp_sectors = Blueprint("bp_sectors", __name__)

# GET de todos cadastrados no sistema
@bp_sectors.route("/sectors", methods=['GET'])
@token_required
@role_required("administrator")
def get_all():
    try:
        sectors = SectorService.get_all()

        return jsonify([
            sector.to_dict()
            for sector in sectors
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
