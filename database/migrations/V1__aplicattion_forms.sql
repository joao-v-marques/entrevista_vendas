CREATE TABLE application_forms (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID do formulário
    consultant_id INT NOT NULL, -- ID do usuário consultor
    inclusion_type VARCHAR(20), -- Tipo de inclusão (NOVO CONTRATO, EXISTENTE, TROCA DE PLANO)
    previous_plan , -- VERIFICAR COM O CLEBER SE É O CÓDIGO DO PLANO OU ALGUM TEXTO DE IDENTIFICAÇÃO
    cnpj VARCHAR(14), -- Caso seja novo contrato empresarial
    primary_beneficiary_name VARCHAR(255), -- Nome do beneficiário principal do plano
    primary_beneficiary_age INT, -- Idade do beneficiário principal do plano
    contract_type VARCHAR(25), -- Tipo do contrato (Pessa Jurídica, Pessoa Fisica, Odonto, Coletivo por Adesão ou ACISSP)
    secondary_beneficiary_name VARCHAR(255), -- Nome do beneficiário secundário/dependente
    secondary_beneficiary_age INT, -- Idade do beneficiário secundário/dependente
    secondary_beneficiary_cpf VARCHAR(11), -- CPF do beneficiário secundário/dependente
    secondary_beneficiary_primary_name VARCHAR(255), -- Se tiver o dependente, colocar nesse campo o nome do Titular
    plan_type VARCHAR(35), -- Tipo do plano, não vou colocar aqui pois temos diversos
    model_code , -- Código do modelo da proposta
    proposal_code, -- Código da proposta
    inclusion_responsible_name, -- Nome do responsável pela inclusão
    inclusion_responsible_cpf, -- CPF do responsável pela inclusão
    inclusion_date, -- Data da inclusão
    inclusion_cancel_date, -- Caso tenha troca, esse campo é a data do cancelamento
    expiration_date, -- Data de vencimento da proposta
    inclusion_responsible_phone, -- Telefone/Celular do beneficiário titular
    inclusion_responsible_email, -- Email do beneficiário titular
    billing_email, -- Email de cobrança (É obrigatório)
    primary_beneficiary_marital_status, -- Estado Civil do Beneficiário titular
    inclusion_responsible_marital_status, -- Estado Civil do responsável pela inclusão
    inclusion_responsible_profession, -- Profissão do responsável pela inclusão
    discount, -- Desconto dado no plano (Acredito que a maioria fique sem desconto)
    is_digita_pa, -- Boolean que define se vai incluir no PA Digital ou não
    is_air_medical, -- Boolean que define se tem aeromedico ou não
    -- Parte de portabilidade
    is_portability_analysis, -- Boolean que define se vai ser realizado análise de portabilidade
    portability_accepted, -- Boolean que define se a portabilidade foi aceita ou não
    -- Parte de aprovação no financeiro e juridico
    is_approved_by_legal, -- Boolean que define se foi aprovado pelo Juridico
    is_approved_by_finance, -- Boolean que define se foi aprovado pelo Financeiro
    finance_observation, -- Campo para colocar as observações do financeiro (Apenas texto)
    -- VERIFICAR SE PRECISA DA PARTE DE EXPERIENCIA DO CLIENTE
    -- Sessão para marcar entrevista caso a triagem seja aprovada
    interview_date,
    interviewer_user,
    is_interview_accepted,
    interview_observation, -- Observações da gerencia/diretoria
    interview_signature, -- Assinatura da gerencia/diretoria
    -- VERIFICAR SE É NECESSÁRIO COLOCAR A ULTIMA PARTE DE OPÇÕES E O QUE É
);