from database.connect_db import get_db_connection

class QualifyInterview:
    def __init__(self, application_form_interview_id, inserted_by, escolha_medico_orientador, parecer_unimed, peso_kg, altura_cm,
                 # 1. Doenças infecciosas ou parasitárias
                 is_hiv=False, is_chagas=False, is_hanseniase=False, is_meningite=False, is_tuberculose=False, is_hepatite=False,
                 # 2. Neoplasias malignas (câncer)
                 is_aparelho_digestivo_cancer=False, is_aparelho_respiratorio_cancer=False, is_leucemia=False, is_linfoma=False,
                 is_mama_cancer=False, is_genitais_femininos=False, is_genitais_masculinos=False, is_pele=False,
                 is_tireoide=False, is_trato_urinario_cancer=False,
                 # 3. Neoplasias benignas
                 is_tireoide_benigna=False, is_genitais_femininos_benigna=False,
                 # 4. Doenças do sangue
                 is_anemia=False, is_coagulacao_hemofilias=False, is_purpura=False,
                 # 5. Doenças endócrinas e relacionadas
                 is_diabetes=False, is_tireoide_endocrina=False, is_hipofise=False, is_suprarrenal=False,
                 # 6. Transtornos psiquiátricos, mentais ou de identidade sexual
                 is_psicose_esquizofrenia=False, is_autismo=False, is_depressao=False, is_transtorno_identidade_sexual=False,
                 # 7. Doenças do sistema nervoso
                 is_avc=False, is_enxaqueca=False, is_alzheimer=False, is_epilepsia=False, is_esclerose_multipla=False,
                 is_paralisia_cerebral=False, is_paralisias_polineuropatias=False, is_parkinson=False, is_ame=False,
                 # 8. Doenças dos olhos e anexos
                 is_alteracao_retina=False, is_astigmatismo=False, is_catarata=False, is_ceratocone=False, is_estrabismo=False,
                 is_glaucoma=False, is_hipermetropia=False, is_miopia=False, is_transplante_cornea=False, is_pterigio=False,
                 is_retinopatia_diabetica=False, is_presbiopia=False,
                 # 9. Doenças do ouvido, nariz ou garganta
                 is_diminuicao_audicao=False, is_hipertrofia_cornetos_amigdalas=False, is_labirintite=False, is_rinite=False,
                 is_sinusite=False, is_problemas_adenoide=False,
                 # 10. Doenças do coração
                 is_angina_pectoris=False, is_arritmia_cardiaca=False, is_disfuncao_valvulas=False, is_hipertensao_arterial=False,
                 is_infarto_miocardio=False, is_insuficiencia_cardiaca=False, is_insuficiencia_coronariana=False, is_uso_marcapasso=False,
                 # 11. Doenças do sistema circulatório
                 is_aneurismas=False, is_hemorroidas=False, is_insuficiencia_arterial_periferica=False,
                 is_trombose_tromboflebite=False, is_ulcera_perna=False, is_varizes=False,
                 # 12. Doenças do sistema respiratório
                 is_apneia_sono=False, is_asma=False, is_bronquiectasia=False, is_bronquite=False, is_enfisema_dpoc=False,
                 is_fibrose_pulmonar=False, is_pneumonia=False,
                 # 13. Doenças do sistema digestivo
                 is_cirrose_hepatica=False, is_colelitiase=False, is_colite=False, is_doenca_diverticular=False,
                 is_doencas_pancreas=False, is_gastrite=False, is_ulcera_peptica=False, is_hepatite_digestiva=False,
                 is_esteatose_hepatica=False,
                 # 14. Hérnias
                 is_hernia_inguinal=False, is_hernia_hiato=False, is_hernia_umbilical=False, is_hernia_epigastrica=False,
                 is_hernia_incisional=False,
                 # 15. Doenças da pele
                 is_tumores_pele=False, is_nodulos_cistos=False, is_queloide=False,
                 # 16. Doenças osteomusculares e/ou da coluna
                 is_artrite=False, is_artrite_reumatoide=False, is_artrose=False, is_desvios_coluna=False, is_esclerodermia=False,
                 is_calos_osseos=False, is_sequelas_fraturas=False, is_hernia_disco=False, is_lupus=False, is_osteomielite=False,
                 is_osteoporose=False, is_reumatismo=False, is_tendinite=False, is_dores_coluna=False,
                 # 17. Doenças do aparelho urinário
                 is_calculo_renal=False, is_incontinencia_urinaria=False, is_insuficiencia_renal=False,
                 is_transplante_renal=False, is_nefrite_nefrose=False,
                 # 18. Doenças do aparelho genital feminino
                 is_cisto_ovario=False, is_endometriose=False, is_infertilidade_feminina=False, is_nodulo_mamario=False,
                 is_prolapso_uterino=False, is_ruptura_perineal=False,
                 # 19. Doenças do aparelho genital masculino
                 is_esterilidade=False, is_fimose=False, is_hiperplasia_prostata=False, is_hipospadia=False,
                 is_impotencia_sexual=False, is_testiculo_alto=False, is_varicocele=False,
                 # 20. Doenças bucomaxilo
                 is_micrognatia=False, is_prognatia=False, is_alteracao_maxila=False, is_alteracao_atm=False,
                 is_ma_formacao_arcada_dentaria=False, is_uso_aparelho_ortodontico=False,
                 # 21 a 27. Perguntas gerais
                 is_traumatismos_fraturas=False, is_sequelas_acidentes_congenitas=False, is_cirurgia_previa=False,
                 is_internacao_tratamento_outro=False, is_radioterapia_quimioterapia_dialise=False,
                 is_indicacao_cirurgia_futura=False, is_protese_ortese=False,
                 observation=None, id=None, created_at=None):
        # 1. Doenças infecciosas ou parasitárias
        self.is_hiv = is_hiv
        self.is_chagas = is_chagas
        self.is_hanseniase = is_hanseniase
        self.is_meningite = is_meningite
        self.is_tuberculose = is_tuberculose
        self.is_hepatite = is_hepatite

        # 2. Neoplasias malignas (câncer)
        self.is_aparelho_digestivo_cancer = is_aparelho_digestivo_cancer
        self.is_aparelho_respiratorio_cancer = is_aparelho_respiratorio_cancer
        self.is_leucemia = is_leucemia
        self.is_linfoma = is_linfoma
        self.is_mama_cancer = is_mama_cancer
        self.is_genitais_femininos = is_genitais_femininos
        self.is_genitais_masculinos = is_genitais_masculinos
        self.is_pele = is_pele
        self.is_tireoide = is_tireoide
        self.is_trato_urinario_cancer = is_trato_urinario_cancer

        # 3. Neoplasias benignas
        self.is_tireoide_benigna = is_tireoide_benigna
        self.is_genitais_femininos_benigna = is_genitais_femininos_benigna

        # 4. Doenças do sangue
        self.is_anemia = is_anemia
        self.is_coagulacao_hemofilias = is_coagulacao_hemofilias
        self.is_purpura = is_purpura

        # 5. Doenças endócrinas e relacionadas
        self.is_diabetes = is_diabetes
        self.is_tireoide_endocrina = is_tireoide_endocrina
        self.is_hipofise = is_hipofise
        self.is_suprarrenal = is_suprarrenal
        self.peso_kg = peso_kg
        self.altura_cm = altura_cm

        # 6. Transtornos psiquiátricos, mentais ou de identidade sexual
        self.is_psicose_esquizofrenia = is_psicose_esquizofrenia
        self.is_autismo = is_autismo
        self.is_depressao = is_depressao
        self.is_transtorno_identidade_sexual = is_transtorno_identidade_sexual

        # 7. Doenças do sistema nervoso
        self.is_avc = is_avc
        self.is_enxaqueca = is_enxaqueca
        self.is_alzheimer = is_alzheimer
        self.is_epilepsia = is_epilepsia
        self.is_esclerose_multipla = is_esclerose_multipla
        self.is_paralisia_cerebral = is_paralisia_cerebral
        self.is_paralisias_polineuropatias = is_paralisias_polineuropatias
        self.is_parkinson = is_parkinson
        self.is_ame = is_ame

        # 8. Doenças dos olhos e anexos
        self.is_alteracao_retina = is_alteracao_retina
        self.is_astigmatismo = is_astigmatismo
        self.is_catarata = is_catarata
        self.is_ceratocone = is_ceratocone
        self.is_estrabismo = is_estrabismo
        self.is_glaucoma = is_glaucoma
        self.is_hipermetropia = is_hipermetropia
        self.is_miopia = is_miopia
        self.is_transplante_cornea = is_transplante_cornea
        self.is_pterigio = is_pterigio
        self.is_retinopatia_diabetica = is_retinopatia_diabetica
        self.is_presbiopia = is_presbiopia

        # 9. Doenças do ouvido, nariz ou garganta
        self.is_diminuicao_audicao = is_diminuicao_audicao
        self.is_hipertrofia_cornetos_amigdalas = is_hipertrofia_cornetos_amigdalas
        self.is_labirintite = is_labirintite
        self.is_rinite = is_rinite
        self.is_sinusite = is_sinusite
        self.is_problemas_adenoide = is_problemas_adenoide

        # 10. Doenças do coração
        self.is_angina_pectoris = is_angina_pectoris
        self.is_arritmia_cardiaca = is_arritmia_cardiaca
        self.is_disfuncao_valvulas = is_disfuncao_valvulas
        self.is_hipertensao_arterial = is_hipertensao_arterial
        self.is_infarto_miocardio = is_infarto_miocardio
        self.is_insuficiencia_cardiaca = is_insuficiencia_cardiaca
        self.is_insuficiencia_coronariana = is_insuficiencia_coronariana
        self.is_uso_marcapasso = is_uso_marcapasso

        # 11. Doenças do sistema circulatório
        self.is_aneurismas = is_aneurismas
        self.is_hemorroidas = is_hemorroidas
        self.is_insuficiencia_arterial_periferica = is_insuficiencia_arterial_periferica
        self.is_trombose_tromboflebite = is_trombose_tromboflebite
        self.is_ulcera_perna = is_ulcera_perna
        self.is_varizes = is_varizes

        # 12. Doenças do sistema respiratório
        self.is_apneia_sono = is_apneia_sono
        self.is_asma = is_asma
        self.is_bronquiectasia = is_bronquiectasia
        self.is_bronquite = is_bronquite
        self.is_enfisema_dpoc = is_enfisema_dpoc
        self.is_fibrose_pulmonar = is_fibrose_pulmonar
        self.is_pneumonia = is_pneumonia

        # 13. Doenças do sistema digestivo
        self.is_cirrose_hepatica = is_cirrose_hepatica
        self.is_colelitiase = is_colelitiase
        self.is_colite = is_colite
        self.is_doenca_diverticular = is_doenca_diverticular
        self.is_doencas_pancreas = is_doencas_pancreas
        self.is_gastrite = is_gastrite
        self.is_ulcera_peptica = is_ulcera_peptica
        self.is_hepatite_digestiva = is_hepatite_digestiva
        self.is_esteatose_hepatica = is_esteatose_hepatica

        # 14. Hérnias
        self.is_hernia_inguinal = is_hernia_inguinal
        self.is_hernia_hiato = is_hernia_hiato
        self.is_hernia_umbilical = is_hernia_umbilical
        self.is_hernia_epigastrica = is_hernia_epigastrica
        self.is_hernia_incisional = is_hernia_incisional

        # 15. Doenças da pele
        self.is_tumores_pele = is_tumores_pele
        self.is_nodulos_cistos = is_nodulos_cistos
        self.is_queloide = is_queloide

        # 16. Doenças osteomusculares e/ou da coluna
        self.is_artrite = is_artrite
        self.is_artrite_reumatoide = is_artrite_reumatoide
        self.is_artrose = is_artrose
        self.is_desvios_coluna = is_desvios_coluna
        self.is_esclerodermia = is_esclerodermia
        self.is_calos_osseos = is_calos_osseos
        self.is_sequelas_fraturas = is_sequelas_fraturas
        self.is_hernia_disco = is_hernia_disco
        self.is_lupus = is_lupus
        self.is_osteomielite = is_osteomielite
        self.is_osteoporose = is_osteoporose
        self.is_reumatismo = is_reumatismo
        self.is_tendinite = is_tendinite
        self.is_dores_coluna = is_dores_coluna

        # 17. Doenças do aparelho urinário
        self.is_calculo_renal = is_calculo_renal
        self.is_incontinencia_urinaria = is_incontinencia_urinaria
        self.is_insuficiencia_renal = is_insuficiencia_renal
        self.is_transplante_renal = is_transplante_renal
        self.is_nefrite_nefrose = is_nefrite_nefrose

        # 18. Doenças do aparelho genital feminino
        self.is_cisto_ovario = is_cisto_ovario
        self.is_endometriose = is_endometriose
        self.is_infertilidade_feminina = is_infertilidade_feminina
        self.is_nodulo_mamario = is_nodulo_mamario
        self.is_prolapso_uterino = is_prolapso_uterino
        self.is_ruptura_perineal = is_ruptura_perineal

        # 19. Doenças do aparelho genital masculino
        self.is_esterilidade = is_esterilidade
        self.is_fimose = is_fimose
        self.is_hiperplasia_prostata = is_hiperplasia_prostata
        self.is_hipospadia = is_hipospadia
        self.is_impotencia_sexual = is_impotencia_sexual
        self.is_testiculo_alto = is_testiculo_alto
        self.is_varicocele = is_varicocele

        # 20. Doenças bucomaxilo
        self.is_micrognatia = is_micrognatia
        self.is_prognatia = is_prognatia
        self.is_alteracao_maxila = is_alteracao_maxila
        self.is_alteracao_atm = is_alteracao_atm
        self.is_ma_formacao_arcada_dentaria = is_ma_formacao_arcada_dentaria
        self.is_uso_aparelho_ortodontico = is_uso_aparelho_ortodontico

        # 21 a 27. Perguntas gerais
        self.is_traumatismos_fraturas = is_traumatismos_fraturas
        self.is_sequelas_acidentes_congenitas = is_sequelas_acidentes_congenitas
        self.is_cirurgia_previa = is_cirurgia_previa
        self.is_internacao_tratamento_outro = is_internacao_tratamento_outro
        self.is_radioterapia_quimioterapia_dialise = is_radioterapia_quimioterapia_dialise
        self.is_indicacao_cirurgia_futura = is_indicacao_cirurgia_futura
        self.is_protese_ortese = is_protese_ortese

        self.escolha_medico_orientador = escolha_medico_orientador
        self.parecer_unimed = parecer_unimed
        self.observation = observation
        self.application_form_interview_id = application_form_interview_id
        self.inserted_by = inserted_by
        self.id = id
        self.created_at = created_at

    def to_dict(self):
        return {
            "id": self.id,

            # 1. Doenças infecciosas ou parasitárias
            "is_hiv": self.is_hiv,
            "is_chagas": self.is_chagas,
            "is_hanseniase": self.is_hanseniase,
            "is_meningite": self.is_meningite,
            "is_tuberculose": self.is_tuberculose,
            "is_hepatite": self.is_hepatite,

            # 2. Neoplasias malignas (câncer)
            "is_aparelho_digestivo_cancer": self.is_aparelho_digestivo_cancer,
            "is_aparelho_respiratorio_cancer": self.is_aparelho_respiratorio_cancer,
            "is_leucemia": self.is_leucemia,
            "is_linfoma": self.is_linfoma,
            "is_mama_cancer": self.is_mama_cancer,
            "is_genitais_femininos": self.is_genitais_femininos,
            "is_genitais_masculinos": self.is_genitais_masculinos,
            "is_pele": self.is_pele,
            "is_tireoide": self.is_tireoide,
            "is_trato_urinario_cancer": self.is_trato_urinario_cancer,

            # 3. Neoplasias benignas
            "is_tireoide_benigna": self.is_tireoide_benigna,
            "is_genitais_femininos_benigna": self.is_genitais_femininos_benigna,

            # 4. Doenças do sangue
            "is_anemia": self.is_anemia,
            "is_coagulacao_hemofilias": self.is_coagulacao_hemofilias,
            "is_purpura": self.is_purpura,

            # 5. Doenças endócrinas e relacionadas
            "is_diabetes": self.is_diabetes,
            "is_tireoide_endocrina": self.is_tireoide_endocrina,
            "is_hipofise": self.is_hipofise,
            "is_suprarrenal": self.is_suprarrenal,
            "peso_kg": self.peso_kg,
            "altura_cm": self.altura_cm,

            # 6. Transtornos psiquiátricos, mentais ou de identidade sexual
            "is_psicose_esquizofrenia": self.is_psicose_esquizofrenia,
            "is_autismo": self.is_autismo,
            "is_depressao": self.is_depressao,
            "is_transtorno_identidade_sexual": self.is_transtorno_identidade_sexual,

            # 7. Doenças do sistema nervoso
            "is_avc": self.is_avc,
            "is_enxaqueca": self.is_enxaqueca,
            "is_alzheimer": self.is_alzheimer,
            "is_epilepsia": self.is_epilepsia,
            "is_esclerose_multipla": self.is_esclerose_multipla,
            "is_paralisia_cerebral": self.is_paralisia_cerebral,
            "is_paralisias_polineuropatias": self.is_paralisias_polineuropatias,
            "is_parkinson": self.is_parkinson,
            "is_ame": self.is_ame,

            # 8. Doenças dos olhos e anexos
            "is_alteracao_retina": self.is_alteracao_retina,
            "is_astigmatismo": self.is_astigmatismo,
            "is_catarata": self.is_catarata,
            "is_ceratocone": self.is_ceratocone,
            "is_estrabismo": self.is_estrabismo,
            "is_glaucoma": self.is_glaucoma,
            "is_hipermetropia": self.is_hipermetropia,
            "is_miopia": self.is_miopia,
            "is_transplante_cornea": self.is_transplante_cornea,
            "is_pterigio": self.is_pterigio,
            "is_retinopatia_diabetica": self.is_retinopatia_diabetica,
            "is_presbiopia": self.is_presbiopia,

            # 9. Doenças do ouvido, nariz ou garganta
            "is_diminuicao_audicao": self.is_diminuicao_audicao,
            "is_hipertrofia_cornetos_amigdalas": self.is_hipertrofia_cornetos_amigdalas,
            "is_labirintite": self.is_labirintite,
            "is_rinite": self.is_rinite,
            "is_sinusite": self.is_sinusite,
            "is_problemas_adenoide": self.is_problemas_adenoide,

            # 10. Doenças do coração
            "is_angina_pectoris": self.is_angina_pectoris,
            "is_arritmia_cardiaca": self.is_arritmia_cardiaca,
            "is_disfuncao_valvulas": self.is_disfuncao_valvulas,
            "is_hipertensao_arterial": self.is_hipertensao_arterial,
            "is_infarto_miocardio": self.is_infarto_miocardio,
            "is_insuficiencia_cardiaca": self.is_insuficiencia_cardiaca,
            "is_insuficiencia_coronariana": self.is_insuficiencia_coronariana,
            "is_uso_marcapasso": self.is_uso_marcapasso,

            # 11. Doenças do sistema circulatório
            "is_aneurismas": self.is_aneurismas,
            "is_hemorroidas": self.is_hemorroidas,
            "is_insuficiencia_arterial_periferica": self.is_insuficiencia_arterial_periferica,
            "is_trombose_tromboflebite": self.is_trombose_tromboflebite,
            "is_ulcera_perna": self.is_ulcera_perna,
            "is_varizes": self.is_varizes,

            # 12. Doenças do sistema respiratório
            "is_apneia_sono": self.is_apneia_sono,
            "is_asma": self.is_asma,
            "is_bronquiectasia": self.is_bronquiectasia,
            "is_bronquite": self.is_bronquite,
            "is_enfisema_dpoc": self.is_enfisema_dpoc,
            "is_fibrose_pulmonar": self.is_fibrose_pulmonar,
            "is_pneumonia": self.is_pneumonia,

            # 13. Doenças do sistema digestivo
            "is_cirrose_hepatica": self.is_cirrose_hepatica,
            "is_colelitiase": self.is_colelitiase,
            "is_colite": self.is_colite,
            "is_doenca_diverticular": self.is_doenca_diverticular,
            "is_doencas_pancreas": self.is_doencas_pancreas,
            "is_gastrite": self.is_gastrite,
            "is_ulcera_peptica": self.is_ulcera_peptica,
            "is_hepatite_digestiva": self.is_hepatite_digestiva,
            "is_esteatose_hepatica": self.is_esteatose_hepatica,

            # 14. Hérnias
            "is_hernia_inguinal": self.is_hernia_inguinal,
            "is_hernia_hiato": self.is_hernia_hiato,
            "is_hernia_umbilical": self.is_hernia_umbilical,
            "is_hernia_epigastrica": self.is_hernia_epigastrica,
            "is_hernia_incisional": self.is_hernia_incisional,

            # 15. Doenças da pele
            "is_tumores_pele": self.is_tumores_pele,
            "is_nodulos_cistos": self.is_nodulos_cistos,
            "is_queloide": self.is_queloide,

            # 16. Doenças osteomusculares e/ou da coluna
            "is_artrite": self.is_artrite,
            "is_artrite_reumatoide": self.is_artrite_reumatoide,
            "is_artrose": self.is_artrose,
            "is_desvios_coluna": self.is_desvios_coluna,
            "is_esclerodermia": self.is_esclerodermia,
            "is_calos_osseos": self.is_calos_osseos,
            "is_sequelas_fraturas": self.is_sequelas_fraturas,
            "is_hernia_disco": self.is_hernia_disco,
            "is_lupus": self.is_lupus,
            "is_osteomielite": self.is_osteomielite,
            "is_osteoporose": self.is_osteoporose,
            "is_reumatismo": self.is_reumatismo,
            "is_tendinite": self.is_tendinite,
            "is_dores_coluna": self.is_dores_coluna,

            # 17. Doenças do aparelho urinário
            "is_calculo_renal": self.is_calculo_renal,
            "is_incontinencia_urinaria": self.is_incontinencia_urinaria,
            "is_insuficiencia_renal": self.is_insuficiencia_renal,
            "is_transplante_renal": self.is_transplante_renal,
            "is_nefrite_nefrose": self.is_nefrite_nefrose,

            # 18. Doenças do aparelho genital feminino
            "is_cisto_ovario": self.is_cisto_ovario,
            "is_endometriose": self.is_endometriose,
            "is_infertilidade_feminina": self.is_infertilidade_feminina,
            "is_nodulo_mamario": self.is_nodulo_mamario,
            "is_prolapso_uterino": self.is_prolapso_uterino,
            "is_ruptura_perineal": self.is_ruptura_perineal,

            # 19. Doenças do aparelho genital masculino
            "is_esterilidade": self.is_esterilidade,
            "is_fimose": self.is_fimose,
            "is_hiperplasia_prostata": self.is_hiperplasia_prostata,
            "is_hipospadia": self.is_hipospadia,
            "is_impotencia_sexual": self.is_impotencia_sexual,
            "is_testiculo_alto": self.is_testiculo_alto,
            "is_varicocele": self.is_varicocele,

            # 20. Doenças bucomaxilo
            "is_micrognatia": self.is_micrognatia,
            "is_prognatia": self.is_prognatia,
            "is_alteracao_maxila": self.is_alteracao_maxila,
            "is_alteracao_atm": self.is_alteracao_atm,
            "is_ma_formacao_arcada_dentaria": self.is_ma_formacao_arcada_dentaria,
            "is_uso_aparelho_ortodontico": self.is_uso_aparelho_ortodontico,

            # 21 a 27. Perguntas gerais
            "is_traumatismos_fraturas": self.is_traumatismos_fraturas,
            "is_sequelas_acidentes_congenitas": self.is_sequelas_acidentes_congenitas,
            "is_cirurgia_previa": self.is_cirurgia_previa,
            "is_internacao_tratamento_outro": self.is_internacao_tratamento_outro,
            "is_radioterapia_quimioterapia_dialise": self.is_radioterapia_quimioterapia_dialise,
            "is_indicacao_cirurgia_futura": self.is_indicacao_cirurgia_futura,
            "is_protese_ortese": self.is_protese_ortese,

            "escolha_medico_orientador": self.escolha_medico_orientador,
            "parecer_unimed": self.parecer_unimed,
            "observation": self.observation,
            "application_form_interview_id": self.application_form_interview_id,
            "inserted_by": self.inserted_by,
            "created_at": self.created_at
        }

class QualifyInterviewModel:
    # GET de todas as entrevistas qualificadas cadastradas no sistema
    @staticmethod
    def get_all():
        conn = None
        cursor = None
        try:
            conn, cursor = get_db_connection()

            sql_query = """
                SELECT *
                FROM qualify_interviews
            """

            cursor.execute(sql_query)
            qualify_interviews_data = cursor.fetchall()

            qualify_interviews = [
                QualifyInterview(**qualify_interview)
                for qualify_interview in qualify_interviews_data
            ]

            return qualify_interviews
        except Exception as e:
            raise Exception(str(e))
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()