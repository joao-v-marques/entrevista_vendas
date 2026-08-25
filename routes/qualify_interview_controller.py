from flask import Blueprint, jsonify, request
from services.qualify_interview import QualifyInterviewService

bp_qualify_interview = Blueprint("bp_qualify_interview", __name__)

@bp_qualify_interview.route("/qualify-interviews", methods=['GET'])
def get_all():
    try:
        qualify_interviews = QualifyInterviewService.get_all()

        return jsonify([
            qualify_interview.to_dict()
            for qualify_interview in qualify_interviews
        ])
    except Exception as e:
        return jsonify({
            "message": str(e)
        })

@bp_qualify_interview.route("/qualify-interviews", methods=['POST'])
def create():
    try:
        data = request.get_json()

        new_qualify_interview = QualifyInterviewService.create(data)

        return jsonify(new_qualify_interview.to_dict()), 201
    except ValueError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500