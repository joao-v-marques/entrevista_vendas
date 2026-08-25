// Perguntas do questionário de saúde (base: Declaração de Saúde / Entrevista Qualificada Unimed).
// A "key" de cada item corresponde 1:1 à coluna boolean da tabela qualify_interview.
export const QUALIFY_INTERVIEW_GROUPS = [
    {
        number: 1,
        title: "Sofre ou sofreu de alguma doença infecciosa ou parasitária como:",
        items: [
            { key: "is_hiv", label: "Portador do vírus HIV ou pessoa vivendo com HIV?" },
            { key: "is_chagas", label: "Doença de Chagas?" },
            { key: "is_hanseniase", label: "Hanseníase?" },
            { key: "is_meningite", label: "Meningite?" },
            { key: "is_tuberculose", label: "Tuberculose?" },
            { key: "is_hepatite", label: "Hepatite?" },
        ],
    },
    {
        number: 2,
        title: "Sofre ou sofreu de neoplasias malignas (câncer)?",
        items: [
            { key: "is_aparelho_digestivo_cancer", label: "Aparelho digestivo (estômago, outros)?" },
            { key: "is_aparelho_respiratorio_cancer", label: "Aparelho respiratório (pulmão, outros)?" },
            { key: "is_leucemia", label: "Leucemia?" },
            { key: "is_linfoma", label: "Linfoma?" },
            { key: "is_mama_cancer", label: "Mama?" },
            { key: "is_genitais_femininos", label: "Órgãos genitais femininos (câncer) - útero, ovário, outros?" },
            { key: "is_genitais_masculinos", label: "Órgãos genitais masculinos (câncer) - próstata, outros?" },
            { key: "is_pele", label: "Pele?" },
            { key: "is_tireoide", label: "Tireóide (câncer)?" },
            { key: "is_trato_urinario_cancer", label: "Trato urinário (rins, bexiga, outros)?" },
        ],
    },
    {
        number: 3,
        title: "Sofre ou sofreu de neoplasias benignas?",
        items: [
            { key: "is_tireoide_benigna", label: "Tireóide (nódulo benigno)?" },
            { key: "is_genitais_femininos_benigna", label: "Órgãos genitais femininos (tumor benigno) - útero, ovário, outros?" },
        ],
    },
    {
        number: 4,
        title: "Sofre ou sofreu de doenças do sangue?",
        items: [
            { key: "is_anemia", label: "Anemia?" },
            { key: "is_coagulacao_hemofilias", label: "Doenças da coagulação ou hemofilias?" },
            { key: "is_purpura", label: "Púrpura?" },
        ],
    },
    {
        number: 5,
        title: "Sofre ou sofreu de doenças endócrinas e relacionadas?",
        items: [
            { key: "is_diabetes", label: "Diabetes?" },
            { key: "is_tireoide_endocrina", label: "Distúrbio de tireóide?" },
            { key: "is_hipofise", label: "Distúrbio de hipófise?" },
            { key: "is_suprarrenal", label: "Distúrbio de supra renal?" },
            // medidas (colunas peso_kg / altura_cm), usadas também pro cálculo do IMC
            { key: "peso_kg", label: "Peso", type: "measure", unit: "kg", step: "0.01", min: 1, max: 999.99, placeholder: "Ex.: 78,50" },
            { key: "altura_cm", label: "Altura", type: "measure", unit: "cm", step: "1", min: 30, max: 300, placeholder: "Ex.: 175" },
        ],
    },
    {
        number: 6,
        title: "Sofre ou sofreu de transtornos psiquiátricos, mentais ou de identidade sexual?",
        items: [
            { key: "is_psicose_esquizofrenia", label: "Psicose ou esquizofrenia?" },
            { key: "is_autismo", label: "Autismo?" },
            { key: "is_depressao", label: "Depressão?" },
            { key: "is_transtorno_identidade_sexual", label: "Possui diagnóstico de transtorno de identidade sexual?" },
        ],
    },
    {
        number: 7,
        title: "Sofre ou sofreu de doenças do sistema nervoso?",
        items: [
            { key: "is_avc", label: "Acidente vascular cerebral (\"derrame\"/AVC) ou sequelas?" },
            { key: "is_enxaqueca", label: "Enxaqueca ou outro tipo de cefaleia?" },
            { key: "is_alzheimer", label: "Alzheimer?" },
            { key: "is_epilepsia", label: "Epilepsia?" },
            { key: "is_esclerose_multipla", label: "Esclerose múltipla?" },
            { key: "is_paralisia_cerebral", label: "Paralisia cerebral?" },
            { key: "is_paralisias_polineuropatias", label: "Paralisias ou polineuropatias?" },
            { key: "is_parkinson", label: "Parkinson?" },
            { key: "is_ame", label: "Atrofia Muscular Espinhal (AME)?" },
        ],
    },
    {
        number: 8,
        title: "Sofre ou sofreu de doenças dos olhos e anexos?",
        items: [
            { key: "is_alteracao_retina", label: "Alterações na retina?" },
            { key: "is_astigmatismo", label: "Astigmatismo?" },
            { key: "is_catarata", label: "Catarata?" },
            { key: "is_ceratocone", label: "Ceratocone?" },
            { key: "is_estrabismo", label: "Estrabismo?" },
            { key: "is_glaucoma", label: "Glaucoma?" },
            { key: "is_hipermetropia", label: "Hipermetropia?" },
            { key: "is_miopia", label: "Miopia?" },
            { key: "is_transplante_cornea", label: "Necessidade de transplante de córnea?" },
            { key: "is_pterigio", label: "Pterígio?" },
            { key: "is_retinopatia_diabetica", label: "Retinopatia diabética?" },
            { key: "is_presbiopia", label: "Presbiopia (queda da visão para perto)?" },
        ],
    },
    {
        number: 9,
        title: "Sofre ou sofreu de doenças do ouvido, nariz ou garganta?",
        items: [
            { key: "is_diminuicao_audicao", label: "Diminuição da audição, perfuração do tímpano, infecções frequentes?" },
            { key: "is_hipertrofia_cornetos_amigdalas", label: "Hipertrofia de cornetos ou amígdalas?" },
            { key: "is_labirintite", label: "Labirintite?" },
            { key: "is_rinite", label: "Rinite?" },
            { key: "is_sinusite", label: "Sinusite?" },
            { key: "is_problemas_adenoide", label: "Problemas de adenoide, tumor, desvio de septo, pólipos?" },
        ],
    },
    {
        number: 10,
        title: "Sofre ou sofreu de doenças do coração?",
        items: [
            { key: "is_angina_pectoris", label: "Angina pectoris?" },
            { key: "is_arritmia_cardiaca", label: "Arritmia cardíaca?" },
            { key: "is_disfuncao_valvulas", label: "Doenças com disfunção de válvulas?" },
            { key: "is_hipertensao_arterial", label: "Hipertensão arterial ou doença hipertensiva da gravidez?" },
            { key: "is_infarto_miocardio", label: "Infarto do miocárdio?" },
            { key: "is_insuficiencia_cardiaca", label: "Insuficiência cardíaca?" },
            { key: "is_insuficiencia_coronariana", label: "Insuficiência coronariana?" },
            { key: "is_uso_marcapasso", label: "Uso de marca-passo?" },
        ],
    },
    {
        number: 11,
        title: "Sofre ou sofreu de doenças do sistema circulatório?",
        items: [
            { key: "is_aneurismas", label: "Aneurismas?" },
            { key: "is_hemorroidas", label: "Hemorroidas?" },
            { key: "is_insuficiencia_arterial_periferica", label: "Insuficiência arterial periférica?" },
            { key: "is_trombose_tromboflebite", label: "Trombose ou tromboflebite?" },
            { key: "is_ulcera_perna", label: "Úlcera de perna?" },
            { key: "is_varizes", label: "Varizes de membros inferiores ou microvarizes?" },
        ],
    },
    {
        number: 12,
        title: "Sofre ou sofreu de doenças do sistema respiratório?",
        items: [
            { key: "is_apneia_sono", label: "Apneia do sono?" },
            { key: "is_asma", label: "Asma?" },
            { key: "is_bronquiectasia", label: "Bronquiectasia (dilatação do brônquio)?" },
            { key: "is_bronquite", label: "Bronquite?" },
            { key: "is_enfisema_dpoc", label: "Enfisema (DPOC)?" },
            { key: "is_fibrose_pulmonar", label: "Fibrose pulmonar?" },
            { key: "is_pneumonia", label: "Pneumonia?" },
        ],
    },
    {
        number: 13,
        title: "Sofre ou sofreu de doenças do sistema digestivo?",
        items: [
            { key: "is_cirrose_hepatica", label: "Cirrose hepática?" },
            { key: "is_colelitiase", label: "Colelitíase (cálculo da vesícula)?" },
            { key: "is_colite", label: "Colite?" },
            { key: "is_doenca_diverticular", label: "Doença diverticular do intestino (diverticulite)?" },
            { key: "is_doencas_pancreas", label: "Doenças do pâncreas?" },
            { key: "is_gastrite", label: "Gastrite?" },
            { key: "is_ulcera_peptica", label: "Úlcera péptica?" },
            { key: "is_hepatite_digestiva", label: "Hepatites (doença digestiva)?" },
            { key: "is_esteatose_hepatica", label: "Esteatose hepática?" },
        ],
    },
    {
        number: 14,
        title: "Sofre ou sofreu de algum tipo de hérnia?",
        items: [
            { key: "is_hernia_inguinal", label: "Inguinal?" },
            { key: "is_hernia_hiato", label: "De hiato?" },
            { key: "is_hernia_umbilical", label: "Umbilical?" },
            { key: "is_hernia_epigastrica", label: "Epigástrica?" },
            { key: "is_hernia_incisional", label: "Incisional?" },
        ],
    },
    {
        number: 15,
        title: "Sofre ou sofreu de doenças da pele?",
        items: [
            { key: "is_tumores_pele", label: "Tumores?" },
            { key: "is_nodulos_cistos", label: "Nódulos ou cistos?" },
            { key: "is_queloide", label: "Quelóide?" },
        ],
    },
    {
        number: 16,
        title: "Sofre ou sofreu de doenças osteomusculares e/ou da coluna?",
        items: [
            { key: "is_artrite", label: "Artrite?" },
            { key: "is_artrite_reumatoide", label: "Artrite reumatóide?" },
            { key: "is_artrose", label: "Artrose?" },
            { key: "is_desvios_coluna", label: "Desvios da coluna (escoliose ou lordose)?" },
            { key: "is_esclerodermia", label: "Esclerodermia?" },
            { key: "is_calos_osseos", label: "Calos ósseos?" },
            { key: "is_sequelas_fraturas", label: "Sequelas de fraturas?" },
            { key: "is_hernia_disco", label: "Hérnia de disco?" },
            { key: "is_lupus", label: "Lúpus eritematoso sistêmico?" },
            { key: "is_osteomielite", label: "Osteomielite?" },
            { key: "is_osteoporose", label: "Osteoporose?" },
            { key: "is_reumatismo", label: "Reumatismo?" },
            { key: "is_tendinite", label: "Tendinite?" },
            { key: "is_dores_coluna", label: "Dores na coluna (lombociatalgia ou outras dores cervical/torácica)?" },
        ],
    },
    {
        number: 17,
        title: "Sofreu ou sofre de doenças do aparelho urinário?",
        items: [
            { key: "is_calculo_renal", label: "Cálculo renal, ureteral ou de bexiga?" },
            { key: "is_incontinencia_urinaria", label: "Incontinência urinária?" },
            { key: "is_insuficiencia_renal", label: "Insuficiência renal (aguda ou crônica)?" },
            { key: "is_transplante_renal", label: "Necessidade de transplante renal?" },
            { key: "is_nefrite_nefrose", label: "Nefrite ou nefrose?" },
        ],
    },
    {
        number: 18,
        title: "Sofre ou sofreu de doenças do aparelho genital feminino?",
        items: [
            { key: "is_cisto_ovario", label: "Cisto de ovário?" },
            { key: "is_endometriose", label: "Endometriose?" },
            { key: "is_infertilidade_feminina", label: "Infertilidade?" },
            { key: "is_nodulo_mamario", label: "Nódulo mamário?" },
            { key: "is_prolapso_uterino", label: "Prolapso uterino?" },
            { key: "is_ruptura_perineal", label: "Ruptura perineal ou outras?" },
        ],
    },
    {
        number: 19,
        title: "Sofre ou sofreu de doenças do aparelho genital masculino?",
        items: [
            { key: "is_esterilidade", label: "Esterilidade?" },
            { key: "is_fimose", label: "Fimose?" },
            { key: "is_hiperplasia_prostata", label: "Hiperplasia de próstata?" },
            { key: "is_hipospadia", label: "Hipospadia?" },
            { key: "is_impotencia_sexual", label: "Impotência sexual?" },
            { key: "is_testiculo_alto", label: "Testículo alto (fora da bolsa escrotal)?" },
            { key: "is_varicocele", label: "Varicocele?" },
        ],
    },
    {
        number: 20,
        title: "Sofre ou sofreu de doença bucomaxilar?",
        items: [
            { key: "is_micrognatia", label: "Micrognatia?" },
            { key: "is_prognatia", label: "Prognatia?" },
            { key: "is_alteracao_maxila", label: "Alteração da maxila?" },
            { key: "is_alteracao_atm", label: "Alteração da articulação temporomandibular (ATM)?" },
            { key: "is_ma_formacao_arcada_dentaria", label: "Má formação da arcada dentária?" },
            { key: "is_uso_aparelho_ortodontico", label: "Usou ou usa aparelho ortodôntico?" },
        ],
    },
    {
        number: 21,
        title: "Traumatismos e/ou fraturas",
        items: [
            { key: "is_traumatismos_fraturas", label: "Já sofreu traumatismos e/ou fraturas?" },
        ],
    },
    {
        number: 22,
        title: "Sequelas de acidentes ou doença congênita",
        items: [
            { key: "is_sequelas_acidentes_congenitas", label: "Sofre de sequelas de acidentes, moléstia adquirida ou congênita (doença de nascença)?" },
        ],
    },
    {
        number: 23,
        title: "Cirurgias já realizadas",
        items: [
            { key: "is_cirurgia_previa", label: "Já foi submetido a algum tipo de cirurgia?" },
        ],
    },
    {
        number: 24,
        title: "Internação ou tratamento não relacionado às doenças acima",
        items: [
            { key: "is_internacao_tratamento_outro", label: "Sofre ou sofreu de alguma doença não relacionada acima que o tenha obrigado a internar-se ou submeter-se a algum tipo de tratamento ou exame?" },
        ],
    },
    {
        number: 25,
        title: "Radioterapia, quimioterapia ou diálise",
        items: [
            { key: "is_radioterapia_quimioterapia_dialise", label: "Já foi submetido à radioterapia, quimioterapia, braquiterapia, hemodiálise ou diálise peritonial?" },
        ],
    },
    {
        number: 26,
        title: "Cirurgia futura",
        items: [
            { key: "is_indicacao_cirurgia_futura", label: "Tem indicação firmada ou em avaliação de submeter-se a algum tipo de cirurgia?" },
        ],
    },
    {
        number: 27,
        title: "Prótese ou órtese",
        items: [
            { key: "is_protese_ortese", label: "Possui algum tipo de prótese ou órtese (placas, pinos, parafusos, marca-passo, outros)?" },
        ],
    },
];

export const QUALIFY_INTERVIEW_TOTAL_ITEMS = QUALIFY_INTERVIEW_GROUPS.reduce(
    (total, group) => total + group.items.length,
    0
);
