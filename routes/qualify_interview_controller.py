from flask import Blueprint, jsonify
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

# Não existe POST de entrevista qualificada: ela nunca é gravada sozinha.
# A gravação acontece junto com a análise da entrevista, na mesma transação, em
# PUT /application-form-interviews (services/application_form_interviews.py).
