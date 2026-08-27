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

ALTER TABLE users
ADD COLUMN cpf CHAR(11) UNIQUE;

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

create table application_form_reanalysis_requests (
	id int generated always as identity primary key,

	requester_id int,
	reanalysis_observation text,
	requested_at timestamptz not null default now(),
	application_form_id int not null,

	constraint fk_reanalysis_application_form foreign key (application_form_id) references application_forms(id) on delete cascade,
	constraint fk_reanalysis_requester foreign key (requester_id) references users(id) on delete restrict 
);

-- Tabela de documentos do form, considerando também que pode ser muitos, cada doc tem um registro nessa tabela
create table application_form_documents (
	id int generated always as identity primary key,
	original_filename text not null,
	content_type text,
	stored_path text not null,
	size_bytes int,
	document_type varchar(35) not null default 'adesao',
	uploaded_at timestamptz not null default now(),
	
	application_form_id int not null,
	reanalysis_request_id int null,


	constraint fk_application_form_documents foreign key (application_form_id) references application_forms(id) on delete cascade,
	constraint fk_document_reanalysis foreign key (reanalysis_request_id) references application_form_reanalysis_requests(id) on delete set null
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

-- Tabela para a entrevista qualificada, 142+ colunas
CREATE TABLE qualify_interviews (
	id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

	-- 1. Sofre ou sofreu de alguma doença infeccionsa ou parasitária como:
	is_hiv BOOLEAN NOT NULL DEFAULT FALSE,
	is_chagas BOOLEAN NOT NULL DEFAULT FALSE,
	is_hanseniase BOOLEAN NOT NULL DEFAULT FALSE,
	is_meningite BOOLEAN NOT NULL DEFAULT FALSE,
	is_tuberculose BOOLEAN NOT NULL DEFAULT FALSE,
	is_hepatite BOOLEAN NOT NULL DEFAULT FALSE,

	-- 2. Sofre ou sofreu, de neoplasias malignas (câncer)?
	is_aparelho_digestivo_cancer BOOLEAN NOT NULL DEFAULT FALSE,
	is_aparelho_respiratorio_cancer BOOLEAN NOT NULL DEFAULT FALSE,
	is_leucemia BOOLEAN NOT NULL DEFAULT FALSE,
	is_linfoma BOOLEAN NOT NULL DEFAULT FALSE,
	is_mama_cancer BOOLEAN NOT NULL DEFAULT FALSE,
	is_genitais_femininos BOOLEAN NOT NULL DEFAULT FALSE,
	is_genitais_masculinos BOOLEAN NOT NULL DEFAULT FALSE,
	is_pele BOOLEAN NOT NULL DEFAULT FALSE,
	is_tireoide BOOLEAN NOT NULL DEFAULT FALSE,
	is_trato_urinario_cancer BOOLEAN NOT NULL DEFAULT FALSE,

	-- 3. Sofre ou sofreu, de neoplasias benignas?
	is_tireoide_benigna BOOLEAN NOT NULL DEFAULT FALSE,
	is_genitais_femininos_benigna BOOLEAN NOT NULL DEFAULT FALSE,

	-- 4. Sofre ou sofreu de doenças do sangue?
	is_anemia BOOLEAN NOT NULL DEFAULT FALSE,
	is_coagulacao_hemofilias BOOLEAN NOT NULL DEFAULT FALSE,
	is_purpura BOOLEAN NOT NULL DEFAULT FALSE,

	-- 5. Sofre ou sofreu de doenças endócrinas e relacionadas? (IMC é calculado a partir do peso/altura, não é armazenado)
	is_diabetes BOOLEAN NOT NULL DEFAULT FALSE,
	is_tireoide_endocrina BOOLEAN NOT NULL DEFAULT FALSE,
	is_hipofise BOOLEAN NOT NULL DEFAULT FALSE,
	is_suprarrenal BOOLEAN NOT NULL DEFAULT FALSE,
	peso_kg DECIMAL(5, 2) NOT NULL, -- Peso em quilos (kg)
	altura_cm INT NOT NULL, -- Altura em centímetros (cm)

	-- 6. Sofre ou sofreu de transtornos psiquiátricos, mentais ou de identidade sexual?
	is_psicose_esquizofrenia BOOLEAN NOT NULL DEFAULT FALSE,
	is_autismo BOOLEAN NOT NULL DEFAULT FALSE,
	is_depressao BOOLEAN NOT NULL DEFAULT FALSE,
	is_transtorno_identidade_sexual BOOLEAN NOT NULL DEFAULT FALSE,

	-- 7. Sofre ou sofreu de doenças do sistema nervoso?
	is_avc BOOLEAN NOT NULL DEFAULT FALSE,
	is_enxaqueca BOOLEAN NOT NULL DEFAULT FALSE,
	is_alzheimer BOOLEAN NOT NULL DEFAULT FALSE,
	is_epilepsia BOOLEAN NOT NULL DEFAULT FALSE,
	is_esclerose_multipla BOOLEAN NOT NULL DEFAULT FALSE,
	is_paralisia_cerebral BOOLEAN NOT NULL DEFAULT FALSE,
	is_paralisias_polineuropatias BOOLEAN NOT NULL DEFAULT FALSE,
	is_parkinson BOOLEAN NOT NULL DEFAULT FALSE,
	is_ame BOOLEAN NOT NULL DEFAULT FALSE,

	-- 8. Sofre ou sofreu de doenças dos olhos e anexos?
	is_alteracao_retina BOOLEAN NOT NULL DEFAULT FALSE, -- Adicionar especifique para identificar qual olho foi
	is_astigmatismo BOOLEAN NOT NULL DEFAULT FALSE, -- Adicionar especifique para identificar qual olho foi
	is_catarata BOOLEAN NOT NULL DEFAULT FALSE, -- Adicionar especifique para identificar qual olho foi
	is_ceratocone BOOLEAN NOT NULL DEFAULT FALSE, -- Adicionar especifique para identificar qual olho foi
	is_estrabismo BOOLEAN NOT NULL DEFAULT FALSE, -- Adicionar especifique para identificar qual olho foi
	is_glaucoma BOOLEAN NOT NULL DEFAULT FALSE, -- Adicionar especifique para identificar qual olho foi
	is_hipermetropia BOOLEAN NOT NULL DEFAULT FALSE, -- Adicionar especifique para identificar qual olho foi
	is_miopia BOOLEAN NOT NULL DEFAULT FALSE, -- Adicionar especifique para identificar qual olho foi
	is_transplante_cornea BOOLEAN NOT NULL DEFAULT FALSE, -- Adicionar especifique para identificar qual olho foi
	is_pterigio BOOLEAN NOT NULL DEFAULT FALSE, -- Adicionar especifique para identificar qual olho foi
	is_retinopatia_diabetica BOOLEAN NOT NULL DEFAULT FALSE, -- Adicionar especifique para identificar qual olho foi
	is_presbiopia BOOLEAN NOT NULL DEFAULT FALSE, -- Adicionar especifique para identificar qual olho foi

	-- 9. Sofre ou sofreu de doenças do ouvido, nariz ou garganta?
	is_diminuicao_audicao BOOLEAN NOT NULL DEFAULT FALSE,
	is_hipertrofia_cornetos_amigdalas BOOLEAN NOT NULL DEFAULT FALSE,
	is_labirintite BOOLEAN NOT NULL DEFAULT FALSE,
	is_rinite BOOLEAN NOT NULL DEFAULT FALSE,
	is_sinusite BOOLEAN NOT NULL DEFAULT FALSE,
	is_problemas_adenoide BOOLEAN NOT NULL DEFAULT FALSE,

	-- 10. Sofre ou sofreu de doenças do coração?
	is_angina_pectoris BOOLEAN NOT NULL DEFAULT FALSE,
	is_arritmia_cardiaca BOOLEAN NOT NULL DEFAULT FALSE,
	is_disfuncao_valvulas BOOLEAN NOT NULL DEFAULT FALSE,
	is_hipertensao_arterial BOOLEAN NOT NULL DEFAULT FALSE,
	is_infarto_miocardio BOOLEAN NOT NULL DEFAULT FALSE,
	is_insuficiencia_cardiaca BOOLEAN NOT NULL DEFAULT FALSE,
	is_insuficiencia_coronariana BOOLEAN NOT NULL DEFAULT FALSE,
	is_uso_marcapasso BOOLEAN NOT NULL DEFAULT FALSE,

	-- 11. Sofre ou sofreu de doenças do sistema circulatório?
	is_aneurismas BOOLEAN NOT NULL DEFAULT FALSE,
	is_hemorroidas BOOLEAN NOT NULL DEFAULT FALSE,
	is_insuficiencia_arterial_periferica BOOLEAN NOT NULL DEFAULT FALSE,
	is_trombose_tromboflebite BOOLEAN NOT NULL DEFAULT FALSE,
	is_ulcera_perna BOOLEAN NOT NULL DEFAULT FALSE,
	is_varizes BOOLEAN NOT NULL DEFAULT FALSE,

	-- 12. Sofre ou sofreu de doenças do sistema respiratório?
	is_apneia_sono BOOLEAN NOT NULL DEFAULT FALSE,
	is_asma BOOLEAN NOT NULL DEFAULT FALSE,
	is_bronquiectasia BOOLEAN NOT NULL DEFAULT FALSE,
	is_bronquite BOOLEAN NOT NULL DEFAULT FALSE,
	is_enfisema_dpoc BOOLEAN NOT NULL DEFAULT FALSE,
	is_fibrose_pulmonar BOOLEAN NOT NULL DEFAULT FALSE,
	is_pneumonia BOOLEAN NOT NULL DEFAULT FALSE,

	-- 13. Sofre ou sofreu de doenças do sistema digestivo?
	is_cirrose_hepatica BOOLEAN NOT NULL DEFAULT FALSE,
	is_colelitiase BOOLEAN NOT NULL DEFAULT FALSE,
	is_colite BOOLEAN NOT NULL DEFAULT FALSE,
	is_doenca_diverticular BOOLEAN NOT NULL DEFAULT FALSE,
	is_doencas_pancreas BOOLEAN NOT NULL DEFAULT FALSE,
	is_gastrite BOOLEAN NOT NULL DEFAULT FALSE,
	is_ulcera_peptica BOOLEAN NOT NULL DEFAULT FALSE,
	is_hepatite_digestiva BOOLEAN NOT NULL DEFAULT FALSE,
	is_esteatose_hepatica BOOLEAN NOT NULL DEFAULT FALSE,

	-- 14. Sofre ou sofreu de algum tipo de Hérnia?
	is_hernia_inguinal BOOLEAN NOT NULL DEFAULT FALSE,
	is_hernia_hiato BOOLEAN NOT NULL DEFAULT FALSE,
	is_hernia_umbilical BOOLEAN NOT NULL DEFAULT FALSE,
	is_hernia_epigastrica BOOLEAN NOT NULL DEFAULT FALSE,
	is_hernia_incisional BOOLEAN NOT NULL DEFAULT FALSE,

	-- 15. Sofre ou sofreu de doenças da pele?
	is_tumores_pele BOOLEAN NOT NULL DEFAULT FALSE,
	is_nodulos_cistos BOOLEAN NOT NULL DEFAULT FALSE,
	is_queloide BOOLEAN NOT NULL DEFAULT FALSE,

	-- 16. Sofre ou sofreu de doenças osteomusculares e/ou da coluna?
	is_artrite BOOLEAN NOT NULL DEFAULT FALSE,
	is_artrite_reumatoide BOOLEAN NOT NULL DEFAULT FALSE,
	is_artrose BOOLEAN NOT NULL DEFAULT FALSE,
	is_desvios_coluna BOOLEAN NOT NULL DEFAULT FALSE,
	is_esclerodermia BOOLEAN NOT NULL DEFAULT FALSE,
	is_calos_osseos BOOLEAN NOT NULL DEFAULT FALSE,
	is_sequelas_fraturas BOOLEAN NOT NULL DEFAULT FALSE,
	is_hernia_disco BOOLEAN NOT NULL DEFAULT FALSE,
	is_lupus BOOLEAN NOT NULL DEFAULT FALSE,
	is_osteomielite BOOLEAN NOT NULL DEFAULT FALSE,
	is_osteoporose BOOLEAN NOT NULL DEFAULT FALSE,
	is_reumatismo BOOLEAN NOT NULL DEFAULT FALSE,
	is_tendinite BOOLEAN NOT NULL DEFAULT FALSE,
	is_dores_coluna BOOLEAN NOT NULL DEFAULT FALSE,

	-- 17. Sofreu ou sofre de doenças do aparelho urinário?
	is_calculo_renal BOOLEAN NOT NULL DEFAULT FALSE,
	is_incontinencia_urinaria BOOLEAN NOT NULL DEFAULT FALSE,
	is_insuficiencia_renal BOOLEAN NOT NULL DEFAULT FALSE,
	is_transplante_renal BOOLEAN NOT NULL DEFAULT FALSE,
	is_nefrite_nefrose BOOLEAN NOT NULL DEFAULT FALSE,

	-- 18. Sofre ou sofreu de doenças do aparelho genital feminino?
	is_cisto_ovario BOOLEAN NOT NULL DEFAULT FALSE,
	is_endometriose BOOLEAN NOT NULL DEFAULT FALSE,
	is_infertilidade_feminina BOOLEAN NOT NULL DEFAULT FALSE,
	is_nodulo_mamario BOOLEAN NOT NULL DEFAULT FALSE,
	is_prolapso_uterino BOOLEAN NOT NULL DEFAULT FALSE,
	is_ruptura_perineal BOOLEAN NOT NULL DEFAULT FALSE,

	-- 19. Sofre ou sofreu de doenças do aparelho genital masculino?
	is_esterilidade BOOLEAN NOT NULL DEFAULT FALSE,
	is_fimose BOOLEAN NOT NULL DEFAULT FALSE,
	is_hiperplasia_prostata BOOLEAN NOT NULL DEFAULT FALSE,
	is_hipospadia BOOLEAN NOT NULL DEFAULT FALSE,
	is_impotencia_sexual BOOLEAN NOT NULL DEFAULT FALSE,
	is_testiculo_alto BOOLEAN NOT NULL DEFAULT FALSE,
	is_varicocele BOOLEAN NOT NULL DEFAULT FALSE,

	-- 20. Sofre ou sofreu de doença bucomaxilo?
	is_micrognatia BOOLEAN NOT NULL DEFAULT FALSE,
	is_prognatia BOOLEAN NOT NULL DEFAULT FALSE,
	is_alteracao_maxila BOOLEAN NOT NULL DEFAULT FALSE,
	is_alteracao_atm BOOLEAN NOT NULL DEFAULT FALSE,
	is_ma_formacao_arcada_dentaria BOOLEAN NOT NULL DEFAULT FALSE,
	is_uso_aparelho_ortodontico BOOLEAN NOT NULL DEFAULT FALSE,

	-- 21. Sofre ou sofreu de traumatismos e/ou fraturas?
	is_traumatismos_fraturas BOOLEAN NOT NULL DEFAULT FALSE,

	-- 22. Sofre de sequelas de acidentes, moléstia adquirida ou congênita (doenças de nascença)?
	is_sequelas_acidentes_congenitas BOOLEAN NOT NULL DEFAULT FALSE,

	-- 23. Já foi submetido a algum tipo de cirurgia?
	is_cirurgia_previa BOOLEAN NOT NULL DEFAULT FALSE,

	-- 24. Sofre ou sofreu de alguma doença não relacionada acima, que o tenha obrigado a internar-se ou submeter-se a algum tipo de tratamento ou exame?
	is_internacao_tratamento_outro BOOLEAN NOT NULL DEFAULT FALSE,

	-- 25. Já foi submetido à radioterapia, quimioterapia, braquiterapia, hemodiálise ou diálise peritonial?
	is_radioterapia_quimioterapia_dialise BOOLEAN NOT NULL DEFAULT FALSE,

	-- 26. Tem indicação firmada ou em avaliação de submeter-se a algum tipo de cirurgia?
	is_indicacao_cirurgia_futura BOOLEAN NOT NULL DEFAULT FALSE,

	-- 27. Possui algum tipo de prótese ou órtese (placas, pinos, parafusos, marca-passo, outros)?
	is_protese_ortese BOOLEAN NOT NULL DEFAULT FALSE,

	-- Seleção de opções na página de escolha do médico orientador
	escolha_medico_orientador TEXT NOT NULL,

	-- Parecer da Unimed sobre a declaração de saúde (página "RESERVADO PARA A UNIMED", 4 opções exclusivas)
	parecer_unimed TEXT NOT NULL,

	-- Observação da entrevista qualificada: vai para o contrato, o beneficiário lê e confirma antes de assinar
	observation TEXT,

	application_form_interview_id INT NOT NULL UNIQUE,

	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	inserted_by INT NOT NULL,

	CONSTRAINT fk_application_form_qualify_interview FOREIGN KEY (application_form_interview_id) REFERENCES application_form_interviews(id) ON DELETE CASCADE,
	CONSTRAINT fk_inserted_by_qualify_interview FOREIGN KEY (inserted_by) REFERENCES users(id) ON DELETE RESTRICT,
	CONSTRAINT chk_escolha_medico_orientador CHECK (escolha_medico_orientador IN ('medico_unimed', 'medico_proprio', 'dispensou_orientador')),
	CONSTRAINT chk_parecer_unimed CHECK (parecer_unimed IN ('sem_preexistencias', 'com_preexistencias_aceitou_cpt', 'com_preexistencias_recusou_cpt', 'recusou_pericia_exames')),
	CONSTRAINT chk_peso_kg CHECK (peso_kg > 0 AND peso_kg <= 999.99),
	CONSTRAINT chk_altura_cm CHECK (altura_cm BETWEEN 30 AND 300)
);
