from flask import Blueprint, request, jsonify
from services.inclusion_responsibles_services import InclusionResponsiblesService

bp_inclusion_responsibles = Blueprint("bp_inclusion_responsibles", __name__)

@bp_inclusion_responsibles.route("/inclusion-responsibles", methods=['GET'])
def get_all():
    try:
        inclusion_responsibles = InclusionResponsiblesService.get_all()

        return jsonify([
            inclusion_responsible.to_dict()
            for inclusion_responsible in inclusion_responsibles
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

@bp_inclusion_responsibles.route("/inclusion-responsibles", methods=['POST'])
def create():
    try:
        data = request.get_json()

        inclusion_responsible = InclusionResponsiblesService.create(data)

        return jsonify(inclusion_responsible.to_dict()), 201
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500
