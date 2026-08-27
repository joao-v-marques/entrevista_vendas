from models.qualify_interview import QualifyInterviewModel, QualifyInterview
from utils.exceptions import AppError, ValidationError

# Valores aceitos pelas constraints chk_escolha_medico_orientador e chk_parecer_unimed. Usada para tratamento de erro
ESCOLHAS_MEDICO_ORIENTADOR = ('medico_unimed', 'medico_proprio', 'dispensou_orientador')

PARECERES_UNIMED = (
    'sem_preexistencias',
    'com_preexistencias_aceitou_cpt',
    'com_preexistencias_recusou_cpt',
    'recusou_pericia_exames'
)

# Faixas espelhadas das constraints chk_peso_kg e chk_altura_cm. Também utilizada para tratamento de erro
PESO_KG_MAXIMO = 999.99
ALTURA_CM_MINIMA = 30
ALTURA_CM_MAXIMA = 300

def to_bool(value):
    if isinstance(value, bool):
        return value

    if value is None:
        return False

    return str(value).strip().lower() in ('true', '1', 'sim', 'on', 'yes')

# Campos numéricos chegam como int, float ou string dependendo do front
def to_number(value, field_name):
    if value is None or str(value).strip() == '':
        raise ValidationError(f"O campo {field_name} é obrigatório")

    try:
        return float(str(value).strip().replace(',', '.'))
    except ValueError:
        raise ValidationError(f"O campo {field_name} precisa ser um número válido")

def to_id(value, field_name):
    if value is None or str(value).strip() == '':
        raise ValidationError(f"O campo {field_name} é obrigatório")

    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"O campo {field_name} precisa ser um número inteiro válido")

class QualifyInterviewService:
    def get_all():
        try:
            qualify_interviews = QualifyInterviewModel.get_all()

            return qualify_interviews
        except Exception as e:
            raise Exception(str(e))

    # Valida o payload e monta o objeto QualifyInterview SEM tocar no banco.
    # A validação fica fora da transação de propósito: payload inválido é recusado antes de qualquer
    # conexão ser aberta, e a transação só nasce quando os dados já são sabidamente válidos, vivendo
    # o mínimo de tempo possível.
    # O application_form_interview_id não vem do payload: quem preenche é o orquestrador, com o id
    # devolvido pelo UPDATE da análise.
    def build(data, inserted_by):
        try:
            if not data:
                raise ValidationError("Nenhum dado foi recebido para a entrevista qualificada")

            # quem registra é o entrevistador logado, o mesmo que assina a análise da entrevista
            inserted_by = to_id(inserted_by, "usuário responsável")

            # Escolha do médico orientador
            escolha_medico_orientador = (data.get('escolha_medico_orientador') or '').strip()

            if not escolha_medico_orientador:
                raise ValidationError("A escolha do médico orientador é obrigatória")

            if escolha_medico_orientador not in ESCOLHAS_MEDICO_ORIENTADOR:
                raise ValidationError("Escolha de médico orientador inválida")

            # Parecer da Unimed sobre a declaração de saúde
            parecer_unimed = (data.get('parecer_unimed') or '').strip()

            if not parecer_unimed:
                raise ValidationError("O parecer da Unimed é obrigatório")

            if parecer_unimed not in PARECERES_UNIMED:
                raise ValidationError("Parecer da Unimed inválido")

            # Peso e altura: usados no cálculo do IMC, que não é armazenado
            peso_kg = to_number(data.get('peso_kg'), "peso")

            if peso_kg <= 0 or peso_kg > PESO_KG_MAXIMO:
                raise ValidationError(f"O peso precisa estar entre 0 e {PESO_KG_MAXIMO} kg")

            altura_cm = int(to_number(data.get('altura_cm'), "altura"))

            if altura_cm < ALTURA_CM_MINIMA or altura_cm > ALTURA_CM_MAXIMA:
                raise ValidationError(f"A altura precisa estar entre {ALTURA_CM_MINIMA} e {ALTURA_CM_MAXIMA} cm")

            # A observação vai para o contrato, então é opcional mas nunca string vazia
            observation = (data.get('observation') or '').strip() or None

            qualify_interview = QualifyInterview(
                # 1. Doenças infecciosas ou parasitárias
                is_hiv=to_bool(data.get('is_hiv')),
                is_chagas=to_bool(data.get('is_chagas')),
                is_hanseniase=to_bool(data.get('is_hanseniase')),
                is_meningite=to_bool(data.get('is_meningite')),
                is_tuberculose=to_bool(data.get('is_tuberculose')),
                is_hepatite=to_bool(data.get('is_hepatite')),

                # 2. Neoplasias malignas (câncer)
                is_aparelho_digestivo_cancer=to_bool(data.get('is_aparelho_digestivo_cancer')),
                is_aparelho_respiratorio_cancer=to_bool(data.get('is_aparelho_respiratorio_cancer')),
                is_leucemia=to_bool(data.get('is_leucemia')),
                is_linfoma=to_bool(data.get('is_linfoma')),
                is_mama_cancer=to_bool(data.get('is_mama_cancer')),
                is_genitais_femininos=to_bool(data.get('is_genitais_femininos')),
                is_genitais_masculinos=to_bool(data.get('is_genitais_masculinos')),
                is_pele=to_bool(data.get('is_pele')),
                is_tireoide=to_bool(data.get('is_tireoide')),
                is_trato_urinario_cancer=to_bool(data.get('is_trato_urinario_cancer')),

                # 3. Neoplasias benignas
                is_tireoide_benigna=to_bool(data.get('is_tireoide_benigna')),
                is_genitais_femininos_benigna=to_bool(data.get('is_genitais_femininos_benigna')),

                # 4. Doenças do sangue
                is_anemia=to_bool(data.get('is_anemia')),
                is_coagulacao_hemofilias=to_bool(data.get('is_coagulacao_hemofilias')),
                is_purpura=to_bool(data.get('is_purpura')),

                # 5. Doenças endócrinas e relacionadas
                is_diabetes=to_bool(data.get('is_diabetes')),
                is_tireoide_endocrina=to_bool(data.get('is_tireoide_endocrina')),
                is_hipofise=to_bool(data.get('is_hipofise')),
                is_suprarrenal=to_bool(data.get('is_suprarrenal')),
                peso_kg=peso_kg,
                altura_cm=altura_cm,

                # 6. Transtornos psiquiátricos, mentais ou de identidade sexual
                is_psicose_esquizofrenia=to_bool(data.get('is_psicose_esquizofrenia')),
                is_autismo=to_bool(data.get('is_autismo')),
                is_depressao=to_bool(data.get('is_depressao')),
                is_transtorno_identidade_sexual=to_bool(data.get('is_transtorno_identidade_sexual')),

                # 7. Doenças do sistema nervoso
                is_avc=to_bool(data.get('is_avc')),
                is_enxaqueca=to_bool(data.get('is_enxaqueca')),
                is_alzheimer=to_bool(data.get('is_alzheimer')),
                is_epilepsia=to_bool(data.get('is_epilepsia')),
                is_esclerose_multipla=to_bool(data.get('is_esclerose_multipla')),
                is_paralisia_cerebral=to_bool(data.get('is_paralisia_cerebral')),
                is_paralisias_polineuropatias=to_bool(data.get('is_paralisias_polineuropatias')),
                is_parkinson=to_bool(data.get('is_parkinson')),
                is_ame=to_bool(data.get('is_ame')),

                # 8. Doenças dos olhos e anexos
                is_alteracao_retina=to_bool(data.get('is_alteracao_retina')),
                is_astigmatismo=to_bool(data.get('is_astigmatismo')),
                is_catarata=to_bool(data.get('is_catarata')),
                is_ceratocone=to_bool(data.get('is_ceratocone')),
                is_estrabismo=to_bool(data.get('is_estrabismo')),
                is_glaucoma=to_bool(data.get('is_glaucoma')),
                is_hipermetropia=to_bool(data.get('is_hipermetropia')),
                is_miopia=to_bool(data.get('is_miopia')),
                is_transplante_cornea=to_bool(data.get('is_transplante_cornea')),
                is_pterigio=to_bool(data.get('is_pterigio')),
                is_retinopatia_diabetica=to_bool(data.get('is_retinopatia_diabetica')),
                is_presbiopia=to_bool(data.get('is_presbiopia')),

                # 9. Doenças do ouvido, nariz ou garganta
                is_diminuicao_audicao=to_bool(data.get('is_diminuicao_audicao')),
                is_hipertrofia_cornetos_amigdalas=to_bool(data.get('is_hipertrofia_cornetos_amigdalas')),
                is_labirintite=to_bool(data.get('is_labirintite')),
                is_rinite=to_bool(data.get('is_rinite')),
                is_sinusite=to_bool(data.get('is_sinusite')),
                is_problemas_adenoide=to_bool(data.get('is_problemas_adenoide')),

                # 10. Doenças do coração
                is_angina_pectoris=to_bool(data.get('is_angina_pectoris')),
                is_arritmia_cardiaca=to_bool(data.get('is_arritmia_cardiaca')),
                is_disfuncao_valvulas=to_bool(data.get('is_disfuncao_valvulas')),
                is_hipertensao_arterial=to_bool(data.get('is_hipertensao_arterial')),
                is_infarto_miocardio=to_bool(data.get('is_infarto_miocardio')),
                is_insuficiencia_cardiaca=to_bool(data.get('is_insuficiencia_cardiaca')),
                is_insuficiencia_coronariana=to_bool(data.get('is_insuficiencia_coronariana')),
                is_uso_marcapasso=to_bool(data.get('is_uso_marcapasso')),

                # 11. Doenças do sistema circulatório
                is_aneurismas=to_bool(data.get('is_aneurismas')),
                is_hemorroidas=to_bool(data.get('is_hemorroidas')),
                is_insuficiencia_arterial_periferica=to_bool(data.get('is_insuficiencia_arterial_periferica')),
                is_trombose_tromboflebite=to_bool(data.get('is_trombose_tromboflebite')),
                is_ulcera_perna=to_bool(data.get('is_ulcera_perna')),
                is_varizes=to_bool(data.get('is_varizes')),

                # 12. Doenças do sistema respiratório
                is_apneia_sono=to_bool(data.get('is_apneia_sono')),
                is_asma=to_bool(data.get('is_asma')),
                is_bronquiectasia=to_bool(data.get('is_bronquiectasia')),
                is_bronquite=to_bool(data.get('is_bronquite')),
                is_enfisema_dpoc=to_bool(data.get('is_enfisema_dpoc')),
                is_fibrose_pulmonar=to_bool(data.get('is_fibrose_pulmonar')),
                is_pneumonia=to_bool(data.get('is_pneumonia')),

                # 13. Doenças do sistema digestivo
                is_cirrose_hepatica=to_bool(data.get('is_cirrose_hepatica')),
                is_colelitiase=to_bool(data.get('is_colelitiase')),
                is_colite=to_bool(data.get('is_colite')),
                is_doenca_diverticular=to_bool(data.get('is_doenca_diverticular')),
                is_doencas_pancreas=to_bool(data.get('is_doencas_pancreas')),
                is_gastrite=to_bool(data.get('is_gastrite')),
                is_ulcera_peptica=to_bool(data.get('is_ulcera_peptica')),
                is_hepatite_digestiva=to_bool(data.get('is_hepatite_digestiva')),
                is_esteatose_hepatica=to_bool(data.get('is_esteatose_hepatica')),

                # 14. Hérnias
                is_hernia_inguinal=to_bool(data.get('is_hernia_inguinal')),
                is_hernia_hiato=to_bool(data.get('is_hernia_hiato')),
                is_hernia_umbilical=to_bool(data.get('is_hernia_umbilical')),
                is_hernia_epigastrica=to_bool(data.get('is_hernia_epigastrica')),
                is_hernia_incisional=to_bool(data.get('is_hernia_incisional')),

                # 15. Doenças da pele
                is_tumores_pele=to_bool(data.get('is_tumores_pele')),
                is_nodulos_cistos=to_bool(data.get('is_nodulos_cistos')),
                is_queloide=to_bool(data.get('is_queloide')),

                # 16. Doenças osteomusculares e/ou da coluna
                is_artrite=to_bool(data.get('is_artrite')),
                is_artrite_reumatoide=to_bool(data.get('is_artrite_reumatoide')),
                is_artrose=to_bool(data.get('is_artrose')),
                is_desvios_coluna=to_bool(data.get('is_desvios_coluna')),
                is_esclerodermia=to_bool(data.get('is_esclerodermia')),
                is_calos_osseos=to_bool(data.get('is_calos_osseos')),
                is_sequelas_fraturas=to_bool(data.get('is_sequelas_fraturas')),
                is_hernia_disco=to_bool(data.get('is_hernia_disco')),
                is_lupus=to_bool(data.get('is_lupus')),
                is_osteomielite=to_bool(data.get('is_osteomielite')),
                is_osteoporose=to_bool(data.get('is_osteoporose')),
                is_reumatismo=to_bool(data.get('is_reumatismo')),
                is_tendinite=to_bool(data.get('is_tendinite')),
                is_dores_coluna=to_bool(data.get('is_dores_coluna')),

                # 17. Doenças do aparelho urinário
                is_calculo_renal=to_bool(data.get('is_calculo_renal')),
                is_incontinencia_urinaria=to_bool(data.get('is_incontinencia_urinaria')),
                is_insuficiencia_renal=to_bool(data.get('is_insuficiencia_renal')),
                is_transplante_renal=to_bool(data.get('is_transplante_renal')),
                is_nefrite_nefrose=to_bool(data.get('is_nefrite_nefrose')),

                # 18. Doenças do aparelho genital feminino
                is_cisto_ovario=to_bool(data.get('is_cisto_ovario')),
                is_endometriose=to_bool(data.get('is_endometriose')),
                is_infertilidade_feminina=to_bool(data.get('is_infertilidade_feminina')),
                is_nodulo_mamario=to_bool(data.get('is_nodulo_mamario')),
                is_prolapso_uterino=to_bool(data.get('is_prolapso_uterino')),
                is_ruptura_perineal=to_bool(data.get('is_ruptura_perineal')),

                # 19. Doenças do aparelho genital masculino
                is_esterilidade=to_bool(data.get('is_esterilidade')),
                is_fimose=to_bool(data.get('is_fimose')),
                is_hiperplasia_prostata=to_bool(data.get('is_hiperplasia_prostata')),
                is_hipospadia=to_bool(data.get('is_hipospadia')),
                is_impotencia_sexual=to_bool(data.get('is_impotencia_sexual')),
                is_testiculo_alto=to_bool(data.get('is_testiculo_alto')),
                is_varicocele=to_bool(data.get('is_varicocele')),

                # 20. Doenças bucomaxilo
                is_micrognatia=to_bool(data.get('is_micrognatia')),
                is_prognatia=to_bool(data.get('is_prognatia')),
                is_alteracao_maxila=to_bool(data.get('is_alteracao_maxila')),
                is_alteracao_atm=to_bool(data.get('is_alteracao_atm')),
                is_ma_formacao_arcada_dentaria=to_bool(data.get('is_ma_formacao_arcada_dentaria')),
                is_uso_aparelho_ortodontico=to_bool(data.get('is_uso_aparelho_ortodontico')),

                # 21 a 27. Perguntas gerais
                is_traumatismos_fraturas=to_bool(data.get('is_traumatismos_fraturas')),
                is_sequelas_acidentes_congenitas=to_bool(data.get('is_sequelas_acidentes_congenitas')),
                is_cirurgia_previa=to_bool(data.get('is_cirurgia_previa')),
                is_internacao_tratamento_outro=to_bool(data.get('is_internacao_tratamento_outro')),
                is_radioterapia_quimioterapia_dialise=to_bool(data.get('is_radioterapia_quimioterapia_dialise')),
                is_indicacao_cirurgia_futura=to_bool(data.get('is_indicacao_cirurgia_futura')),
                is_protese_ortese=to_bool(data.get('is_protese_ortese')),

                # Parecer da Unimed, observação e vínculos
                escolha_medico_orientador=escolha_medico_orientador,
                parecer_unimed=parecer_unimed,
                observation=observation,
                application_form_interview_id=None,
                inserted_by=inserted_by
            )

            return qualify_interview
        except AppError:
            raise
        except Exception as e:
            raise Exception(str(e))
