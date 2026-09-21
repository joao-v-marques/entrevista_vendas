-- Realiza a inserção de todas as roles iniciais da aplicação
insert into roles (name, description)
values ('administrator', 'Acesso irrestrito ao sistema, incluindo configurações, controle de usuários, cargos e setores. Reservado à equipe de desenvolvimento.');

insert into roles (name, description)
values ('director', 'Acesso gerencial a todos os módulos operacionais (Vendas, Financeiro, Entrevistas e Gerência), sem acesso às telas administrativas de configuração e controle de usuários.');

insert into roles (name, description)
values ('finance_employee', 'Acesso completo ao módulo Financeiro. Em Vendas -> Formulários, acesso somente de consulta e download de documentos, sem poder finalizar formulários no backoffice.');

insert into roles (name, description)
values ('sales_employee', 'Acesso completo ao módulo de Vendas, mais Entrevistas → Agendar Entrevista e Entrevistas Realizadas. Nos demais módulos (Financeiro, Entrevistas e Gerência), acesso somente de consulta.');

insert into roles (name, description)
values ('interview_employee', 'Acesso completo ao módulo de Entrevistas e à tela Vendas -> Formulários.');

-- Realiza a inserção de todos os sectors iniciais da aplicação
insert into sectors (name)
values ('Não Informado');

insert into sectors (name)
values ('TIC');

insert into sectors (name)
values ('Comercial');

insert into sectors (name)
values ('Financeiro');

insert into sectors (name)
values ('Gerência');

-- Realiza a inserção do usuário admin, o único inicial da aplicação
insert into users (username, name, password_hash, role_id, sector_id)
values ('admin', 'Administrador do Sistema', '$argon2id$v=19$m=65536,t=3,p=4$UM5o8MUtS8amSRRLTvQOVA$nGdaws6NvOPrCsXddyU2Rw+FkajnvT7aQtAN2XLVYHs', 1, 1);