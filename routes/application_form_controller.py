from flask import Blueprint, request, jsonify
from services.application_form_services import ApplicationFormService

bp_application_form = Blueprint("bp_application_form", __name__)

@bp_application_form.route("/application-forms", methods=['GET'])
def get_all():
    try:
        application_forms = ApplicationFormService.get_all()

        return jsonify([
            application_form.to_dict()
            for application_form in application_forms
        ]), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# GET de todos por status (USANDO QUERY PARAMS, VARIÁVEL É status_id)
@bp_application_form.route("/application-forms/status", methods=['GET'])
def get_by_status():
    status_id = request.args.get('status_id')
    
    if not status_id:
        raise ValueError("ID do status é inválido, verifique e tente novamente")

    try:
        application_forms = ApplicationFormService.get_by_status(status_id)

        return jsonify([
            application_form.to_dict()
            for application_form in application_forms
        ])
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


# GET agregado com TODOS os dados de um formulário (usado pela tela de visualização)
@bp_application_form.route("/application-forms/<int:application_form_id>/details", methods=['GET'])
def get_full_details(application_form_id):
    try:
        details = ApplicationFormService.get_full_details(application_form_id)

        return jsonify(details), 200
    except ValueError as e:
        return jsonify({
            "message": str(e)
        }), 404
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


@bp_application_form.route("/application-forms", methods=['POST'])
def create_form():
    try:
        data = request.get_json()

        application_form = ApplicationFormService.create_form(data)

        return jsonify(application_form.to_dict()), 201
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# POST ATÔMICO: cria o formulário e seus responsáveis pela inclusão em uma única
# transação, evitando o cadastro de um registro sem os demais obrigatórios.
@bp_application_form.route("/application-forms/complete", methods=['POST'])
def create_form_complete():
    try:
        data = request.get_json()

        application_form, responsibles = ApplicationFormService.create_form_with_responsibles(data)

        return jsonify({
            "form": application_form.to_dict(),
            "responsibles": [responsible.to_dict() for responsible in responsibles],
        }), 201
    except ValueError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# POST para solicitar reanálise financeira de uma ficha reprovada
@bp_application_form.route("/application-forms/<int:application_form_id>/request-reanalysis", methods=['POST'])
def request_reanalysis(application_form_id):
    try:
        ApplicationFormService.request_reanalysis(application_form_id)

        return jsonify({"message": "Reanálise solicitada com sucesso"}), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# POST para encerrar a negociação de uma ficha reprovada pelo financeiro
@bp_application_form.route("/application-forms/<int:application_form_id>/close-negotiation", methods=['POST'])
def close_negotiation(application_form_id):
    try:
        ApplicationFormService.close_negotiation(application_form_id)

        return jsonify({"message": "Negociação encerrada com sucesso"}), 200
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

# POST para finalizar o cadastro (status 5 -> 6. Finalizado)
@bp_application_form.route("/application-forms/<int:application_form_id>/finalize", methods=['POST'])
def finalize_registration(application_form_id):
    try:
        ApplicationFormService.finalize_registration(application_form_id)

        return jsonify({"message": "Cadastro finalizado com sucesso"}), 200
    except ValueError as e:
        return jsonify({
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500