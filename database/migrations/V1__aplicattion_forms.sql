CREATE TABLE application_forms (
    id, -- ID do formulário
    consultant_id, -- ID do usuário consultor
    inclusion_type, -- Tipo de inclusão (NOVO CONTRATO, EXISTENTE, TROCA DE PLANO)
    previous_plan, -- VERIFICAR COM O CLEBER SE É O CÓDIGO DO PLANO OU ALGUM TEXTO DE IDENTIFICAÇÃO
    cnpj, -- Caso seja novo contrato empresarial
    primary_beneficiary_name, -- Nome do beneficiário principal do plano
    primary_beneficiary_age, -- Idade do beneficiário principal do plano
    contract_type, -- Tipo do contrato (Pessa Jurídica, Pessoa Fisica, Odonto, Coletivo por Adesão ou ACISSP)
    secondary_beneficiary_name, -- Nome do beneficiário secundário/dependente
    secondary_beneficiary_age, -- Idade do beneficiário secundário/dependente
    secondary_beneficiary_cpf, -- CPF do beneficiário secundário/dependente
    secondary_beneficiary_primary_name, -- Se tiver o dependente, colocar nesse campo o nome do Titular
    plan_type, -- Tipo do plano, não vou colocar aqui pois temos diversos
    model_code, -- Código do modelo da proposta
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
    is_portability_analysis, -- Boolean que define se vai ser realizado análise de portabilidade
    
)