-- Tabela de roles/cargos no sistema
create table roles (
	id int generated always as identity primary key,
	name varchar(155) not null unique,
	description text
);

-- Tabela de setores do sistema
create table sectors (
	id int generated always as identity primary key,
	name varchar(155) not null unique
);

-- Tabela de usuários do sistema
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

-- Tabela de status do formulário, temos uma migration mostrando cada status
create table form_status (
    id int generated always as identity primary key,
    name varchar(255),
    description text
);

-- Tabela principal do formulário de adesão
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

-- Tabela de documentos do form, considerando também que pode ser muitos, cada doc tem um registro nessa tabela
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

-- Tabela de responsáveis pela inclusão, considerando que podem ser muitos
create table inclusion_responsibles (
	id int generated always as identity primary key,
	name varchar(255),
	cpf varchar(14),
	marital_state varchar(35),
	profession varchar(155),
	application_form_id int not null,
	
	constraint fk_application_form_responsible foreign key (application_form_id) references application_forms(id) on delete cascade
);

-- Parte de aprovação financeira do formulário
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
	constraint fk_approval_financial_reviewer foreign key (financial_reviewer_id) references users(id) on delete restrict
);

-- Parte de entrevista no sistema (caso a triagem seja aprovada, agendar a entrevista)
create table application_form_interviews (
	id int generated always as identity primary key,

	-- Informações da entrevista
	-- Etapa 1: agendamento feito pelo vendedor
	interview_date timestamptz,
	schedule_observation text,

	-- Etapa 2: análise da entrevista realizada pela Thaís
	interviewer_id int, -- FK do usuário logado no sistema
	interview_approved boolean,
	interview_observation text,
	interview_reviewed_at timestamptz,

	application_form_id int not null,
	created_at timestamptz not null default now(),
	
	constraint fk_form_interview foreign key (application_form_id) references application_forms(id) on delete cascade,
	constraint fk_form_interviewer foreign key (interviewer_id) references users(id) on delete restrict
);

-- Parte de aprovação pela gerencia, caso seja necessário no futuro podemos passar para apenas o cleber usar
create table application_form_management (
	id int generated always as identity primary key,

	-- Informações da aprovação/reprova pela gerencia
	manager_id int,
	management_approved boolean,
	management_observation text,
	management_reviewed_at timestamptz,

	application_form_id int not null,
	created_at timestamptz not null default now(),

	constraint fk_management_application_form foreign key (application_form_id) references application_forms(id) on delete cascade,
	constraint fk_management_manager foreign key (manager_id) references users(id) on delete restrict
);