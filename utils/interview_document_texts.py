# ---------------------------------------------------------------------------
# Identificação da operadora — cabeçalho repetido nas páginas da declaração
# ---------------------------------------------------------------------------

OPERADORA_CNPJ = "CNPJ: 66.453.168/0001-60"
OPERADORA_ENDERECO = "Av. Dr. Delfim Moreira, 1400, Centro - São Seb. do Paraíso – MG - Cep 37950-018"
OPERADORA_TELEFONE = "Telefone/Fax: (35) 3539-8400"
OPERADORA_VERSAO = "VERSÃO Agosto/2026"
OPERADORA_SITE = "www.unimedssp.com.br"
LOCAL_ASSINATURA = "São Sebastião do Paraíso-MG,"

# preenchido no campo "Local" dos blocos de assinatura da carta (página 2)
LOCAL_CIDADE = "São Sebastião do Paraíso - MG"
OPERADORA_ANS = "<b>ANS – 32735-2</b>"

# ---------------------------------------------------------------------------
# Páginas 1 e 2 — Carta de Orientação ao Beneficiário (texto padronizado da ANS)
# ---------------------------------------------------------------------------

CARTA_TITULO = "ANEXO"
CARTA_SUBTITULO = "CARTA DE ORIENTAÇÃO AO BENEFICIÁRIO"

# cada item é (estilo, texto): "p" parágrafo, "h" subtítulo em negrito, "b" item de marcador
CARTA_ORIENTACAO = [
    ("p", "Prezado(a) Beneficiário(a),"),
    ("p",
     "A <b>Agência Nacional de Saúde Suplementar (ANS)</b>, instituição que regula a atividades das "
     "operadoras de planos privados de assistência à saúde, e tem como missão defender o "
     "interesse público vem, por meio desta, prestar informações para o preenchimento da "
     "DECLARAÇÃO DE SAÚDE."),

    ("h", "O QUE É A DECLARAÇÃO DE SAÚDE?"),
    ("p",
     "É o formulário que acompanha o Contrato do Plano de Saúde, onde o beneficiário ou seu "
     "representante legal deverá informar as doenças ou lesões preexistentes que saiba ser "
     "portador ou sofredor no momento da contratação do plano. Para o seu preenchimento, o "
     "beneficiário tem o direito de ser orientado, gratuitamente, por um médico "
     "credenciado/referenciado pela operadora. Se optar por um profissional de sua livre "
     "escolha, assumirá o custo desta opção."),
    ("p",
     "Portanto, se o beneficiário (você) toma medicamentos regularmente, consulta médicos por "
     "problema de saúde do qual conhece o diagnóstico, fez qualquer exame que identificou alguma "
     "doença ou lesão, esteve internado ou submeteu-se a alguma cirurgia, DEVE DECLARAR ESTA "
     "DOENÇA OU LESÃO."),

    ("h",
     "AO DECLARAR AS DOENÇAS E/OU LESÕES QUE O BENEFICIÁRIO SAIBA SER PORTADOR NO MOMENTO DA "
     "CONTRATAÇÃO:"),
    ("b",
     "A operadora NÃO poderá impedi-lo de contratar o plano de saúde. Caso isto ocorra, "
     "encaminhe a denúncia à ANS."),
    ("b",
     "A operadora deverá oferecer: cobertura total ou COBERTURA PARCIAL TEMPORÁRIA (CPT), "
     "podendo ainda oferecer o Agravo, que é um acréscimo no valor da mensalidade, pago ao plano "
     "privado de assistência à saúde, para que se possa utilizar toda a cobertura contratada, "
     "após os prazos de carências contratuais."),
    ("b",
     "No caso de CPT, haverá restrição de cobertura para cirurgias, leitos de alta tecnologia "
     "(UTI, unidade coronariana ou neonatal) e procedimentos de alta complexidade – PAC "
     "(tomografia, ressonância, etc.*) EXCLUSIVAMENTE relacionados à doença ou lesão declarada, "
     "até 24 meses, contados desde a assinatura do contrato. Após o período máximo de 24 meses "
     "da assinatura contratual, a cobertura passará a ser integral de acordo com o plano "
     "contratado."),
    ("b",
     "NÃO haverá restrição de cobertura para consultas médicas, internações não cirúrgicas, "
     "exames e procedimentos que não sejam de alta complexidade, mesmo que relacionados à doença "
     "ou lesão preexistente declarada, desde que cumpridos os prazos de carências estabelecidas "
     "no contrato."),
    ("b",
     "Não caberá alegação posterior de omissão de informação na Declaração de Saúde por parte da "
     "operadora para esta doença ou lesão."),

    ("h",
     "AO NÃO DECLARAR AS DOENÇAS E/OU LESÕES QUE O BENEFICIÁRIO SAIBA SER PORTADOR NO MOMENTO "
     "DA CONTRATAÇÃO:"),
    ("b",
     "A operadora poderá suspeitar de omissão de informação e, neste caso, deverá comunicar "
     "imediatamente ao beneficiário, podendo oferecer CPT, ou solicitar abertura de processo "
     "administrativo junto à ANS, denunciando a omissão da informação."),
    ("b",
     "Comprovada a omissão de informação pelo beneficiário, a operadora poderá RESCINDIR o "
     "contrato por FRAUDE e responsabilizá-lo pelos procedimentos referentes a doença ou lesão "
     "não declarada."),
    ("b",
     "Até o julgamento final do processo pela ANS, NÃO poderá ocorrer suspensão do atendimento "
     "nem rescisão do contrato. Caso isto ocorra, encaminhe a denúncia à ANS."),
]

CARTA_ORIENTACAO_PAGINA_2 = [
    ("p",
     "<b>ATENÇÃO!</b> Se a operadora oferecer redução ou isenção de carência, isto não significa que "
     "dará cobertura assistencial para as doenças ou lesões que o beneficiário saiba ter no "
     "momento da assinatura contratual. Cobertura Parcial Temporária - CPT - NÃO é carência! "
     "Portanto, o beneficiário não deve deixar de informar se possui alguma doença ou lesão ao "
     "preencher a Declaração de Saúde!"),
    ("p",
     "* Para consultar a lista completa de procedimentos de alta complexidade – PAC, acesse o "
     "Rol de Procedimentos e Eventos em Saúde da ANS no endereço eletrônico: "
     "<b>www.ans.gov.br - Perfil Beneficiário.</b>"),
    ("p",
     "Em caso de dúvidas, entre em contato com a ANS pelo telefone <b>0800-701-9656</b> ou consulte a "
     "página da ANS - <b>www.ans.gov.br - Perfil Beneficiário.</b>"),
]

# ---------------------------------------------------------------------------
# Páginas 3 e 4 — texto de abertura da Declaração de Saúde
# ---------------------------------------------------------------------------

DECLARACAO_SAUDE_TITULO = "DECLARAÇÃO DE SAÚDE"

DECLARACAO_SAUDE_ABERTURA = [
    "A Declaração de Saúde tem por objetivo registrar a existência de Doenças ou Lesões "
    "Preexistente (DLP), ou seja, sequelas que o beneficiário ou seu representante legal saiba "
    "ser portador ou sofredor no momento da contratação ou adesão ao plano privado de "
    "assistência à saúde, de acordo com art. 11 da Lei nº 9.656, de 3 de junho de 1998.",

    "A Carta de Orientação ao Beneficiário que está localizada nas páginas imediatamente "
    "anteriores a esta é um documento padronizado pela Agência Nacional de Saúde Suplementar - "
    "ANS que visa a orientar o beneficiário/consumidor sobre o preenchimento da Declaração de "
    "Saúde. É obrigatório a aposição de ciência de seus termos.",

    "O Proponente tem o direito de ser orientado no preenchimento da declaração de saúde, sem "
    "ônus financeiro, por um médico indicado pela operadora, ou de optar por um profissional de "
    "sua livre escolha assumindo o ônus financeiro desta opção.",

    "É obrigatório responder a todas as perguntas formuladas na Declaração de Saúde. A <b>omissão "
    "de informação</b> sobre a existência de doença ou lesão preexistente da qual o consumidor saiba "
    "ser portador no momento do preenchimento desta declaração, desde que comprovada junto à <b>ANS "
    "acarretará a suspensão ou cancelamento do contrato.</b> Nesse caso, <u><b>o consumidor será "
    "responsável pelo pagamento das despesas realizadas com o tratamento da doença ou lesão não "
    "declarada.</b></u> Estando comprovada junto a ANS a omissão de informação sobre DLP conhecida e não "
    "declarada pelo beneficiário este poderá também responder criminalmente conforme Artigo 299 "
    "do Código Penal Brasileiro, além de Ação Judicial para o pedido de indenização por perdas e "
    "danos, honorários advocatícios e de custas processuais.",

    "Havendo declaração de doença ou lesão preexistente, o consumidor estará sujeito à <u><b>Cobertura "
    "Parcial Temporária (CPT), que é aquela que admite, por um período ininterrupto de até 24 "
    "meses, a partir da data da contratação ou adesão ao plano privado de assistência à saúde, a "
    "suspensão da cobertura de Procedimentos de Alta Complexidade (PAC), leitos de alta "
    "tecnologia e procedimentos cirúrgicos, desde que relacionados exclusivamente às doenças ou "
    "lesões preexistentes declaradas pelo beneficiário ou seu representante legal.</b></u>",

    "<b>NÃO</b> há alternativa de substituir a Cobertura Parcial Temporária pelo pagamento de Agravo, "
    "ou seja, qualquer acréscimo no valor da contraprestação paga ao plano privado de assistência "
    "à saúde, para que o beneficiário tenha direito integral à cobertura contratada, para doença "
    "ou lesão preexistente declarada, após os prazos de carências contratuais de acordo com as "
    "condições negociadas entre a operadora e o beneficiário.",

    "A UNIMED SÃO SEBASTIÃO DO PARAÍSO poderá utilizar-se de qualquer documento legal para fins "
    "de comprovação do conhecimento prévio do Beneficiário sobre sua condição quanto à existência "
    "de doença e lesão preexistente.",

    "Após a avaliação da Declaração de Saúde, a UNIMED poderá solicitar ao consumidor proponente "
    "e seus dependentes, a realização de uma perícia médica, com consulta e exames "
    "complementares, realizada por um médico perito, escolhido pela operadora, sem ônus para o "
    "consumidor.",

    "Leia atentamente as questões que se seguem e preencha no local indicado. Algumas questões "
    "pedem que o Proponente explique ou especifique suas respostas. Nesses casos, o Proponente "
    "deverá escrever a resposta, de próprio punho, no local indicado.",

    "A UNIMED SÃO SEBASTIÃO DO PARAÍSO fica obrigada a proteger as informações prestadas nas "
    "declarações de saúde, sendo vedada sua divulgação ou o fornecimento a terceiros não "
    "envolvidos na prestação de serviços assistenciais sem a anuência expressa do beneficiário, "
    "ressalvados os casos previstos na legislação em vigor.",

    "Para cada doença listada abaixo o Proponente deverá responder, no campo <b>RESPOSTAS, <u>SIM</u></b> caso "
    "esteja ciente de que é sofredor ou portador da condição ou responder <u><b>NÃO</b></u>, caso esteja ciente "
    "de que não é sofredor ou portador da condição.",
]

QUESTIONARIO_TITULO = "QUESTIONÁRIO"

# faixas exibidas ao lado do cálculo do IMC, no grupo 5
IMC_FAIXAS = [
    ("De 18,5 a 24,9", "Normal"),
    ("De 25,0 a 29,9", "Sobrepeso"),
    ("De 30,0 a 34,9", "Obesidade Grau I"),
    ("De 35,0 a 39,9", "Obesidade Grau II"),
    ("Mais de 40", "Obesidade Grau III"),
]

# ---------------------------------------------------------------------------
# Página 12 — comentários e declaração final
# ---------------------------------------------------------------------------

COMENTARIOS_TITULO = (
    "<b>Comentários e informações adicionais a respeito das perguntas formuladas que o BENEFICIÁRIO "
    "entende ser importante registrar.</b>"
)

DECLARACAO_FINAL_TITULO = "DECLARAÇÃO"

DECLARACAO_FINAL_TEXTO = (
    "Declaro para os devidos fins que as informações prestadas na Declaração de Saúde, relativas "
    "a mim, espontaneamente feitas de próprio punho, são verdadeiras e completas, e assumo "
    "inteira responsabilidade pelas mesmas. Estou ciente que a omissão de fatos e informações "
    "que possam influir no correto enquadramento das coberturas, poderá ser considerada como "
    "comportamento fraudulento, implicando a rescisão do contrato, além de estar obrigado a "
    "arcar como os custos dos atendimentos obtidos com cirurgia, uso de leito de alta tecnologia "
    "e procedimentos de alta complexidade ligados às doenças ou lesões preexistentes. "
    "Comprometo-me a prestar toda e qualquer outra informação adicional que vier a ser "
    "solicitada, bem como autorizo médicos, clínicas e quaisquer entidades públicas ou privadas "
    "de saúde, a enviar à UNIMED as informações de que ela necessitar sobre o meu estado de "
    "saúde e de meus dependentes, resultados de exames e tratamentos instituídos, isentando-a, "
    "ou seus cooperados, de qualquer responsabilidade que implique ofensa ao sigilo profissional."
)

# ---------------------------------------------------------------------------
# Página 13 — escolha do médico orientador
# ---------------------------------------------------------------------------

MEDICO_ORIENTADOR_TITULO = "ESCOLHA DO MÉDICO ORIENTADOR"

# a ordem importa: é a numeração 1, 2 e 3 impressa no documento
MEDICO_ORIENTADOR_OPCOES = [
    ("medico_unimed",
     "O preenchimento desta declaração contou com a presença do Médico Orientador indicado pela "
     "UNIMED SÃO SEBATIÃO DO PARAÍSO (sem ônus financeiro para o proponente)."),
    ("medico_proprio",
     "Declaro que dispensei a presença do médico orientador da operadora para auxiliar-me no "
     "preenchimento desta Declaração de Saúde e optei por um Médico de minha livre escolha "
     "assumindo o ônus financeiro desta opção."),
    ("dispensou_orientador",
     "Declaro que dispensei a presença do médico orientador da operadora para auxiliar-me no "
     "preenchimento desta Declaração de Saúde."),
]

# ---------------------------------------------------------------------------
# Página 14 — parecer reservado à Unimed
# ---------------------------------------------------------------------------

PARECER_TITULO = "RESERVADO PARA A UNIMED SÃO SEBASTIÃO DO PARAÍSO"
PARECER_SUBTITULO = "Parecer"

PARECER_OPCOES = [
    ("sem_preexistencias",
     "Declaração de Saúde SEM Preexistências – para fins de emissão do Cartão de Identificação"),
    ("com_preexistencias_aceitou_cpt",
     "Declaração de Saúde COM Preexistências – para fins de emissão do Cartão de Identificação, "
     "uma vez que o beneficiário aceitou cumprir a CPT"),
    ("com_preexistencias_recusou_cpt",
     "Declaração de Saúde COM Preexistências – para fins de cancelamento do plano e arquivamento, "
     "uma vez que o beneficiário não aceitou cumprir a CPT"),
    ("recusou_pericia_exames",
     "Declaração de Saúde para fins de cancelamento do plano e arquivamento, uma vez que o "
     "beneficiário não aceitou realizar perícia médica e/ou exames solicitados."),
]

PARECER_ACEITACAO = "<b>Aceitação das condições acima</b>"

# ---------------------------------------------------------------------------
# Página 15 — aceitação da Cobertura Parcial Temporária
# ---------------------------------------------------------------------------

CPT_TITULO = "DECLARAÇÃO DE ACEITAÇÃO DA COBERTURA PARCIAL TEMPORÁRIA - CPT"

CPT_TEXTO = (
    "Eu, {nome}, portador do CPF número {cpf}, (ou menor/incapaz por mim representado) <mark><b>declaro "
    "estar ciente da minha condição como portador da(as) Doença(as) e Lesão(ões) Preexistente(s) "
    "declarada(s) e reconhecida(s) por ocasião da Entrevista Qualificada e estou de acordo de que "
    "isto acarrete, durante um prazo de<u> 24(vinte e quatro)</u> meses após minha adesão, a suspensão, "
    "por parte do Plano de Saúde do qual pretendo ser beneficiário(a), da cobertura de eventos "
    "cirúrgicos, leitos de alta tecnologia e procedimentos de alta complexidade relacionados à(s) "
    "Doença(s) e Lesão(ões) Preexistente(s) relacionados no Rol de Procedimentos editado e "
    "divulgado pela Agência Nacional de Saúde Suplementar.</b></mark>"
)

CPT_LISTA_TITULO = "Doença(s) e Lesão(ões) Preexistente(s):"

# antecede o texto que o entrevistador digitou para a doença, na lista da página 15
CPT_ESPECIFICACOES_ROTULO = "Especificações:"

# ---------------------------------------------------------------------------
# Rótulos de campo repetidos
# ---------------------------------------------------------------------------

CAMPO_PROPONENTE = "<b>Nome do Proponente:</b>"
CAMPO_CONTRATO = "<b>Nº do contrato:</b>"
CAMPO_REPRESENTANTE = "<b>Nome do Representante Legal (no caso de menor ou incapaz):</b>"
CAMPO_TITULAR_OU_REPRESENTANTE = (
    "<b>Nome do Proponente a “Participante Titular” ou Representante Legal (no caso de menor ou</b> "
    "<b>incapaz):</b>"
)
ASSINATURA_BENEFICIARIO = "Assinatura do Beneficiário/Proponente"
ASSINATURA_PROPONENTE = "Assinatura do Proponente:"
ASSINATURA_MEDICO = "Assinatura e Carimbo do Médico"
ASSINATURA_BENEFICIARIO_LINHA = "Assinatura do Beneficiário:"
