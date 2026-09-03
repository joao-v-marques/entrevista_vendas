from flask import Blueprint, jsonify, request
from middlewares.jwt_middleware import token_required
from middlewares.permissions import role_required
from services.sectors_services import SectorService
from utils.exceptions import ConflictError, NotFoundError, ValidationError


bp_sectors = Blueprint("bp_sectors", __name__)


@bp_sectors.route("/sectors", methods=["GET"])
@token_required
@role_required("administrator")
def get_all():
    try:
        return jsonify([sector.to_dict() for sector in SectorService.get_all()]), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@bp_sectors.route("/sectors/<int:sector_id>", methods=["GET"])
@token_required
@role_required("administrator")
def get_by_id(sector_id):
    try:
        return jsonify(SectorService.get_by_id(sector_id).to_dict()), 200
    except NotFoundError as e:
        return jsonify({"message": str(e)}), 404
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@bp_sectors.route("/sectors", methods=["POST"])
@token_required
@role_required("administrator")
def create():
    try:
        sector = SectorService.create(request.get_json(silent=True))
        return jsonify(sector.to_dict()), 201
    except ValidationError as e:
        return jsonify({"message": str(e)}), 400
    except ConflictError as e:
        return jsonify({"message": str(e)}), 409
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@bp_sectors.route("/sectors/<int:sector_id>", methods=["PUT"])
@token_required
@role_required("administrator")
def update(sector_id):
    try:
        sector = SectorService.update(sector_id, request.get_json(silent=True))
        return jsonify(sector.to_dict()), 200
    except ValidationError as e:
        return jsonify({"message": str(e)}), 400
    except NotFoundError as e:
        return jsonify({"message": str(e)}), 404
    except ConflictError as e:
        return jsonify({"message": str(e)}), 409
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@bp_sectors.route("/sectors/<int:sector_id>", methods=["DELETE"])
@token_required
@role_required("administrator")
def delete(sector_id):
    try:
        SectorService.delete(sector_id)
        return jsonify({"message": "Setor desativado com sucesso"}), 200
    except NotFoundError as e:
        return jsonify({"message": str(e)}), 404
    except Exception as e:
        return jsonify({"message": str(e)}), 500
