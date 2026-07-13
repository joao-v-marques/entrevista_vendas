create table consultants (
	id int generated always as identity primary key,
	name varchar(255)
);

create table form_status (
    id int generated always as identity primary key,
    name varchar(255),
    description text
);

create table application_forms (
	id int generated always as identity primary key,
	
	-- Dados do formulário
	beneficiary_type varchar(35),
	consultant_id int,
	inclusion_type varchar(35),
	cnpj varchar(18),
	previous_plan varchar(25),
	inclusion_date date,
	contract_type varchar(35),
    plan_type varchar(155),
	model_proposal varchar(35),
	expiration_month int,
	is_pa_digital boolean,
	is_aeromedic boolean,
	-- Desconto
	is_discount boolean,
	discount_percentage numeric(3, 2),
	discount_observation text,
	
	-- Dados do beneficiário
	beneficiary_name varchar(255),
	beneficiary_birth_date date,
	beneficiary_phone varchar(25),
	beneficiary_email varchar(255),
	beneficiary_marital_state varchar(35),
    billing_email varchar(255),
	
	secondary_beneficiary_cpf varchar(14),
	secondary_beneficiary_primary_name varchar(255),
	secondary_beneficiary_kinship varchar(35),
	
	-- Dados de portabilidade
	is_portability boolean,
	portability_accepted boolean,
	portability_accepted_date date,
	portability_observation text,
	
	-- Dados de opção extra e observações especiais
	grace_option varchar(155),
	especial_observations text,

    -- Colunas extras necessárias para validações
    created_at timestamptz not null default now(),
    form_status_id int,
	
	-- Foreign keys
	constraint fk_consultant_form foreign key (consultant_id) references consultants(id),
    constraint fk_application_form_status foreign key (form_status_id) references form_status(id)
);

create table inclusion_responsibles (
	id int generated always as identity primary key,
	name varchar(255),
	cpf varchar(14),
	marital_state varchar(35),
	profession varchar(155),
	application_form_id int,
	
	constraint fk_application_form_responsible foreign key (application_form_id) references application_forms(id)
);