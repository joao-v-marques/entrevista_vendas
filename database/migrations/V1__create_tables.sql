create table roles (
	id int generated always as identity primary key,
	name varchar(155) not null unique,
	description text
);

create table sectors (
	id int generated always as identity primary key,
	name varchar(155) not null unique
);

create table users (
	id int generated always as identity primary key,
	username varchar(100) unique not null,
	name varchar(155),
	password_hash varchar(255) not null,
	email varchar(255),
	role_id int,
	sector_id int,
	is_active boolean not null default true,
	
	constraint fk_user_role foreign key (role_id) references roles(id) on delete restrict,
	constraint fk_user_sectors foreign key (sector_id) references sectors(id) on delete restrict	
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
	beneficiary_cpf varchar(14),
	beneficiary_birth_date date,
	beneficiary_phone varchar(25),
	beneficiary_email varchar(255),
	beneficiary_marital_state varchar(35),
    billing_email varchar(255),

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
	constraint fk_consultant_form foreign key (consultant_id) references users(id) on delete restrict,
    constraint fk_application_form_status foreign key (form_status_id) references form_status(id) on delete restrict
);

create table application_form_documents (
	id int generated always as identity primary key,
	original_filename text not null,
	content_type text,
	stored_path text not null,
	size_bytes int,
	uploaded_at timestamptz not null default now(),
	application_form_id int not null,

	constraint fk_application_form_documents foreign key (application_form_id) references application_forms(id) on delete cascade
);

create table inclusion_responsibles (
	id int generated always as identity primary key,
	name varchar(255),
	cpf varchar(14),
	marital_state varchar(35),
	profession varchar(155),
	application_form_id int not null,
	
	constraint fk_application_form_responsible foreign key (application_form_id) references application_forms(id) on delete cascade
);

create table application_form_approvals (
	id int generated always as identity primary key,

	-- Aprovação financeira
	financial_approved boolean,
	financial_reviewer_id int,
	financial_reviewed_at timestamptz,
	financial_observation text,

	application_form_id int not null,
	created_at timestamptz not null default now(),

	constraint fk_approval_application_form foreign key (application_form_id) references application_forms(id) on delete cascade,
	constraint fk_approval_financial_reviewer foreign key (financial_reviewer_id) references users(id) on delete restrict,
	constraint uq_approval_application_form unique (application_form_id)
);