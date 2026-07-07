-- usuários e lógicas deles (roles, location, etc)
CREATE TABLE users (
    id,
    username,
    name,
    password_hash,
    email,
    role_id,
    sector_id,
    is_active,
    created_at
);

-- ficha (a entidade principal, vai navegar conforme os status)
CREATE TABLE application_forms (
    id,
    code,

    -- Titular
    beneficiary_name,
    beneficiary_tax_id,
    beneficiary_birth_date,
    beneficiary_phone,
    beneficiary_email,
    marital_status,

    -- Plano
    previous_plan,
    plan,
    plan_model,
    contract_type,
    company_tax_id,
    inclusion_date,
    due_day,
    grace_period_rule,

    -- Portabilidade
    is_portability,
    portability_accepted,
    portability_accepted_at,
    previous_cancellation_date,

    -- billing / responsável COLOCAR MESMO???
    billing_email,
    responsible_name,

    -- Pesquisa de satisfação do cliente
    referral_source,
    main_reasons,
    expectations,

    sales_rep_id,
    status,
    created_at,
    updated_at
);

-- histórico do status, para validar em qual status está e para onde foi
CREATE TABLE application_form_status_history (
    id,
    application_form_id,
    previous_status,
    new_status,
    user_id,
    notes,
    created_at
);

-- entrevista médica
CREATE TABLE medical_interviews (
    id,
    application_form_id,
    medic_id, -- FK
    location_id, -- FK
    scheduled_at,
    scheduled_by_id,
    status,
    decision, -- aprovado ou reprovado
    medical_notes,
    created_at
);

-- review financeira
CREATE TABLE finance_reviews (
    id,
    application_form_id,
    reviewer_id,
    decision, -- aprovado ou reprovado
    notes,
    created_at
);