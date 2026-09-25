ALTER TABLE application_form_reanalysis_requests
ADD COLUMN stage varchar(20) NOT NULL DEFAULT 'management';
